import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

interface SupportRow {
  id: string
  from_email: string
  from_name: string | null
  subject: string
  received_at: string
  read_at: string | null
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

/**
 * GET /api/admin/support
 * Inbound support mail, newest first. `unread` is the count still unopened.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const search = (searchParams.get('search') ?? '').replace(/[%_,]/g, '').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100)
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0)

  try {
    const supabase = await getAdminSupabaseClient()
    let query = supabase
      .from('support_messages')
      .select('id, from_email, from_name, subject, received_at, read_at', { count: 'exact' })
      .eq('direction', 'inbound')
      .is('parent_id', null)
      .order('received_at', { ascending: false })

    if (search) {
      const pattern = `%${search}%`
      query = query.or(`from_email.ilike.${pattern},from_name.ilike.${pattern},subject.ilike.${pattern}`)
    }

    const [{ data, error, count }, unread] = await Promise.all([
      query.range(offset, offset + limit - 1),
      supabase
        .from('support_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .is('parent_id', null)
        .is('read_at', null),
    ])

    if (missingTable(error) || missingTable(unread.error)) {
      return NextResponse.json(
        { error: 'Support inbox is not set up yet. Apply migration 126_support_messages.sql.' },
        { status: 503 },
      )
    }
    if (error) {
      console.error('[ADMIN SUPPORT]', error)
      return NextResponse.json({ error: 'Could not load support messages' }, { status: 500 })
    }

    const messages = ((data ?? []) as SupportRow[]).map((row) => ({
      id: row.id,
      fromEmail: row.from_email,
      fromName: row.from_name,
      subject: row.subject || '(no subject)',
      receivedAt: row.received_at,
      readAt: row.read_at,
    }))

    return NextResponse.json({ success: true, messages, total: count ?? 0, unread: unread.count ?? 0 })
  } catch (err) {
    console.error('[ADMIN SUPPORT]', err)
    return NextResponse.json({ error: 'Could not load support messages' }, { status: 500 })
  }
}
