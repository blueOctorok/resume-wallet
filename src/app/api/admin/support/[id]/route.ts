import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

interface MessageRow {
  id: string
  direction: string
  from_email: string
  from_name: string | null
  to_email: string
  subject: string
  body_text: string
  received_at: string
  read_at: string | null
}

function toView(row: MessageRow) {
  return {
    id: row.id,
    direction: row.direction,
    fromEmail: row.from_email,
    fromName: row.from_name,
    toEmail: row.to_email,
    subject: row.subject || '(no subject)',
    body: row.body_text,
    receivedAt: row.received_at,
    readAt: row.read_at,
  }
}

/**
 * GET /api/admin/support/[id]
 * One inbound message plus the replies sent from this screen. Opening it marks it read.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, direction, from_email, from_name, to_email, subject, body_text, received_at, read_at')
      .eq('id', id)
      .eq('direction', 'inbound')
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const message = data as MessageRow
    let readAt = message.read_at
    if (!readAt) {
      readAt = new Date().toISOString()
      await supabase.from('support_messages').update({ read_at: readAt }).eq('id', id)
    }

    const { data: replies } = await supabase
      .from('support_messages')
      .select('id, direction, from_email, from_name, to_email, subject, body_text, received_at, read_at')
      .eq('parent_id', id)
      .order('received_at', { ascending: true })

    return NextResponse.json({
      success: true,
      message: toView({ ...message, read_at: readAt }),
      replies: ((replies ?? []) as MessageRow[]).map(toView),
    })
  } catch (err) {
    console.error('[ADMIN SUPPORT]', err)
    return NextResponse.json({ error: 'Could not load the message' }, { status: 500 })
  }
}
