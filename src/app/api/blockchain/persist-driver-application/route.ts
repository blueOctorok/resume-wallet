import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'

export async function POST(request: NextRequest) {
  try {
    const {
      userAddress,
      applicationHash,
      ipfsHash,
      transactionHash,
      applicationId,
      blockNumber,
    } = await request.json()

    if (!userAddress || !applicationHash || !transactionHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS (we validate wallet address server-side)
    const supabase = await getAdminSupabaseClient()

    // Get user_id (case-insensitive)
    const userRow = await getUserByWallet(supabase, userAddress)
    if (!userRow) {
      return NextResponse.json(
        { error: 'User not found for wallet address' },
        { status: 404 }
      )
    }

    // Find existing application by user_id and application_hash (preferred) or just user_id (fallback)
    let existing = null
    
    // First try to find by application_hash (most accurate)
    if (applicationHash) {
      const { data: hashMatch } = await supabase
        .from('driver_applications')
        .select('id')
        .eq('user_id', userRow.id)
        .eq('application_hash', applicationHash)
        .maybeSingle()
      existing = hashMatch
    }
    
    // If not found by hash, find most recent application for this user (fallback)
    if (!existing) {
      const { data: userMatch } = await supabase
        .from('driver_applications')
        .select('id')
        .eq('user_id', userRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      existing = userMatch
    }

    if (!existing) {
      // Application not found - this shouldn't happen if completeDriverApplicationClient was called first
      console.error('⚠️ [PERSIST] Application not found for user, creating new record without application_data')
      const { error: insertError } = await supabase.from('driver_applications').insert({
        user_id: userRow.id,
        application_hash: applicationHash || null,
        ipfs_hash: ipfsHash || null,
        blockchain_tx_hash: transactionHash,
        blockchain_application_id: applicationId ? String(applicationId) : null,
        verification_status: 'SUBMITTED',
        application_data: {}, // Empty data - this is a fallback, should not happen
      })
      if (insertError) {
        console.error('❌ [PERSIST] Failed to insert fallback record:', insertError)
        return NextResponse.json(
          { error: 'Failed to persist blockchain data' },
          { status: 500 }
        )
      }
    } else {
      // Update existing application with blockchain data
      const updateData: any = {
        ipfs_hash: ipfsHash || null,
        blockchain_tx_hash: transactionHash,
        blockchain_application_id: applicationId ? String(applicationId) : null,
        verification_status: 'SUBMITTED',
        updated_at: new Date().toISOString(),
      }
      
      // Update application_hash if it was null (in case it wasn't set during completion)
      if (applicationHash) {
        updateData.application_hash = applicationHash
      }
      
      const { error: updateError } = await supabase
        .from('driver_applications')
        .update(updateData)
        .eq('id', existing.id)
        
      if (updateError) {
        console.error('❌ [PERSIST] Failed to update application:', updateError)
        return NextResponse.json(
          { error: 'Failed to persist blockchain data' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ ok: true, blockNumber })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Persist failed', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}


