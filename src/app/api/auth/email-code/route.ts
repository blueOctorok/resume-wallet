import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getRequestMeta } from '@/lib/ev-share'
import { emailCodeRateLimiter, RATE_LIMITS } from '@/lib/rate-limit'
import { sendSignInCode } from '@/lib/send-signin-code'

/**
 * POST /api/auth/email-code
 *
 * Sends a 6-digit sign-in code with no link in the message. Used by the
 * shared Log in screen. The employer access form sends through the same helper.
 */
export async function POST(request: NextRequest) {
  try {
    const meta = getRequestMeta(request)
    const limitKey = `email-code:${meta.ipAddress || 'unknown'}`
    if (
      !emailCodeRateLimiter.check(
        limitKey,
        RATE_LIMITS.EMAIL_CODE.maxRequests,
        RATE_LIMITS.EMAIL_CODE.windowMs,
      )
    ) {
      return NextResponse.json(
        { error: 'Too many codes. Try again in a little while.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 })
    }

    const admin = await getAdminSupabaseClient()
    const sent = await sendSignInCode(admin, email)
    if (sent.ok === false) {
      return NextResponse.json({ error: sent.error }, { status: 502 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[EMAIL CODE]', error)
    return NextResponse.json({ error: 'Could not send a code.' }, { status: 500 })
  }
}
