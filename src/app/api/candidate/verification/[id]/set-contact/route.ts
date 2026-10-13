import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAppBaseUrl } from '@/lib/app-url'
import {
  OUTREACH_REQUEST_COLUMNS,
  sendOutreachAttempt,
  type OutreachRequestRow,
} from '@/lib/evr-outreach'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/candidate/verification/[id]/set-contact
 * Body: { email?: string, phone?: string, phoneType?: 'office' | 'mobile' }
 *
 * Driver confirms (or types) the employer contact after research or a bounce.
 * Saves it, clears the research flag, and sends the next attempt right away
 * if there is an email and attempts remain — the driver chose this contact,
 * so there is no reason to wait for the cron.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { id } = await params
    const body = (await request.json()) as { email?: string; phone?: string; phoneType?: string }
    const email = body.email?.trim().toLowerCase() || null
    const phone = body.phone?.trim() || null
    const phoneType = body.phoneType === 'mobile' ? 'mobile' : body.phoneType === 'office' ? 'office' : null

    if (!email && !phone) {
      return NextResponse.json({ error: 'Provide an email or phone number.' }, { status: 400 })
    }
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'That email address does not look valid.' }, { status: 400 })
    }
    if (body.phoneType && !phoneType) {
      return NextResponse.json({ error: 'Phone type must be office or mobile.' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: existing } = await supabase
      .from('employment_verification_requests')
      .select('id, status')
      .eq('id', id)
      .eq('driver_id', userId)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
    }
    if (!['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'].includes(String(existing.status))) {
      return NextResponse.json({ error: 'This packet is closed.' }, { status: 409 })
    }

    const { data: row, error } = await supabase
      .from('employment_verification_requests')
      .update({
        ...(email ? { previous_employer_email: email } : {}),
        ...(phone ? { previous_employer_phone: phone, previous_employer_phone_type: phoneType ?? 'office' } : {}),
        contact_research_status: 'not_requested',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(OUTREACH_REQUEST_COLUMNS)
      .single()
    if (error || !row) {
      return NextResponse.json({ error: 'Failed to save contact' }, { status: 500 })
    }

    const send = await sendOutreachAttempt(supabase, row as OutreachRequestRow, {
      baseUrl: getAppBaseUrl(request),
      triggeredBy: 'driver',
    })

    return NextResponse.json({
      success: true,
      sent: send.ok,
      attemptNumber: send.ok ? send.attemptNumber : null,
      // Phone-only contacts are saved for Phase 2 (voice); nothing goes out yet.
      message: send.ok
        ? `Contact saved. Request sent to ${email}.`
        : send.code === 'no_contact'
          ? 'Phone saved. After the second email we place one call to an office number, or one text to a mobile number, if that channel is turned on.'
          : send.error,
    })
  } catch (error) {
    console.error('[EVR SET CONTACT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
