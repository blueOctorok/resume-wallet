import { NextRequest, NextResponse } from 'next/server'
import { getRequestMeta } from '@/lib/ev-share'
import { emailCodeRateLimiter, RATE_LIMITS } from '@/lib/rate-limit'
import { signInCodeHash } from '@/lib/signin-code-hash'

/**
 * POST /api/auth/verify-email-code
 *
 * generateLink writes the code into auth.one_time_tokens with expires_at
 * left null (Auth's "write expiry" switch is off). The usual verify call —
 * email plus the 6 digits — looks at that column, and a null expiry counts
 * as already expired. Every type then returns 403 otp_expired, and the row
 * stays, so retrying does not help.
 *
 * Sending only the hash takes the other verify path. That one checks
 * recovery_sent_at, which generateLink does set. SHA-224(email + code) is
 * the same hash Auth stored.
 */
const HASH_TYPES = ['magiclink', 'email', 'invite', 'signup', 'recovery'] as const

type VerifySession = {
  access_token?: string
  refresh_token?: string
}

export async function POST(request: NextRequest) {
  try {
    const meta = getRequestMeta(request)
    const limitKey = `verify-code:${meta.ipAddress || 'unknown'}`
    if (
      !emailCodeRateLimiter.check(
        limitKey,
        RATE_LIMITS.VERIFY_EMAIL_CODE.maxRequests,
        RATE_LIMITS.VERIFY_EMAIL_CODE.windowMs,
      )
    ) {
      return NextResponse.json(
        { error: 'Too many attempts. Request a new code in a little while.' },
        { status: 429 },
      )
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Sign-in is not configured.' }, { status: 500 })
    }

    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const digits = String(body.token ?? '').replace(/\D/g, '')
    if (!email.includes('@') || digits.length < 6 || digits.length > 10) {
      return NextResponse.json(
        { error: 'Enter the code from the newest email. The subject line is the code.' },
        { status: 400 },
      )
    }

    const tokenHash = signInCodeHash(email, digits)
    let lastStatus = 403

    for (const type of HASH_TYPES) {
      const res = await fetch(`${url}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, token_hash: tokenHash }),
      })
      if (res.ok) {
        const session = (await res.json()) as VerifySession
        if (session.access_token && session.refresh_token) {
          return NextResponse.json({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          })
        }
        console.error('[VERIFY CODE] verify succeeded without a session')
        return NextResponse.json({ error: 'Could not start the session. Try the code again.' }, { status: 502 })
      }
      lastStatus = res.status
      // 403 is a wrong type or a miss. It does not burn the real code.
      if (res.status !== 403) break
    }

    if (lastStatus === 403) {
      return NextResponse.json(
        { error: 'That code does not match, or it has expired. Use the newest email — the subject line is the code.' },
        { status: 403 },
      )
    }
    console.error('[VERIFY CODE] auth verify failed:', lastStatus)
    return NextResponse.json({ error: 'Could not verify the code. Please try again.' }, { status: 502 })
  } catch (error) {
    console.error('[VERIFY CODE]', error)
    return NextResponse.json({ error: 'Could not verify the code. Please try again.' }, { status: 500 })
  }
}
