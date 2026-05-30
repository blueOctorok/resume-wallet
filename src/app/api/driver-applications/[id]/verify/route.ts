import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * POST /api/driver-applications/[id]/verify
 * Manually verify a DOT application on the blockchain
 * 
 * This endpoint:
 * 1. Fetches the application from database
 * 2. Submits to blockchain
 * 3. Updates database with transaction details
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.log('[DOT VERIFY] Verifying application:', id, 'for user:', userId)

    // 1. Get application from database
    const supabase = await getAdminSupabaseClient()

    // Need the full row (not just id): the blockchain submit below sends the
    // user's wallet_address as `userAddress`, so resolve the user record by id.
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get the application
    const { data: application, error: appError } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userData.id)
      .single()

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Check if already verified
    if (application.blockchain_tx_hash) {
      return NextResponse.json(
        {
          error: 'Application already verified',
          details: 'This application has already been submitted to the blockchain.',
          transactionHash: application.blockchain_tx_hash,
          applicationId: application.blockchain_application_id,
        },
        { status: 409 }
      )
    }

    // Check if application is complete
    if (!application.is_complete) {
      return NextResponse.json(
        { error: 'Application not complete', details: 'Please complete the application before verifying.' },
        { status: 400 }
      )
    }

    // Check if we have required data
    if (!application.application_hash) {
      return NextResponse.json(
        { error: 'Missing application hash', details: 'Application hash is required for verification.' },
        { status: 400 }
      )
    }

    const applicationHash = application.application_hash
    const ipfsHash = application.ipfs_hash || `placeholder_ipfs_hash_${Date.now()}`

    // 2. Submit to blockchain
    console.log('[DOT VERIFY] Submitting to blockchain...')
    const blockchainResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/blockchain/submit-driver-application`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationHash,
          ipfsHash,
          userAddress: userData.wallet_address,
        }),
      }
    )

    if (!blockchainResponse.ok) {
      const errorData = await blockchainResponse.json().catch(() => ({}))
      console.error('[DOT VERIFY] Blockchain submission failed:', errorData)

      // Check if this is a duplicate (already on blockchain)
      if (blockchainResponse.status === 409) {
        // Update database to reflect that it's already on chain
        // We'll need to fetch the existing transaction from blockchain
        return NextResponse.json(
          {
            error: 'Duplicate application detected on-chain',
            details: errorData.details || 'This application has already been recorded on the blockchain.',
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          error: 'Blockchain submission failed',
          details: errorData.details || errorData.error || 'Failed to submit to blockchain',
        },
        { status: blockchainResponse.status }
      )
    }

    const blockchainData = await blockchainResponse.json()
    console.log('[DOT VERIFY] Blockchain submission successful:', blockchainData)

    // 3. Update database with blockchain transaction details
    const { error: updateError } = await supabase
      .from('driver_applications')
      .update({
        blockchain_tx_hash: blockchainData.transactionHash,
        blockchain_application_id: blockchainData.applicationId?.toString() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[DOT VERIFY] Failed to update database:', updateError)
      // Blockchain submission succeeded, but DB update failed
      // Return success with warning
      return NextResponse.json(
        {
          success: true,
          warning: 'Blockchain verification succeeded, but database update failed',
          transactionHash: blockchainData.transactionHash,
          applicationId: blockchainData.applicationId,
          blockNumber: blockchainData.blockNumber,
        },
        { status: 200 }
      )
    }

    console.log('[DOT VERIFY] Verification complete')

    return NextResponse.json({
      success: true,
      transactionHash: blockchainData.transactionHash,
      applicationId: blockchainData.applicationId,
      blockNumber: blockchainData.blockNumber,
      explorerUrl: `https://sepolia.basescan.org/tx/${blockchainData.transactionHash}`,
    })
  } catch (error: any) {
    console.error('[DOT VERIFY] Error:', error)
    return NextResponse.json(
      {
        error: 'Verification failed',
        details: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
