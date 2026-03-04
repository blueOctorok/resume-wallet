import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/outreach/[id]
 * Get detailed outreach invite information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: invite, error } = await supabase
      .from('application_invites')
      .select(`
        *,
        companies(*),
        job_postings(*)
      `)
      .eq('id', id)
      .single()

    if (error || !invite) {
      return NextResponse.json({ error: 'Outreach invite not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      invite,
    })

  } catch (error) {
    console.error('[ADMIN OUTREACH DETAIL] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/outreach/[id]
 * Update outreach invite status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()
    const body = await request.json()
    const { status } = body

    const validStatuses = ['pending', 'viewed', 'in_progress', 'completed', 'cancelled', 'expired']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: invite, error } = await supabase
      .from('application_invites')
      .update({ 
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN OUTREACH UPDATE] Error:', error)
      return NextResponse.json({ error: 'Failed to update outreach invite' }, { status: 500 })
    }

    console.log(`[ADMIN] Outreach ${id} status updated to ${status} by admin: ${auth.walletAddress}`)

    return NextResponse.json({
      success: true,
      invite,
    })

  } catch (error) {
    console.error('[ADMIN OUTREACH UPDATE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/outreach/[id]
 * Delete an outreach invite
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    // Get invite details for logging
    const { data: invite, error: findError } = await supabase
      .from('application_invites')
      .select(`
        id, candidate_name, candidate_email, status,
        companies(company_name)
      `)
      .eq('id', id)
      .single()

    if (findError || !invite) {
      return NextResponse.json({ error: 'Outreach invite not found' }, { status: 404 })
    }

    // Delete the invite
    const { error: deleteError } = await supabase
      .from('application_invites')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN OUTREACH DELETE] Error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete outreach invite' }, { status: 500 })
    }

    const candidateName = invite.candidate_name || invite.candidate_email || 'Unknown'
    const companyName = (invite as any).companies?.company_name || 'Unknown Company'

    console.log(`[ADMIN] Outreach invite deleted: ${id} (to ${candidateName} from ${companyName}) by admin: ${auth.walletAddress}`)

    return NextResponse.json({
      success: true,
      message: `Outreach invite to "${candidateName}" from ${companyName} deleted`,
    })

  } catch (error) {
    console.error('[ADMIN OUTREACH DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
