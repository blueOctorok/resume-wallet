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
  const auth = requireAdmin(request)
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
    const { data: user } = await supabase
      .from('users')
      .select('wallet_address, email, name')
      .eq('id', app.user_id)
      .single()

    return NextResponse.json({
      success: true,
      dotApp: {
        ...app,
        walletAddress: user?.wallet_address,
        email: user?.email,
        userName: user?.name,
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
  const auth = requireAdmin(request)
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

    // Delete the application
    const { error: deleteError } = await supabase
      .from('driver_applications')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN DOT APP DELETE] Error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 })
    }

    console.log(`[ADMIN] DOT app deleted: ${id} by admin: ${auth.walletAddress}`)

    return NextResponse.json({
      success: true,
      message: `DOT application ${id} deleted`,
    })

  } catch (error) {
    console.error('[ADMIN DOT APP DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
