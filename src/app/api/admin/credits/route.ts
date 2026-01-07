import { NextRequest, NextResponse } from 'next/server'

const ADMIN_API_KEY = process.env.ADMIN_API_KEY
const T_BACKEND_BASE_URL = process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'
const FETCH_TIMEOUT_MS = 10000 // 10 second timeout

/**
 * GET /api/admin/credits
 * 
 * Fetches the current credit balance from T Backend.
 * This is for admin/dev monitoring only.
 * 
 * Requires authentication via ADMIN_API_KEY in x-admin-key header or Authorization header.
 */
export async function GET(request: NextRequest) {
  // Check for admin authentication
  if (ADMIN_API_KEY) {
    const headerKey = request.headers.get('x-admin-key') || request.headers.get('authorization')
    if (!headerKey || headerKey.replace('Bearer ', '').trim() !== ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Missing or invalid admin key. Authentication required.' },
        { status: 401 }
      )
    }
  } else {
    // If no ADMIN_API_KEY is set, only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Admin API key is not configured. This endpoint is disabled in production.' },
        { status: 500 }
      )
    }
  }

  try {
    const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY
    if (!paymentKey) {
      return NextResponse.json(
        { error: 'No payment wallet configured' },
        { status: 500 }
      )
    }

    // Get wallet address from private key
    const { privateKeyToAccount } = await import('viem/accounts')
    const normalizedKey = paymentKey.startsWith('0x') ? paymentKey : `0x${paymentKey}`
    const account = privateKeyToAccount(normalizedKey as `0x${string}`)

    // Fetch credits from T Backend with timeout
    const url = `${T_BACKEND_BASE_URL}/payments/credits?partner=pace_drivers&wallet=${account.address}`
    
    // Create AbortController for timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle server errors (502, 503, 504) gracefully
      if (!response.ok) {
        const status = response.status
        const isServerError = status >= 500 && status < 600
        
        console.error(`❌ [CREDITS] Failed to fetch credits: ${status} ${response.statusText}`)
        
        // Try to get error details
        let errorText = ''
        try {
          errorText = await response.text()
          console.error(`[CREDITS] Error response:`, errorText)
        } catch (e) {
          // Ignore if we can't read the response
        }

        // For server errors (502, 503, 504), return 503 to indicate temporary unavailability
        if (isServerError) {
          return NextResponse.json(
            { 
              error: 'Credit service temporarily unavailable',
              details: 'The credit service is currently experiencing issues. Please try again later.',
              status: 503
            },
            { status: 503 }
          )
        }

        // For client errors (4xx), return the original status
        return NextResponse.json(
          { 
            error: 'Failed to fetch credits',
            status: status
          },
          { status: status }
        )
      }

      const data = await response.json()
      console.log('✅ [CREDITS] Balance retrieved:', data)

      return NextResponse.json({
        wallet: account.address,
        ...data,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      // Handle timeout or abort errors
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('❌ [CREDITS] Request timeout')
        return NextResponse.json(
          { 
            error: 'Request timeout',
            details: 'The credit service did not respond in time. Please try again later.'
          },
          { status: 504 }
        )
      }
      
      // Re-throw other fetch errors to be caught by outer catch
      throw fetchError
    }
  } catch (error) {
    console.error('❌ [CREDITS] Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'An unexpected error occurred while fetching credits.'
      },
      { status: 500 }
    )
  }
}

