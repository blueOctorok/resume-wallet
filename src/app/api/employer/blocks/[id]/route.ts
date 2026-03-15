import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'

/**
 * DELETE /api/employer/blocks/[id]
 *
 * Removes a composable block from the employer hub.
 * Verifies the caller has company membership before allowing the delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Block ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Resolve caller's company
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id as string | null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .maybeSingle()
      companyId = (legacyCompany?.id as string) ?? null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company found for this user' }, { status: 403 })
    }

    // Only delete if the block belongs to this company
    const { error, count } = await supabase
      .from('employer_hub_blocks')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('[EMPLOYER BLOCKS] Delete error:', error)
      return NextResponse.json({ error: 'Failed to remove block' }, { status: 500 })
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[EMPLOYER BLOCKS] DELETE unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
