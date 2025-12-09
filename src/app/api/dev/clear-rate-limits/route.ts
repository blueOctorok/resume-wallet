// app/api/dev/clear-rate-limits/route.ts
// Development endpoint to clear rate limits

import { NextRequest, NextResponse } from 'next/server'
import { uploadRateLimiter, verificationRateLimiter } from '@/lib/rate-limit'

const ADMIN_API_KEY = process.env.ADMIN_API_KEY

export async function POST(req: NextRequest) {
  try {
    // Only allow in development OR with admin key
    if (process.env.NODE_ENV === 'production') {
      // In production, require admin key
      if (ADMIN_API_KEY) {
        const headerKey = req.headers.get('x-admin-key') || req.headers.get('authorization')
        if (!headerKey || headerKey.replace('Bearer ', '').trim() !== ADMIN_API_KEY) {
          return NextResponse.json(
            { error: 'Missing or invalid admin key. Authentication required.' },
            { status: 401 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'Not available in production without admin key configured' },
          { status: 403 }
        )
      }
    }

    const body = await req.json()
    const { walletAddress, clearAll } = body

    if (clearAll) {
      // Clear all rate limits
      uploadRateLimiter.clearAllLimits()
      verificationRateLimiter.clearAllLimits()
      console.log('🧹 Dev API: Cleared all rate limits')
      return NextResponse.json({
        success: true,
        message: 'All rate limits cleared',
      })
    } else if (walletAddress) {
      // Clear rate limits for specific user
      const uploadKey = `upload:${walletAddress}`
      const verificationKey = `verification:${walletAddress}`

      uploadRateLimiter.clearLimit(uploadKey)
      verificationRateLimiter.clearLimit(verificationKey)

      console.log('🧹 Dev API: Cleared rate limits for:', walletAddress)
      return NextResponse.json({
        success: true,
        message: `Rate limits cleared for ${walletAddress}`,
      })
    } else {
      return NextResponse.json(
        {
          error: 'Missing walletAddress or clearAll parameter',
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('❌ Dev API: Error clearing rate limits:', error)
    return NextResponse.json(
      { error: 'Failed to clear rate limits' },
      { status: 500 }
    )
  }
}
