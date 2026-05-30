import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/dot-apps/[id]
 * Get detailed DOT application information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: app, error } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Get user info
    const [{ data: user }, { data: up }] = await Promise.all([
      supabase.from('users').select('wallet_address, email').eq('id', app.user_id).single(),
      supabase.from('user_profiles').select('first_name, last_name').eq('user_id', app.user_id).maybeSingle(),
    ])

    const profileName = [up?.first_name, up?.last_name].filter(Boolean).join(' ').trim() || null

    return NextResponse.json({
      success: true,
      dotApp: {
        ...app,
        walletAddress: user?.wallet_address,
        email: user?.email,
        userName: profileName,
      },
    })

  } catch (error) {
    console.error('[ADMIN DOT APP DETAIL] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/dot-apps/[id]
 * Delete a specific DOT application
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    // Verify app exists
    const { data: app, error: findError } = await supabase
      .from('driver_applications')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (findError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Null out the FK in `applications` before deleting so we don't lose
    // pipeline records — we only want to remove the DOT document itself.
    await supabase
      .from('applications')
      .update({ driver_application_id: null })
      .eq('driver_application_id', id)

    // Delete the application
    const { error: deleteError } = await supabase
      .from('driver_applications')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN DOT APP DELETE] Error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 })
    }

    console.log(`[ADMIN] DOT app deleted: ${id} by admin: ${auth.email}`)

    return NextResponse.json({
      success: true,
      message: `DOT application ${id} deleted`,
    })

  } catch (error) {
    console.error('[ADMIN DOT APP DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
