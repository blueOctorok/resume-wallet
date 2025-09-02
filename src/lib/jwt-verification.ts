import jwt, { JwtPayload } from 'jsonwebtoken'
import { JwksClient } from 'jwks-rsa'

// Get the JWKS URL for our Dynamic environment
const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID
const jwksUrl = `https://app.dynamic.xyz/api/v0/sdk/${DYNAMIC_ENV_ID}/.well-known/jwks`

// Initialize the JWKS client as per documentation
const client = new JwksClient({
  jwksUri: jwksUrl,
  rateLimit: true,
  cache: true,
  cacheMaxEntries: 5, // Maximum number of cached keys
  cacheMaxAge: 600000, // Cache duration in milliseconds (10 minutes)
})

export interface DynamicJwtPayload extends JwtPayload {
  // Standard JWT claims
  aud?: string
  iss?: string
  sub?: string
  iat?: number
  exp?: number

  // Dynamic-specific claims
  alias?: string
  email?: string
  environment_id?: string
  given_name?: string
  family_name?: string
  lists?: string[]
  verified_credentials?: Array<{
    address: string
    chain: string
    id: string
    wallet_name: string
  }>
  verified_account?: {
    address: string
    chain: string
    id: string
    wallet_name: string
  }
  scopes?: string[]
}

/**
 * Verifies a Dynamic JWT token and returns the decoded payload
 * @param encodedJwt - The JWT token to verify
 * @returns The decoded JWT payload
 * @throws Error if token is invalid, expired, or requires additional auth
 */
export async function verifyDynamicJwt(
  encodedJwt: string
): Promise<DynamicJwtPayload> {
  try {
    // Get the signing key from JWKS endpoint
    const signingKey = await client.getSigningKey()
    const publicKey = signingKey.getPublicKey()

    // Verify the JWT token
    const decodedToken = jwt.verify(encodedJwt, publicKey, {
      ignoreExpiration: false,
    }) as DynamicJwtPayload

    // Check for additional authentication requirements
    if (decodedToken.scopes?.includes('requiresAdditionalAuth')) {
      throw new Error('Additional verification required (MFA)')
    }

    return decodedToken
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error(`Invalid JWT token: ${error.message}`)
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('JWT token has expired')
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error('JWT token not active yet')
    }
    throw error
  }
}

/**
 * Extracts JWT token from Authorization header
 * @param authHeader - The Authorization header value
 * @returns The JWT token or null if not found
 */
export function extractJwtFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7) // Remove 'Bearer ' prefix
}
