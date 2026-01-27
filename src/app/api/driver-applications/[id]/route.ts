import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

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
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      )
    }

    console.log('[DOT DELETE] Deleting application:', id, 'for wallet:', walletAddress)

    const supabase = await getAdminSupabaseClient()

    // Get user_id from wallet address
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get the application to verify ownership and blockchain status
    const { data: application, error: appError } = await supabase
      .from('driver_applications')
      .select('id, user_id, blockchain_tx_hash')
      .eq('id', id)
      .eq('user_id', userData.id)
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
      .eq('user_id', userData.id)

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
