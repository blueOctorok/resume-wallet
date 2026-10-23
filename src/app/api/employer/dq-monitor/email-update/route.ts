import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { buildEmail } from '@/lib/email-template'
import { sendEmail } from '@/lib/messaging'
import { isEmailAddress } from '@/lib/recruiter-inboxes'

const MAX_MESSAGE = 2000

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
      message?: unknown
    } | null
    const to = typeof body?.to === 'string' ? body.to.trim().toLowerCase() : ''
    if (!isEmailAddress(to)) return NextResponse.json({ error: 'Enter an email address' }, { status: 400 })

    const driverName = typeof body?.driverName === 'string' ? body.driverName.trim().slice(0, 200) : ''
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE) : ''
    if (!driverName || !message) return NextResponse.json({ error: 'Pick a driver first' }, { status: 400 })

    const { data: company } = await supabase.from('companies').select('company_name').eq('id', ctx.companyId).maybeSingle()
    const companyName = (company as { company_name?: string } | null)?.company_name?.trim() || 'Your company'

    const html = buildEmail({
      headerEyebrow: companyName,
      headerTitle: driverName,
      preheader: message.slice(0, 140),
      bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.6;color:#173150;">${esc(message).replace(/\n/g, '<br>')}</p>`,
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
