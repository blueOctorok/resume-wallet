import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * GET /api/messages/[threadId]
 *
 * Returns all messages in the thread oldest-first. Also marks every
 * unread message sent by the OTHER participant as read.
 *
 * POST /api/messages/[threadId]
 *
 * Sends a new message to the thread, updates last_message_at/preview on
 * the thread, and creates a notification for the other participant.
 */

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await params

    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Verify user is a participant
    const { data: thread } = await supabase
      .from('message_threads')
      .select('id, subject, participant_a_user_id, participant_b_user_id, application_id, candidate_request_id')
      .eq('id', threadId)
      .maybeSingle()

    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

    const isParticipant =
      thread.participant_a_user_id === userId ||
      thread.participant_b_user_id === userId

    if (!isParticipant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch messages oldest-first
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('id, sender_user_id, body, read_at, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[THREAD GET] Messages error:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Mark unread messages from the other participant as read (fire-and-forget)
    const unreadIds = (msgs || [])
      .filter(m => m.sender_user_id !== userId && !m.read_at)
      .map(m => m.id)

    if (unreadIds.length > 0) {
      supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
        .then(() => {/* non-critical */})
    }

    // Get the other participant's display info for context
    const otherId =
      thread.participant_a_user_id === userId
        ? thread.participant_b_user_id
        : thread.participant_a_user_id

    const { data: otherUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', otherId)
      .single()

    let otherName = 'Unknown'
    let otherAvatarUrl: string | null = null

    if (otherUser?.role === 'employer') {
      const { data: company } = await supabase
        .from('companies')
        .select('company_name')
        .eq('employer_user_id', otherId)
        .maybeSingle()
      if (company) otherName = company.company_name
    } else {
      const { data: up } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, avatar_url')
        .eq('user_id', otherId)
        .maybeSingle()
      if (up) {
        otherName = [up.first_name, up.last_name].filter(Boolean).join(' ') || 'Unknown'
        otherAvatarUrl = up.avatar_url ?? null
      }
    }

    return NextResponse.json({
      thread: {
        id: thread.id,
        subject: thread.subject,
        applicationId: thread.application_id,
        candidateRequestId: thread.candidate_request_id,
        otherParticipant: {
          userId: otherId,
          name: otherName,
          role: otherUser?.role,
          avatarUrl: otherAvatarUrl,
        },
      },
      messages: (msgs || []).map(m => ({
        id: m.id,
        senderId: m.sender_user_id,
        body: m.body,
        readAt: m.read_at,
        createdAt: m.created_at,
        isMine: m.sender_user_id === userId,
      })),
    })
  } catch (err) {
    console.error('[THREAD GET] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await params

    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { body: messageBody }: { body: string } = await request.json()

    if (!messageBody?.trim()) {
      return NextResponse.json({ error: 'Message body required' }, { status: 400 })
    }
    if (messageBody.length > 4000) {
      return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // CASE 3: the notification sender name needs the user's role, so we still load the row by id.
    const { data: user } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Verify participation
    const { data: thread } = await supabase
      .from('message_threads')
      .select('id, subject, participant_a_user_id, participant_b_user_id')
      .eq('id', threadId)
      .maybeSingle()

    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

    const isParticipant =
      thread.participant_a_user_id === user.id ||
      thread.participant_b_user_id === user.id
    if (!isParticipant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const otherId =
      thread.participant_a_user_id === user.id
        ? thread.participant_b_user_id
        : thread.participant_a_user_id

    // Insert the message
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        sender_user_id: user.id,
        body: messageBody.trim(),
      })
      .select('id, sender_user_id, body, read_at, created_at')
      .single()

    if (insertError || !newMessage) {
      console.error('[THREAD POST] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Denormalise onto the thread row for fast inbox queries
    const preview = messageBody.trim().slice(0, 120)
    await supabase
      .from('message_threads')
      .update({
        last_message_at: newMessage.created_at,
        last_message_preview: preview,
      })
      .eq('id', threadId)

    // Resolve sender display name for the notification title
    let senderName = 'Someone'
    if (user.role === 'employer') {
      const { data: company } = await supabase
        .from('companies')
        .select('company_name')
        .eq('employer_user_id', user.id)
        .maybeSingle()
      if (company) senderName = company.company_name
    } else {
      const { data: up } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle()
      if (up) {
        senderName = [up.first_name, up.last_name].filter(Boolean).join(' ') || senderName
      }
    }

    // Create a notification for the recipient (picked up by existing 15s poll)
    await supabase.from('notifications').insert({
      user_id: otherId,
      type: 'new_message',
      title: `New message from ${senderName}`,
      body: preview,
      data: { threadId, senderId: user.id, senderName },
      action_url: null, // client navigates via data.threadId
    })

    return NextResponse.json({
      message: {
        id: newMessage.id,
        senderId: newMessage.sender_user_id,
        body: newMessage.body,
        readAt: newMessage.read_at,
        createdAt: newMessage.created_at,
        isMine: true,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[THREAD POST] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
