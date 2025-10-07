import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS!
const PRIVATE_KEY = process.env.PRIVATE_KEY!
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY!
const RPC_URL = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

// Simplified ABI - just the functions we need
const CONTRACT_ABI = [
  'function submitApplication(string _applicationHash) external returns (uint256)',
  'function getUserApplications(address user) external view returns (uint256[])',
  'function getApplication(uint256 applicationId) external view returns (tuple(address owner, string applicationHash, bool isVerified, bool isRejected, uint256 timestamp, uint256 lastUpdated, string rejectionReason))',
]

export async function POST(request: NextRequest) {
  try {
    const { applicationHash, ipfsHash } = await request.json()

    console.log('📝 Blockchain API: Submitting driver application...')
    console.log('📝 Application Hash:', applicationHash)
    console.log('📝 IPFS Hash:', ipfsHash)

    if (!applicationHash || !ipfsHash) {
      return NextResponse.json(
        { error: 'Missing applicationHash or ipfsHash' },
        { status: 400 }
      )
    }

    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

    console.log('📝 Deployer wallet address:', wallet.address)

    // Initialize contract with wallet
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet)

    // Check wallet balance first
    const balance = await provider.getBalance(wallet.address)
    console.log('💰 Wallet balance:', ethers.formatEther(balance), 'ETH')

    if (balance === BigInt(0)) {
      throw new Error(
        'Deployer wallet has no ETH for gas. Please fund the wallet at: ' +
          wallet.address
      )
    }

    // Submit the application (combine hash and IPFS for the contract)
    // The contract stores a single hash, so we'll use the application hash
    console.log('📝 Submitting transaction...')
    const tx = await contract.submitApplication(applicationHash)

    console.log('⏳ Waiting for confirmation...')
    const receipt = await tx.wait()

    console.log('✅ Transaction confirmed:', receipt.hash)

    // Extract the application ID from the event logs
    const event = receipt.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log)
        } catch {
          return null
        }
      })
      .find((parsed: any) => parsed?.name === 'ApplicationSubmitted')

    const applicationId = event ? Number(event.args[1]) : null

    return NextResponse.json({
      success: true,
      transactionHash: receipt.hash,
      applicationId,
      blockNumber: receipt.blockNumber,
    })
  } catch (error: any) {
    console.error('❌ Blockchain API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to submit to blockchain',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
