import { NextRequest } from 'next/server'
import {
  verifyDynamicJwt,
  extractJwtFromHeader,
  DynamicJwtPayload,
} from './jwt-verification'

/**
 * Authentication middleware for API routes
 * Verifies Dynamic.xyz JWT tokens and extracts user information
 */
export async function authenticateRequest(request: NextRequest) {
  try {
    // Get the Authorization header
    const authHeader = request.headers.get('authorization')
    const token = extractJwtFromHeader(authHeader)

    if (!token) {
      return {
        success: false,
        error: 'Missing or invalid authorization header',
        status: 401,
      }
    }

    // Verify the JWT token using Dynamic's JWKS endpoint
    const payload = await verifyDynamicJwt(token)

    return {
      success: true,
      user: payload,
      status: 200,
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
      status: 401,
    }
  }
}

/**
 * Helper function to get user from request
 * Use this in your API routes to get authenticated user info
 */
export async function getUserFromRequest(
  request: NextRequest
): Promise<DynamicJwtPayload> {
  const authResult = await authenticateRequest(request)

  if (!authResult.success) {
    throw new Error(authResult.error)
  }

  return authResult.user
}
