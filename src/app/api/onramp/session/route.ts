/**
 * Coinbase Onramp Session Token API
 *
 * Generates a one-time session token for the Coinbase Onramp widget.
 * This allows users to buy USDC directly in their wallet.
 *
 * Required env vars:
 * - CDP_API_KEY_NAME: Your Coinbase Developer Platform API key name
 * - CDP_API_KEY_PRIVATE_KEY: Your CDP API private key (PEM format)
 */

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, importPKCS8, importJWK } from 'jose'
import { randomBytes } from 'crypto'
import { getAddress, isAddress } from 'viem'

// Support both formats: the new format (id/privateKey) and legacy (CDP_API_KEY_NAME/CDP_API_KEY_PRIVATE_KEY)
// Strip quotes if present (env files sometimes have them)
const getEnvVar = (key: string) => {
  const value = process.env[key] || ''
  return value.replace(/^["']|["']$/g, '').trim()
}

const CDP_API_KEY_ID = getEnvVar('id') || getEnvVar('CDP_API_KEY_NAME')
const CDP_API_KEY_PRIVATE_KEY_BASE64 = getEnvVar('privateKey') || getEnvVar('CDP_API_KEY_PRIVATE_KEY')

// Coinbase Onramp API endpoint
const ONRAMP_TOKEN_URL = 'https://api.developer.coinbase.com/onramp/v1/token'

/**
 * Generate a JWT for CDP API authentication.
 * Must match @coinbase/cdp-sdk `generateJwt`: `uris` (array), no legacy `uri` claim;
 * audience claim was removed from the official SDK — wrong `aud` causes 401.
 * @see https://github.com/coinbase/cdp-sdk/blob/main/typescript/src/auth/utils/jwt.ts
 */
async function generateCDPJWT(): Promise<string> {
  if (!CDP_API_KEY_ID || !CDP_API_KEY_PRIVATE_KEY_BASE64) {
    throw new Error('CDP API credentials not configured')
  }

  let privateKey
  let algorithm: 'EdDSA' | 'ES256' = 'EdDSA' // Coinbase defaults to Ed25519
  
  try {
    // Try to parse as PEM format first (legacy ECDSA format)
    if (CDP_API_KEY_PRIVATE_KEY_BASE64.includes('BEGIN')) {
      privateKey = await importPKCS8(CDP_API_KEY_PRIVATE_KEY_BASE64, 'ES256')
      algorithm = 'ES256'
    } else {
      // Coinbase provides base64-encoded Ed25519 key (64 bytes = 32 byte seed + 32 byte public)
      const keyBuffer = Buffer.from(CDP_API_KEY_PRIVATE_KEY_BASE64, 'base64')
      
      console.log(`🔑 Key buffer length: ${keyBuffer.length} bytes`)
      
      if (keyBuffer.length === 64) {
        // Ed25519 key: first 32 bytes = private seed, last 32 bytes = public key
        const privateKeyBytes = keyBuffer.subarray(0, 32)
        const publicKeyBytes = keyBuffer.subarray(32, 64)
        
        // Convert to base64url (no padding, URL-safe)
        const toBase64Url = (buf: Buffer) => 
          buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        
        // Create JWK for Ed25519
        const jwk = {
          kty: 'OKP' as const,
          crv: 'Ed25519' as const,
          d: toBase64Url(privateKeyBytes),
          x: toBase64Url(publicKeyBytes),
        }
        
        privateKey = await importJWK(jwk, 'EdDSA')
        algorithm = 'EdDSA'
      } else if (keyBuffer.length === 32) {
        // Just the private seed (32 bytes) - need to derive public key
        // For now, we can't use this without deriving the public key
        throw new Error('32-byte key detected but public key derivation not implemented. Please use the full 64-byte key.')
      } else {
        throw new Error(`Unexpected key length: ${keyBuffer.length} bytes. Expected 64 bytes for Ed25519.`)
      }
    }
  } catch (error) {
    console.error('❌ Failed to parse private key:', error)
    throw new Error(`Invalid private key format: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Use the API key ID as provided by Coinbase
  const apiKeyName = CDP_API_KEY_ID

  const now = Math.floor(Date.now() / 1000)
  
  // Generate a random nonce (required by Coinbase)
  const nonce = randomBytes(16).toString('hex')
  
  // Coinbase requires the URI claim in format: "METHOD host/path"
  // Parse the URL to get host and path
  const url = new URL(ONRAMP_TOKEN_URL)
  const uriEntry = `POST ${url.host}${url.pathname}`

  console.log(`🔐 JWT uris[0]: ${uriEntry}`)
  console.log(`🔐 JWT kid: ${apiKeyName}`)
  console.log(`🔐 JWT algorithm: ${algorithm}`)

  const jwt = await new SignJWT({
    sub: apiKeyName,
    iss: 'cdp',
    uris: [uriEntry],
  })
    .setProtectedHeader({
      alg: algorithm,
      typ: 'JWT',
      kid: apiKeyName,
      nonce,
    })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 120) // 2 minutes
    .sign(privateKey)

  return jwt
}

export async function POST(request: NextRequest) {
  try {
    // Get the wallet address and client IP from the request
    const body = await request.json()
    const { walletAddress } = body

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    if (!isAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      )
    }

    // Coinbase expects a canonical EIP-55 address; clients often send lowercase from our store.
    const destinationAddress = getAddress(walletAddress)

    // Check if CDP credentials are configured
    if (!CDP_API_KEY_ID || !CDP_API_KEY_PRIVATE_KEY_BASE64) {
      return NextResponse.json(
        {
          error: 'Coinbase Onramp not configured',
          message:
            'Please set "id" and "privateKey" (or CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY) in your environment',
        },
        { status: 503 }
      )
    }

    // Get client IP for security validation
    // Coinbase requires a real public IP (not 127.0.0.1 or private IPs)
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const realIp = request.headers.get('x-real-ip')
    
    // Only send clientIp for real routable addresses. ::1 was misclassified as "public"
    // and breaks local dev; Coinbase also documents TEST-NET placeholders for sandbox.
    const isPrivateOrLocalIp = (ip: string) => {
      const lower = ip.toLowerCase()
      if (lower === 'localhost' || lower === '127.0.0.1') return true
      // IPv6 loopback / IPv4-mapped loopback
      if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true
      if (lower.startsWith('::ffff:127.')) return true
      if (ip.startsWith('10.')) return true
      if (ip.startsWith('192.168.')) return true
      // RFC1918 172.16.0.0/12
      if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true
      return false
    }
    
    const clientIp = forwardedFor || realIp || null
    const hasPublicIp = Boolean(clientIp && !isPrivateOrLocalIp(clientIp))
    
    console.log(`🌐 Client IP: ${clientIp || 'none'} (public: ${hasPublicIp})`)

    // Generate CDP JWT for authentication
    const jwt = await generateCDPJWT()

    // Build request body - only include clientIp if we have a public IP
    // Coinbase rejects private IPs, so we try without it for local dev
    const requestBody: Record<string, unknown> = {
      addresses: [
        {
          address: destinationAddress,
          // Coinbase Onramp only supports mainnet (real purchases)
          blockchains: ['base'], // Base Mainnet
        },
      ],
      assets: ['USDC'],
    }
    
    // Only add clientIp if it's a public IP
    if (hasPublicIp) {
      requestBody.clientIp = clientIp
    }

    // Request session token from Coinbase
    const response = await fetch(ONRAMP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ CDP Onramp token error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to generate session token', details: errorText },
        { status: response.status }
      )
    }

    const data = (await response.json()) as Record<string, unknown>
    const nested = data.data as Record<string, unknown> | undefined
    const sessionToken =
      (typeof nested?.token === 'string' ? nested.token : undefined) ??
      (typeof data.token === 'string' ? data.token : undefined) ??
      (typeof data.sessionToken === 'string' ? data.sessionToken : undefined) ??
      (typeof nested?.sessionToken === 'string' ? nested.sessionToken : undefined)

    if (!sessionToken) {
      console.error('[ONRAMP] Token response missing session token keys:', Object.keys(data))
      return NextResponse.json(
        { error: 'Invalid session response from Coinbase' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      sessionToken,
      success: true,
    })
  } catch (error) {
    console.error('❌ Onramp session error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create onramp session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
