import { NextRequest, NextResponse } from 'next/server'

// Simple mock blockchain endpoint for webhook testing
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Simple Blockchain API: Starting request')

    const body = await request.json()
    const { ipfsHash, title, filename, isPublic, userAddress } = body

    // Validate input
    if (!ipfsHash || !title || !filename || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('📋 Simple Blockchain API: Request body:', {
      ipfsHash,
      title,
      filename,
      userAddress,
      isPublic,
    })

    // Get contract address
    const contractAddress = process.env.NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS

    if (!contractAddress) {
      return NextResponse.json(
        { error: 'Contract address not configured' },
        { status: 500 }
      )
    }

    // Simulate blockchain transaction
    const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`
    const mockResumeId = Math.floor(Math.random() * 1000) + 1

    console.log('✅ Mock transaction created:', {
      hash: mockTransactionHash,
      resumeId: mockResumeId,
    })

    return NextResponse.json({
      success: true,
      transactionHash: mockTransactionHash,
      resumeId: mockResumeId.toString(),
      blockNumber: '31500000',
      gasUsed: '150000',
      contractAddress,
      explorerUrl: `https://sepolia.basescan.org/tx/${mockTransactionHash}`,
      note: 'Mock transaction for webhook testing. Focus on webhook setup first.',
    })
  } catch (error) {
    console.error('❌ Simple Blockchain API: Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to add resume to blockchain',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
