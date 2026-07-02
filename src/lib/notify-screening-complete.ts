import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/create-notification'
import {
  sendCandidateScreeningReadyEmail,
  sendEmployerScreeningReadyEmail,
} from '@/lib/send-admin-notification'

const appBase = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://zknight.io').replace(/\/$/, '')

function candidateDeepLink(kind: 'mvr' | 'psp'): string {
  const page = kind === 'mvr' ? 'mvr' : 'psp'
  return `${appBase()}/?onboard=${page}`
}

function employerDeepLink(): string {
  return `${appBase()}/?onboard=applicants`
}

function isEmployerInitiatedRow(row: {
  ordered_by_company_id?: string | null
  ordered_by_user_id?: string | null
  ordered_by_employer?: boolean | null
  employer_company_id?: string | null
  employer_user_id?: string | null
}): boolean {
  return Boolean(
    row.ordered_by_company_id ||
      row.ordered_by_user_id ||
      row.employer_company_id ||
      row.employer_user_id ||
      row.ordered_by_employer === true,
  )
}

/**
 * After Accio posts a terminal MVR/PSP result, notify the candidate (always) and
 * the employer contact (only when the order was company-initiated).
 *
 * Call only on the first transition from `pending` → completed/needs_review so
 * Accio retries do not duplicate emails.
 */
export async function notifyScreeningReportDelivered(
  supabase: SupabaseClient,
  params: {
    kind: 'mvr' | 'psp'
    /** Status loaded before the webhook updated the row — must be `pending` to send */
    previousStatus: string
    driverUserId: string
    ordered_by_company_id?: string | null
    ordered_by_user_id?: string | null
    ordered_by_employer?: boolean | null
    employer_company_id?: string | null
    employer_user_id?: string | null
  },
): Promise<void> {
  if (params.previousStatus !== 'pending') return

  const { kind, driverUserId } = params

  try {
    const { data: candUser, error: cuErr } = await supabase
      .from('users')
      .select('email')
      .eq('id', driverUserId)
      .maybeSingle()

    if (cuErr || !candUser) {
      console.warn('[SCREENING NOTIFY] Candidate user missing; aborting notify', { driverUserId, cuErr })
      return
    }

    const candEmail = candUser.email?.trim() || null

    const { data: candProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', driverUserId)
      .maybeSingle()

    const firstName = (candProfile?.first_name ?? '').trim() || 'there'
    const displayName =
      [candProfile?.first_name, candProfile?.last_name].filter(Boolean).join(' ').trim() ||
      (candEmail ? candEmail.split('@')[0] : '') ||
      'Candidate'

    const candCta = candidateDeepLink(kind)
    const labelShort = kind === 'mvr' ? 'MVR' : 'PSP report'

    if (candEmail) {
      await sendCandidateScreeningReadyEmail({
        kind,
        candidateEmail: candEmail,
        candidateFirstName: firstName,
        ctaUrl: candCta,
      })
    } else {
      console.warn('[SCREENING NOTIFY] No candidate email on file; in-app only', { driverUserId })
    }

    await createNotification({
      userId: driverUserId,
      type: 'system',
      title: `${labelShort} ready`,
      body:
        kind === 'mvr'
          ? 'Your motor vehicle record has finished processing. Open your MVR block to review.'
          : 'Your FMCSA PSP report has finished processing. Open your PSP block to review.',
      data: { kind, screeningKind: kind },
      actionUrl: candCta,
    })

    const row = {
      ordered_by_company_id: params.ordered_by_company_id,
      ordered_by_user_id: params.ordered_by_user_id,
      ordered_by_employer: params.ordered_by_employer,
      employer_company_id: params.employer_company_id,
      employer_user_id: params.employer_user_id,
    }

    if (!isEmployerInitiatedRow(row)) return

    const companyId = params.ordered_by_company_id ?? params.employer_company_id ?? null
    let companyName = 'Your company'
    let employerNotifyUserId: string | null =
      params.ordered_by_user_id ?? params.employer_user_id ?? null

    if (companyId) {
      const { data: comp } = await supabase
        .from('companies')
        .select('company_name, employer_user_id')
        .eq('id', companyId)
        .maybeSingle()
      if (comp?.company_name) companyName = comp.company_name
      if (!employerNotifyUserId && comp?.employer_user_id) {
        employerNotifyUserId = comp.employer_user_id
      }
    }

    if (!employerNotifyUserId) {
      console.warn('[SCREENING NOTIFY] Employer-initiated order but no employer user to notify', {
        companyId,
        kind,
      })
      return
    }

    const { data: empUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', employerNotifyUserId)
      .maybeSingle()

    if (!empUser?.email?.trim()) {
      console.warn('[SCREENING NOTIFY] Employer user has no email', { employerNotifyUserId })
      return
    }

    const { data: empProfile } = await supabase
      .from('user_profiles')
      .select('first_name')
      .eq('user_id', employerNotifyUserId)
      .maybeSingle()

    const empFirst = (empProfile?.first_name ?? '').trim() || 'there'
    const empCta = employerDeepLink()

    await sendEmployerScreeningReadyEmail({
      kind,
      employerEmail: empUser.email.trim(),
      employerFirstName: empFirst,
      companyName,
      candidateDisplayName: displayName,
      ctaUrl: empCta,
    })

    await createNotification({
      userId: employerNotifyUserId,
      type: 'system',
      title: `${labelShort} ready for ${displayName}`,
      body:
        kind === 'mvr'
          ? `The MVR you requested for ${displayName} has finished processing.`
          : `The FMCSA PSP report you requested for ${displayName} has finished processing.`,
      data: { kind, screeningKind: kind, candidateUserId: driverUserId },
      actionUrl: empCta,
    })
  } catch (err) {
    console.warn('[SCREENING NOTIFY] Non-fatal error:', err)
  }
}
