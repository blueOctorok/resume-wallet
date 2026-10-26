import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendEmail } from '@/lib/messaging'
import { buildEmail } from '@/lib/email-template'

export const dynamic = 'force-dynamic'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * POST /api/admin/support/[id]/reply
 * Sends a reply to the person who wrote in, and keeps that reply on the thread.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params
  const body = (await request.json().catch(() => null)) as { body?: unknown } | null
  const text = typeof body?.body === 'string' ? body.body.trim() : ''
  if (text.length < 1 || text.length > 5000) {
    return NextResponse.json({ error: 'Write a reply of 1 to 5000 characters.' }, { status: 400 })
  }

  try {
    const supabase = await getAdminSupabaseClient()
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, from_email, subject')
      .eq('id', id)
      .eq('direction', 'inbound')
      .is('parent_id', null)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const subject = String(data.subject ?? '').trim()
    const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject || 'your message to Provven'}`
    const html = buildEmail({
      headerTitle: 'Provven support',
      bodyHtml: `<p style="margin:0;color:#173150;font-size:15px;line-height:1.6;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
      footerNote: 'Reply to this email and it comes back to Provven support.',
    })

    const sent = await sendEmail({
      type: 'support_reply',
      to: data.from_email as string,
      subject: replySubject,
      html,
      // A reply to this note is delivered to the address Pingram already catches,
      // so it files back onto this thread instead of the product sender.
      replyToAddresses: ['support@verify.provven.com'],
    })
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error || 'Could not send the reply' }, { status: 502 })
    }

    const now = new Date().toISOString()
    const { error: insertError } = await supabase.from('support_messages').insert({
      direction: 'outbound',
      parent_id: id,
      from_email: 'support@provven.com',
      from_name: 'Provven support',
      to_email: data.from_email,
      subject: replySubject,
      body_text: text,
      received_at: now,
      read_at: now,
    })
    if (insertError) {
      console.error('[ADMIN SUPPORT] reply saved send but not the row:', insertError)
    }

    await supabase.from('support_messages').update({ read_at: now }).eq('id', id).is('read_at', null)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ADMIN SUPPORT] reply', err)
    return NextResponse.json({ error: 'Could not send the reply' }, { status: 500 })
  }
}
