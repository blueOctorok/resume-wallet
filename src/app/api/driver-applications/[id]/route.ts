import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * DELETE /api/driver-applications/[id]
 * Delete a DOT application (only if not yet verified on blockchain)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.log('[DOT DELETE] Deleting application:', id, 'for user:', userId)

    const supabase = await getAdminSupabaseClient()

    // Get the application to verify ownership and blockchain status
    const { data: application, error: appError } = await supabase
      .from('driver_applications')
      .select('id, user_id, blockchain_tx_hash')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Don't allow deleting applications that are already on blockchain
    if (application.blockchain_tx_hash) {
      return NextResponse.json(
        { 
          error: 'Cannot delete verified application',
          details: 'This application has been verified on the blockchain and cannot be deleted.'
        },
        { status: 403 }
      )
    }

    // Delete the application
    const { error: deleteError } = await supabase
      .from('driver_applications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('[DOT DELETE] Failed to delete:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete application', details: deleteError.message },
        { status: 500 }
      )
    }

    console.log('[DOT DELETE] Application deleted successfully')

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[DOT DELETE] Error:', error)
    return NextResponse.json(
      {
        error: 'Delete failed',
        details: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
