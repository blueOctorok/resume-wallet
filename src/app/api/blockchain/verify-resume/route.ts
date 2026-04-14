// app/api/blockchain/verify-resume/route.ts
// Records uploaded resume IPFS hash on ResumeRegistry (same contract as built-resume verify).

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { addResumeOnChain } from '@/lib/resume-registry-onchain'

export async function POST(req: NextRequest) {
  try {
    console.log('⛓️ Blockchain Verify API: Starting verification (uploaded resume)')

    const body = await req.json()
    const { resumeId, ipfsHash, title, filename, userAddress, isPublic } = body

    if (!resumeId || !ipfsHash || !title || !filename || !userAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id, user_id, ipfs_hash, verification_status, blockchain_tx_hash')
      .eq('id', resumeId)
      .single()

    if (resumeError || !resume) {
      return NextResponse.json({ error: 'Resume not found in database' }, { status: 404 })
    }

    if (resume.ipfs_hash !== ipfsHash) {
      return NextResponse.json({ error: 'IPFS hash mismatch for this resume' }, { status: 400 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', resume.user_id)
      .single()

    const wallet = (user?.wallet_address ?? '').toLowerCase()
    if (!user || wallet !== String(userAddress).toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (resume.verification_status === 'VERIFIED' && resume.blockchain_tx_hash) {
      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        transactionHash: resume.blockchain_tx_hash,
        explorerUrl: `https://sepolia.basescan.org/tx/${resume.blockchain_tx_hash}`,
      })
    }

    let chain: Awaited<ReturnType<typeof addResumeOnChain>>
    try {
      chain = await addResumeOnChain({
        ipfsHash,
        title: String(title),
        filename: String(filename),
        isPublic: isPublic !== false,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      if (msg === 'RESUME_REGISTRY_NOT_CONFIGURED') {
        console.warn('⚠️ Blockchain Verify API: registry not configured')
        return NextResponse.json(
          {
            error: 'Blockchain verification is not configured on this server',
            partial: true,
          },
          { status: 503 },
        )
      }
      console.error('❌ Blockchain Verify API:', e)
      return NextResponse.json({ error: 'On-chain verification failed', details: msg }, { status: 500 })
    }

    const { error: updateError } = await supabase
      .from('resumes')
      .update({
        verification_status: 'VERIFIED',
        blockchain_tx_hash: chain.txHash,
        blockchain_resume_id: chain.blockchainResumeId,
        is_public: isPublic !== false,
      })
      .eq('id', resumeId)

    if (updateError) {
      console.error('❌ Blockchain Verify API: DB update failed:', updateError)
    }

    return NextResponse.json({
      success: true,
      transactionHash: chain.txHash,
      resumeId: chain.blockchainResumeId,
      blockNumber: String(chain.blockNumber),
      gasUsed: chain.gasUsed,
      contractAddress: process.env.NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS,
      explorerUrl: chain.explorerUrl,
    })
  } catch (error) {
    console.error('❌ Blockchain Verify API: Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to verify on blockchain',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
