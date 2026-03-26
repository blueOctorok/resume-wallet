/**
 * Coinbase Onramp Session Token API
 *
 * Uses the official @coinbase/cdp-sdk to generate a JWT, then requests a
 * one-time session token from the Coinbase Onramp endpoint.
 *
 * Required env vars (bare names match the CDP key-file download):
 *   id          — API key UUID  (e.g. "342d1409-…")
 *   privateKey  — base64-encoded Ed25519 key (87 chars → 64 bytes)
 * Legacy aliases also work:
 *   CDP_API_KEY_NAME / CDP_API_KEY_PRIVATE_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateJwt } from '@coinbase/cdp-sdk/auth'
import { getAddress, isAddress } from 'viem'

const strip = (v: string) => v.replace(/^["']|["']$/g, '').trim()
const env = (key: string) => strip(process.env[key] ?? '')

const CDP_KEY_NAME = env('id') || env('CDP_API_KEY_NAME')
const CDP_KEY_SECRET = env('privateKey') || env('CDP_API_KEY_PRIVATE_KEY')

const ONRAMP_TOKEN_URL = 'https://api.developer.coinbase.com/onramp/v1/token'
const ONRAMP_HOST = 'api.developer.coinbase.com'
const ONRAMP_PATH = '/onramp/v1/token'

function isPrivateOrLocalIp(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === 'localhost' || lower === '127.0.0.1') return true
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true
  if (lower.startsWith('::ffff:127.')) return true
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true
  return false
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json()

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    }
    if (!isAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }

    const destinationAddress = getAddress(walletAddress)

    if (!CDP_KEY_NAME || !CDP_KEY_SECRET) {
      return NextResponse.json(
        {
          error: 'Coinbase Onramp not configured',
          message: 'Set "id" + "privateKey" (or CDP_API_KEY_NAME + CDP_API_KEY_PRIVATE_KEY) in .env.local',
        },
        { status: 503 },
      )
    }

    // --- Resolve client IP ---
    const rawIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null
    const hasPublicIp = rawIp ? !isPrivateOrLocalIp(rawIp) : false
    // Coinbase requires clientIp. For local dev use RFC 5737 TEST-NET — same as their demo app.
    const clientIp = hasPublicIp ? rawIp! : '192.0.2.1'

    console.log(`🌐 Client IP: ${rawIp ?? 'none'} → sending ${clientIp}`)

    // --- Generate JWT via official SDK ---
    let jwt: string
    try {
      // Replace literal \n (from .env files) with real newlines (matters for PEM keys)
      const processedSecret = CDP_KEY_SECRET.includes('\\n')
        ? CDP_KEY_SECRET.replace(/\\n/g, '\n')
        : CDP_KEY_SECRET

      jwt = await generateJwt({
        apiKeyId: CDP_KEY_NAME,
        apiKeySecret: processedSecret,
        requestMethod: 'POST',
        requestHost: ONRAMP_HOST,
        requestPath: ONRAMP_PATH,
      })
      console.log('🔐 JWT generated via @coinbase/cdp-sdk ✓')
    } catch (err) {
      console.error('❌ JWT generation failed:', err)
      return NextResponse.json(
        { error: 'JWT generation failed', message: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      )
    }

    // --- Request session token ---
    const requestBody = {
      addresses: [{ address: destinationAddress, blockchains: ['base'] }],
      assets: ['USDC'],
      clientIp,
    }

    console.log('📤 Onramp body:', JSON.stringify(requestBody))

    const response = await fetch(ONRAMP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const respHeaders = Object.fromEntries(response.headers.entries())
      console.error('❌ CDP Onramp error:', response.status, response.statusText)
      console.error('❌ Response body:', errorText || '(empty)')
      console.error('❌ Response headers:', JSON.stringify(respHeaders))

      // Decode our JWT so we can inspect what we actually sent
      try {
        const [hB64, pB64] = jwt.split('.')
        const header = JSON.parse(Buffer.from(hB64, 'base64url').toString())
        const payload = JSON.parse(Buffer.from(pB64, 'base64url').toString())
        console.error('❌ JWT header:', JSON.stringify(header))
        console.error('❌ JWT payload:', JSON.stringify(payload))
      } catch { /* non-critical */ }

      return NextResponse.json(
        { error: 'Failed to generate session token', details: errorText || response.statusText },
        { status: response.status },
      )
    }

    const data = await response.json()
    const sessionToken: string | undefined = data.token ?? data.data?.token

    if (!sessionToken) {
      console.error('[ONRAMP] Unexpected response shape:', JSON.stringify(data))
      return NextResponse.json({ error: 'Invalid session response from Coinbase' }, { status: 502 })
    }

    console.log('✅ Session token obtained')
    return NextResponse.json({ sessionToken, success: true })
  } catch (error) {
    console.error('❌ Onramp session error:', error)
    return NextResponse.json(
      { error: 'Failed to create onramp session', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
