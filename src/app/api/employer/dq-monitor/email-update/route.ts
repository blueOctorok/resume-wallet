import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { buildEmail } from '@/lib/email-template'
import { sendEmail } from '@/lib/messaging'
import { isRecruiterInbox } from '@/lib/recruiter-inboxes'

const MAX_DRIVERS = 200
const MAX_NOTE = 2000

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
 * HR sends the drivers currently on her board to a recruiter who does not
 * log in. The lines are the same sentences the board is showing.
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
      note?: unknown
      drivers?: unknown
    } | null
    const to = typeof body?.to === 'string' ? body.to.trim().toLowerCase() : ''
    if (!isRecruiterInbox(to)) return NextResponse.json({ error: 'Pick a recruiter from the list' }, { status: 400 })

    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : ''
    const raw = Array.isArray(body?.drivers) ? body.drivers : []
    const drivers = raw
      .filter((row): row is { name: string; line: string } => {
        if (!row || typeof row !== 'object') return false
        const candidate = row as { name?: unknown; line?: unknown }
        return typeof candidate.name === 'string' && typeof candidate.line === 'string'
      })
      .slice(0, MAX_DRIVERS)
      .map((row) => ({ name: row.name.trim().slice(0, 200), line: row.line.trim().slice(0, 500) }))
      .filter((row) => row.name && row.line)

    if (drivers.length === 0) return NextResponse.json({ error: 'Nothing to send' }, { status: 400 })

    const { data: company } = await supabase.from('companies').select('company_name').eq('id', ctx.companyId).maybeSingle()
    const companyName = (company as { company_name?: string } | null)?.company_name?.trim() || 'Your company'

    const list = drivers
      .map(
        (driver) =>
          `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#173150;"><strong>${esc(driver.name)}</strong><br><span style="color:#64748b;">${esc(driver.line)}</span></p>`,
      )
      .join('')
    const noteHtml = note
      ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">${esc(note).replace(/\n/g, '<br>')}</p>`
      : ''

    const html = buildEmail({
      headerEyebrow: companyName,
      headerTitle: 'Driver status',
      preheader: `${drivers.length} driver${drivers.length === 1 ? '' : 's'} from ${companyName}`,
      bodyHtml: `${noteHtml}${list}`,
      footerNote: `Sent from Provven by ${companyName}. This note is for your recruiting team.`,
    })

    const result = await sendEmail({
      type: 'driver_status_update',
      to,
      subject: `${companyName}: driver status (${drivers.length})`,
      html,
    })
    if (!result.ok) return NextResponse.json({ error: result.error || 'Could not send' }, { status: 502 })

    console.log(`[DQ EMAIL] ${companyName} sent ${drivers.length} driver lines to ${to}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DQ EMAIL] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
