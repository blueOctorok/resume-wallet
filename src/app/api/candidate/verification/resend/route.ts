import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAppBaseUrl } from '@/lib/app-url'
import { sendVerificationEmailAndTrack } from '@/lib/send-verification-email'

const MAX_ATTEMPTS = 3

/**
 * POST /api/candidate/verification/resend
 * Send the same packet again (max 3 attempts).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as { requestId?: string }
    if (!body.requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: row, error } = await supabase
      .from('employment_verification_requests')
      .select(
        'id, driver_id, status, attempt_count, previous_employer_email, previous_employer_phone, previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, verification_token',
      )
      .eq('id', body.requestId)
      .eq('driver_id', userId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
    }

    if (['VERIFIED', 'PARTIALLY_VERIFIED', 'VERIFICATION_DENIED'].includes(String(row.status))) {
      return NextResponse.json(
        { error: 'This packet already has a reply. Request a correction instead of resending.' },
        { status: 409 },
      )
    }

    const attemptCount = Number(row.attempt_count ?? 0)
    if (attemptCount >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Already sent 3 times. No further attempts.' },
        { status: 409 },
      )
    }

    const nextAttempt = attemptCount + 1
    const email = row.previous_employer_email as string | null
    const token = row.verification_token as string | null
    if (email && token) {
      const emailResult = await sendVerificationEmailAndTrack(supabase, String(row.id), {
        to: email,
        verificationLink: `${getAppBaseUrl(request)}/verify/${token}`,
        previousEmployerName: String(row.previous_employer_name ?? ''),
        claimedPosition: String(row.claimed_position ?? ''),
        claimedCompanyName: String(row.previous_employer_name ?? ''),
        claimedStartDate: row.claimed_start_date ? String(row.claimed_start_date) : undefined,
        claimedEndDate: row.claimed_end_date != null ? String(row.claimed_end_date) : null,
      })
      if (!emailResult.ok) {
        console.warn('[EVR RESEND] Email failed:', emailResult.error)
      }
    }

    const now = new Date().toISOString()
    await supabase.from('verification_attempts').insert({
      verification_request_id: row.id,
      attempt_number: nextAttempt,
      method: 'email',
      contact_email: email,
      contact_phone: row.previous_employer_phone,
    })

    const exhausted = nextAttempt >= MAX_ATTEMPTS
    await supabase
      .from('employment_verification_requests')
      .update({
        attempt_count: nextAttempt,
        last_attempt_at: now,
        status: exhausted ? 'ATTEMPTS_EXHAUSTED' : 'VERIFICATION_IN_PROGRESS',
        next_attempt_at: exhausted ? null : now,
      })
      .eq('id', row.id)

    return NextResponse.json({
      success: true,
      attemptNumber: nextAttempt,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - nextAttempt),
    })
  } catch (error) {
    console.error('[EVR RESEND]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
