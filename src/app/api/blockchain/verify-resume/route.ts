// app/api/blockchain/verify-resume/route.ts
// Blockchain verification step (called after database validation)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  try {
    console.log('⛓️ Blockchain Verify API: Starting verification')

    const body = await req.json()
    const { resumeId, ipfsHash, title, filename, userAddress, isPublic } = body

    // Validate input
    if (!resumeId || !ipfsHash || !title || !filename || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify the resume exists in database
    const supabase = await createClient()
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id, user_id, ipfs_hash, verification_status')
      .eq('id', resumeId)
      .single()

    if (resumeError || !resume) {
      return NextResponse.json(
        { error: 'Resume not found in database' },
        { status: 404 }
      )
    }

    // Verify the user owns this resume
    const { data: user } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', resume.user_id)
      .single()

    if (!user || user.wallet_address !== userAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    console.log('✅ Blockchain Verify API: Resume validated in database')

    // For now, return a mock blockchain verification
    // TODO: Implement actual blockchain contract interaction
    const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`
    const mockResumeId = Math.floor(Math.random() * 1000) + 1

    console.log('✅ Blockchain Verify API: Mock verification complete')

    // Update resume status in database
    const { error: updateError } = await supabase
      .from('resumes')
      .update({
        verification_status: 'VERIFIED',
        blockchain_tx_hash: mockTransactionHash,
        blockchain_resume_id: mockResumeId.toString(),
      })
      .eq('id', resumeId)

    if (updateError) {
      console.error(
        '❌ Blockchain Verify API: Failed to update resume:',
        updateError
      )
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      transactionHash: mockTransactionHash,
      resumeId: mockResumeId.toString(),
      blockNumber: '31500000',
      gasUsed: '150000',
      contractAddress: process.env.NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS,
      explorerUrl: `https://sepolia.basescan.org/tx/${mockTransactionHash}`,
      note: 'Mock blockchain verification. TODO: Implement real contract interaction.',
    })
  } catch (error) {
    console.error('❌ Blockchain Verify API: Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to verify on blockchain',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
