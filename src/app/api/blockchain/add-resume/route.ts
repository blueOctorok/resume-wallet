import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

// Contract ABI - just the functions we need
const RESUME_REGISTRY_ABI = [
  'function addResume(string memory _ipfsHash, string memory _title, string memory _filename, bool _isPublic) external returns (uint256)',
  'function resumeCount() external view returns (uint256)',
  'function getResume(uint256 _resumeId) external view returns (tuple(address owner, string ipfsHash, string title, string filename, bool isPublic, bool isVerified, uint256 timestamp, uint256 lastUpdated))',
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ipfsHash, title, filename, isPublic, userAddress } = body

    // Validate input
    if (!ipfsHash || !title || !filename || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get environment variables
    const contractAddress = process.env.NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS
    const rpcUrl = process.env.ALCHEMY_BASE_SEPOLIA_URL
    const privateKey = process.env.PRIVATE_KEY

    if (!contractAddress || !rpcUrl || !privateKey) {
      console.error('Missing environment variables:', {
        contractAddress: !!contractAddress,
        rpcUrl: !!rpcUrl,
        privateKey: !!privateKey,
      })
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    console.log('🔄 Adding resume to blockchain...')
    console.log('Contract:', contractAddress)
    console.log('IPFS Hash:', ipfsHash)
    console.log('Title:', title)

    // Create provider and signer
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const signer = new ethers.Wallet(privateKey, provider)

    // Create contract instance
    const contract = new ethers.Contract(
      contractAddress,
      RESUME_REGISTRY_ABI,
      signer
    )

    // Get current resume count (for the new resume ID)
    const currentCount = await contract.resumeCount()
    const newResumeId = currentCount + BigInt(1)

    console.log('📊 Current resume count:', currentCount.toString())
    console.log('🆕 New resume ID will be:', newResumeId.toString())

    // Add resume to blockchain
    console.log('⛓️ Calling addResume function...')
    const tx = await contract.addResume(
      ipfsHash,
      title,
      filename,
      isPublic || true
    )

    console.log('⏳ Transaction sent:', tx.hash)
    console.log('⏳ Waiting for confirmation...')

    // Wait for transaction confirmation
    const receipt = await tx.wait()

    console.log('✅ Transaction confirmed!')
    console.log('📊 Gas used:', receipt.gasUsed.toString())
    console.log('🔗 Block number:', receipt.blockNumber)

    // Verify the resume was added
    try {
      const addedResume = await contract.getResume(newResumeId)
      console.log('✅ Resume verified on blockchain:', {
        owner: addedResume.owner,
        ipfsHash: addedResume.ipfsHash,
        title: addedResume.title,
        isVerified: addedResume.isVerified,
      })
    } catch (verifyError) {
      console.warn(
        '⚠️ Could not verify resume (but transaction succeeded):',
        verifyError
      )
    }

    return NextResponse.json({
      success: true,
      transactionHash: tx.hash,
      resumeId: newResumeId.toString(),
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      contractAddress,
      explorerUrl: `https://sepolia.basescan.org/tx/${tx.hash}`,
    })
  } catch (error) {
    console.error('❌ Blockchain add resume error:', error)

    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      {
        error: 'Failed to add resume to blockchain',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
