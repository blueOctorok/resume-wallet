import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getAppBaseUrl } from '@/lib/app-url'
import {
  askTaskDetail,
  askTaskLabel,
  isAskTaskId,
  sendDriverAskEmail,
  type RecruiterAskTaskId,
} from '@/lib/recruiter-ask'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,80}$/
const MAX_NOTE = 1000

interface AskRow {
  token: string
  company_id: string
  driver_user_id: string
  driver_name: string
  note: string
  tasks: string[]
  created_by_user_id: string | null
  expires_at: string
  sent_at: string | null
  sent_tasks: string[] | null
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

async function loadAsk(token: string): Promise<AskRow | null> {
  if (!TOKEN_RE.test(token)) return null
  const supabase = await getAdminSupabaseClient()
  const { data, error } = await supabase
    .from('recruiter_asks')
    .select('token, company_id, driver_user_id, driver_name, note, tasks, created_by_user_id, expires_at, sent_at, sent_tasks')
    .eq('token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as AskRow | null) ?? null
}

/**
 * GET /api/ask/[token]
 * The page a recruiter opens from the email. No account. No driver contact details.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const ask = await loadAsk(token)
    if (!ask) return NextResponse.json({ error: 'This link is not valid.' }, { status: 404 })

    const supabase = await getAdminSupabaseClient()
    const { data: company } = await supabase.from('companies').select('company_name').eq('id', ask.company_id).maybeSingle()
    const companyName = (company as { company_name?: string } | null)?.company_name?.trim() || 'Your company'
    const tasks = ask.tasks.filter(isAskTaskId)
    const expired = Date.parse(ask.expires_at) < Date.now()

    return NextResponse.json({
      companyName,
      driverName: ask.driver_name,
      firstName: firstName(ask.driver_name),
      note: ask.note,
      tasks: tasks.map((id) => ({ id, label: askTaskLabel(id), detail: askTaskDetail(id) })),
      expired,
      sent: Boolean(ask.sent_at),
    })
  } catch (error) {
    console.error('[RECRUITER ASK] Load error:', error)
    return NextResponse.json({ error: 'Could not open this link.' }, { status: 500 })
  }
}

/**
 * POST /api/ask/[token]
 * Sends the driver one email with the steps the recruiter checked.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const ask = await loadAsk(token)
    if (!ask) return NextResponse.json({ error: 'This link is not valid.' }, { status: 404 })
    if (ask.sent_at) return NextResponse.json({ error: 'This was already sent.' }, { status: 409 })
    if (Date.parse(ask.expires_at) < Date.now()) return NextResponse.json({ error: 'This link has expired.' }, { status: 410 })

    const body = (await request.json().catch(() => null)) as { tasks?: unknown; message?: unknown } | null
    const allowed = new Set(ask.tasks.filter(isAskTaskId))
    const picked = Array.isArray(body?.tasks)
      ? body.tasks.filter((task): task is RecruiterAskTaskId => typeof task === 'string' && isAskTaskId(task) && allowed.has(task))
      : []
    if (picked.length === 0) return NextResponse.json({ error: 'Pick at least one step.' }, { status: 400 })
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, MAX_NOTE) : ''

    const supabase = await getAdminSupabaseClient()
    // Claim the ticket before sending so a second tap cannot email the driver twice.
    const { data: claimed } = await supabase
      .from('recruiter_asks')
      .update({ sent_at: new Date().toISOString(), sent_tasks: picked, recruiter_message: message || null })
      .eq('token', token)
      .is('sent_at', null)
      .select('token')
      .maybeSingle()
    if (!claimed) return NextResponse.json({ error: 'This was already sent.' }, { status: 409 })

    const { data: company } = await supabase.from('companies').select('company_name').eq('id', ask.company_id).maybeSingle()
    const companyName = (company as { company_name?: string } | null)?.company_name?.trim() || 'Your company'

    try {
      await sendDriverAskEmail(supabase, {
        companyId: ask.company_id,
        companyName,
        createdByUserId: ask.created_by_user_id,
        driverUserId: ask.driver_user_id,
        driverName: ask.driver_name,
        tasks: picked,
        recruiterMessage: message,
        baseUrl: getAppBaseUrl(request),
      })
    } catch (sendError) {
      await supabase
        .from('recruiter_asks')
        .update({ sent_at: null, sent_tasks: null, recruiter_message: null })
        .eq('token', token)
      throw sendError
    }

    return NextResponse.json({ success: true, firstName: firstName(ask.driver_name) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send'
    console.error('[RECRUITER ASK] Send error:', error)
    const status = message === 'This driver has no email on file.' ? 400 : 500
    return NextResponse.json({ error: status === 400 ? message : 'Could not send. Try again.' }, { status })
  }
}
