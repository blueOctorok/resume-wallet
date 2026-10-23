import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { buildEmail } from '@/lib/email-template'
import { sendEmail } from '@/lib/messaging'
import { isEmailAddress } from '@/lib/recruiter-inboxes'
import { getAppBaseUrl } from '@/lib/app-url'
import { loadDriverFileDetail, loadDqMonitorCandidateIds } from '@/lib/dq-file-load'
import { ASK_TTL_DAYS, askPageUrl, newAskToken, offerableAskTasks } from '@/lib/recruiter-ask'
import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_MESSAGE = 2000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The button in the recruiter email. Missing when the driver has no account,
 * is not on this company's board, or has no step left that is theirs to do.
 */
async function createAskLink(
  supabase: SupabaseClient,
  request: NextRequest,
  input: { companyId: string; createdByUserId: string; driverUserId: string; driverName: string; note: string },
): Promise<string | null> {
  if (!UUID_RE.test(input.driverUserId)) return null
  try {
    const { ids } = await loadDqMonitorCandidateIds(supabase, input.companyId)
    if (!ids.includes(input.driverUserId)) return null
    const { dqFile } = await loadDriverFileDetail(supabase, input.companyId, input.driverUserId)
    const tasks = offerableAskTasks(dqFile.items)
    if (tasks.length === 0) return null
    const token = newAskToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + ASK_TTL_DAYS)
    const { error } = await supabase.from('recruiter_asks').insert({
      token,
      company_id: input.companyId,
      driver_user_id: input.driverUserId,
      driver_name: input.driverName,
      note: input.note,
      tasks,
      created_by_user_id: input.createdByUserId,
      expires_at: expiresAt.toISOString(),
    })
    if (error) {
      console.error('[DQ EMAIL] Ask link skipped:', error.message)
      return null
    }
    return askPageUrl(token, getAppBaseUrl(request))
  } catch (error) {
    console.error('[DQ EMAIL] Ask link skipped:', error)
    return null
  }
}

/**
 * POST /api/employer/dq-monitor/email-update
 *
 * One driver, one recruiter. The message is the short status note she
 * reviewed in the modal. Nothing sends until she presses Send.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const supabase = await getAdminSupabaseClient()
    const ctx = await resolveEmployerCompanyForWallet(supabase, userId)
    if (!ctx) return NextResponse.json({ error: 'No company access' }, { status: 403 })

    const body = (await request.json().catch(() => null)) as {
      to?: unknown
      driverName?: unknown
      driverUserId?: unknown
      message?: unknown
    } | null
    const to = typeof body?.to === 'string' ? body.to.trim().toLowerCase() : ''
    if (!isEmailAddress(to)) return NextResponse.json({ error: 'Enter an email address' }, { status: 400 })

    const driverName = typeof body?.driverName === 'string' ? body.driverName.trim().slice(0, 200) : ''
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE) : ''
    if (!driverName || !message) return NextResponse.json({ error: 'Pick a driver first' }, { status: 400 })

    const { data: company } = await supabase.from('companies').select('company_name').eq('id', ctx.companyId).maybeSingle()
    const companyName = (company as { company_name?: string } | null)?.company_name?.trim() || 'Your company'

    const askUrl = await createAskLink(supabase, request, {
      companyId: ctx.companyId,
      createdByUserId: userId,
      driverUserId: typeof body?.driverUserId === 'string' ? body.driverUserId : '',
      driverName,
      note: message,
    })

    const html = buildEmail({
      headerEyebrow: companyName,
      headerTitle: driverName,
      preheader: message.slice(0, 140),
      bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.6;color:#173150;">${esc(message).replace(/\n/g, '<br>')}</p>${
        askUrl
          ? '<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#64748b;">Open the button to send them the steps they still owe. No sign-in.</p>'
          : ''
      }`,
      ctaLabel: askUrl ? 'Ask them to finish a step' : undefined,
      ctaUrl: askUrl ?? undefined,
      footerNote: `Sent from Provven by ${companyName}. This note is for your recruiting team.`,
    })

    const result = await sendEmail({
      type: 'driver_status_update',
      to,
      subject: `${companyName}: ${driverName}`,
      html,
    })
    if (!result.ok) return NextResponse.json({ error: result.error || 'Could not send' }, { status: 502 })

    console.log(`[DQ EMAIL] ${companyName} sent a status note about ${driverName} to ${to}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DQ EMAIL] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
