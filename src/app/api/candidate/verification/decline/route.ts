import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  VerificationRequestRow,
  rowToVerificationRequest,
} from '@/types/employment-verification'
import {
  applicantTypeForSource,
  getMergedCandidateEmployments,
} from '@/lib/candidate-employment-verification'

function toDateOnly(value: string | null | undefined): string | null {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const ym = s.match(/^(\d{4})-(\d{2})$/)
  if (ym) return `${ym[1]}-${ym[2]}-01`
  if (/^\d{4}$/.test(s)) return `${s}-01-01`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * POST /api/candidate/verification/decline
 * Record that the driver will not send this packet. No email. They can still send later.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as { verificationKey?: string }
    const verificationKey = body.verificationKey
    if (!verificationKey || typeof verificationKey !== 'string') {
      return NextResponse.json({ error: 'verificationKey is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const employments = await getMergedCandidateEmployments(supabase, userId)
    const row = employments.find((e) => e.verificationKey === verificationKey)
    if (!row) {
      return NextResponse.json({ error: 'Employment entry not found' }, { status: 404 })
    }

    const applicantType = applicantTypeForSource(row.source)

    const { data: latest } = await supabase
      .from('employment_verification_requests')
      .select('id, status')
      .eq('driver_id', userId)
      .eq('employment_id', verificationKey)
      .eq('initiated_by', 'applicant')
      .eq('applicant_type', applicantType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest?.status === 'DRIVER_SEND_DECLINED') {
      const { data: existing } = await supabase
        .from('employment_verification_requests')
        .select('*')
        .eq('id', latest.id)
        .single()
      return NextResponse.json({
        success: true,
        alreadyDeclined: true,
        verificationRequest: existing
          ? rowToVerificationRequest(existing as VerificationRequestRow, 'Self-Initiated')
          : undefined,
      })
    }

    if (
      latest &&
      !['ATTEMPTS_EXHAUSTED', 'VERIFICATION_DENIED', 'VERIFICATION_DECLINED'].includes(
        String(latest.status),
      )
    ) {
      return NextResponse.json(
        {
          error: 'This employer already has a packet on file. Decline is only for unsent requests.',
          existingRequestId: latest.id,
          status: latest.status,
        },
        { status: 409 },
      )
    }

    // Snapshot still needs a date column; use today if Form 3 left it blank so we can record the choice.
    const claimedStartDate = toDateOnly(row.startDate) ?? new Date().toISOString().slice(0, 10)
    const claimedEndDate = toDateOnly(row.endDate ?? undefined)
    const now = new Date().toISOString()

    const { data: newRequest, error: insertError } = await supabase
      .from('employment_verification_requests')
      .insert({
        driver_id: userId,
        employment_id: verificationKey,
        requesting_company_id: null,
        initiated_by: 'applicant',
        applicant_type: applicantType,
        previous_employer_name: row.companyName ?? '',
        previous_employer_email: row.supervisorEmail ?? null,
        previous_employer_phone: row.supervisorPhone ?? null,
        previous_employer_address: row.location ?? null,
        claimed_position: row.position ?? '',
        claimed_start_date: claimedStartDate,
        claimed_end_date: claimedEndDate,
        claimed_reason_for_leaving: row.reasonForLeaving ?? null,
        status: 'DRIVER_SEND_DECLINED',
        attempt_count: 0,
        next_attempt_at: null,
        finalized_at: now,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[EVR DECLINE] Insert error:', insertError.code, insertError.message)
      if (insertError.code === '23514' || insertError.message?.includes('check constraint')) {
        return NextResponse.json(
          { error: 'Database needs migration 109 (driver send declined). Run Supabase migrations.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'Failed to record decline' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      verificationRequest: rowToVerificationRequest(
        newRequest as VerificationRequestRow,
        'Self-Initiated',
      ),
    })
  } catch (error) {
    console.error('[EVR DECLINE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
