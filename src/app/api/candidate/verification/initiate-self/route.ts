import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  VerificationRequestRow,
  rowToVerificationRequest,
} from '@/types/employment-verification'
import { sendVerificationEmail } from '@/lib/send-verification-email'
import { getAppBaseUrl } from '@/lib/app-url'
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
 * POST /api/candidate/verification/initiate-self
 *
 * Optional career-card boost: email a past employer to confirm dates (voluntary for them).
 * Body: { verificationKey, previousEmployerEmail?, previousEmployerPhone? }
 * verificationKey format: driver:id | developer:id | general:id
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json()
    const { verificationKey, previousEmployerEmail, previousEmployerPhone } = body as {
      verificationKey?: string
      previousEmployerEmail?: string
      previousEmployerPhone?: string
    }

    if (!verificationKey || typeof verificationKey !== 'string') {
      return NextResponse.json({ error: 'verificationKey is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const employments = await getMergedCandidateEmployments(supabase, user.id)
    const row = employments.find((e) => e.verificationKey === verificationKey)

    if (!row) {
      return NextResponse.json(
        { error: 'Employment entry not found. Add work history via resume or DOT application first.' },
        { status: 404 },
      )
    }

    const contactEmail = previousEmployerEmail ?? row.supervisorEmail ?? null
    const contactPhone = previousEmployerPhone ?? row.supervisorPhone ?? null

    if (!contactEmail && !contactPhone) {
      return NextResponse.json(
        {
          error: 'No contact information for previous employer. Please provide an email or phone number.',
          needsContactInfo: true,
        },
        { status: 400 },
      )
    }

    const claimedStartDate = toDateOnly(row.startDate)
    if (!claimedStartDate) {
      return NextResponse.json(
        {
          error: 'Start date for this employment is missing or invalid. Update the job dates in your resume or DOT application.',
        },
        { status: 400 },
      )
    }
    const claimedEndDate = toDateOnly(row.endDate ?? undefined)

    const applicantType = applicantTypeForSource(row.source)

    const { data: existingRequest } = await supabase
      .from('employment_verification_requests')
      .select('id, status')
      .eq('driver_id', user.id)
      .eq('employment_id', verificationKey)
      .eq('initiated_by', 'applicant')
      .eq('applicant_type', applicantType)
      .not('status', 'in', '("ATTEMPTS_EXHAUSTED","VERIFICATION_DENIED","VERIFICATION_DECLINED")')
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'You already have a verification in progress for this employment',
          existingRequestId: existingRequest.id,
          status: existingRequest.status,
        },
        { status: 409 },
      )
    }

    const insertData = {
      driver_id: user.id,
      employment_id: verificationKey,
      requesting_company_id: null,
      initiated_by: 'applicant',
      applicant_type: applicantType,
      previous_employer_name: row.companyName ?? '',
      previous_employer_email: contactEmail,
      previous_employer_phone: contactPhone,
      previous_employer_address: row.location ?? null,
      claimed_position: row.position ?? '',
      claimed_start_date: claimedStartDate,
      claimed_end_date: claimedEndDate,
      claimed_reason_for_leaving: row.reasonForLeaving ?? null,
      status: 'VERIFICATION_REQUESTED',
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('employment_verification_requests')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('[CANDIDATE VERIFICATION] Create error:', insertError.code, insertError.message)
      if (insertError.code === '23514' || insertError.message?.includes('check constraint')) {
        return NextResponse.json(
          { error: 'Database needs migration 063 (applicant_type general). Run Supabase migrations.' },
          { status: 503 },
        )
      }
      if (insertError.code === '42703' || insertError.message?.includes('column')) {
        return NextResponse.json(
          { error: 'Verification system needs update. Run migrations 015 and 063.' },
          { status: 503 },
        )
      }
      if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Verification system not set up. Run database migration.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'Failed to create verification request' }, { status: 500 })
    }

    const verificationRequest = rowToVerificationRequest(
      newRequest as VerificationRequestRow,
      'Self-Initiated',
    )

    const token = (newRequest as { verification_token?: string }).verification_token
    if (!contactEmail) {
      console.log('[CANDIDATE VERIFICATION] No contact email – skipping send')
    } else if (!token) {
      console.warn('[CANDIDATE VERIFICATION] No verification_token – skipping send')
    } else {
      const verificationLink = `${getAppBaseUrl(request)}/verify/${token}`
      const emailResult = await sendVerificationEmail({
        to: contactEmail,
        verificationLink,
        previousEmployerName: row.companyName ?? '',
        claimedPosition: row.position ?? '',
        claimedCompanyName: row.companyName ?? '',
        claimedStartDate: claimedStartDate ?? undefined,
        claimedEndDate: claimedEndDate ?? null,
      })
      if (!emailResult.ok) {
        console.warn('[CANDIDATE VERIFICATION] Email send failed:', emailResult.error)
      }
    }

    return NextResponse.json({
      success: true,
      verificationRequest,
      message: `Verification request created for ${row.companyName}. We'll email your contact to confirm dates if possible.`,
    })
  } catch (error) {
    console.error('[CANDIDATE VERIFICATION] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
