import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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

    const supabase = await createClient()

    // Get user_id
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', userAddress)
      .maybeSingle()

    if (userErr || !userRow) {
      return NextResponse.json(
        { error: 'User not found for wallet address' },
        { status: 404 }
      )
    }

    // Insert application row if not exists, else update
    const { data: existing } = await supabase
      .from('driver_applications')
      .select('id')
      .eq('user_id', userRow.id)
      .eq('application_hash', applicationHash)
      .maybeSingle()

    if (!existing) {
      await supabase.from('driver_applications').insert({
        user_id: userRow.id,
        application_hash: applicationHash,
        ipfs_hash: ipfsHash || null,
        blockchain_tx_hash: transactionHash,
        blockchain_application_id: applicationId ? String(applicationId) : null,
        verification_status: 'SUBMITTED',
      })
    } else {
      await supabase
        .from('driver_applications')
        .update({
          ipfs_hash: ipfsHash || null,
          blockchain_tx_hash: transactionHash,
          blockchain_application_id: applicationId ? String(applicationId) : null,
          verification_status: 'SUBMITTED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }

    return NextResponse.json({ ok: true, blockNumber })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Persist failed', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}


