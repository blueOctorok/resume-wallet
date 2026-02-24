import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createClient } from '@/utils/supabase/server'
import { getUserByWallet } from '@/lib/user-by-wallet'

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
    const { applicationHash, ipfsHash, userAddress } = await request.json()

    console.log('📝 Blockchain API: Submitting driver application...')
    console.log('📝 Application Hash:', applicationHash)
    console.log('📝 IPFS Hash:', ipfsHash)
    console.log('📝 User Address:', userAddress)

    // Validate required environment variables
    if (!CONTRACT_ADDRESS) {
      console.error('❌ Blockchain API: CONTRACT_ADDRESS not set')
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          details: 'Contract address not configured. Please check environment variables.',
        },
        { status: 500 }
      )
    }

    if (!PRIVATE_KEY) {
      console.error('❌ Blockchain API: PRIVATE_KEY not set')
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          details: 'Private key not configured. Please check environment variables.',
        },
        { status: 500 }
      )
    }

    if (!ALCHEMY_API_KEY) {
      console.error('❌ Blockchain API: ALCHEMY_API_KEY not set')
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          details: 'Alchemy API key not configured. Please check environment variables.',
        },
        { status: 500 }
      )
    }

    if (!applicationHash || !ipfsHash) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'Missing applicationHash or ipfsHash',
        },
        { status: 400 }
      )
    }

    // Check database for duplicate BEFORE submitting to blockchain (server-side check)
    if (userAddress) {
      console.log('🔍 Blockchain API: Checking database for duplicate hash...')
      const supabase = await createClient()
      
      // Get user_id from wallet address (case-insensitive)
      const userData = await getUserByWallet(supabase, userAddress)

      if (userData) {
        // Check if application with this hash already exists
        const { data: existingApp } = await supabase
          .from('driver_applications')
          .select('id, created_at, blockchain_tx_hash')
          .eq('user_id', userData.id)
          .eq('application_hash', applicationHash)
          .maybeSingle()

        if (existingApp) {
          console.log('⚠️ Blockchain API: Duplicate application hash found in database')
          return NextResponse.json(
            {
              error: 'Duplicate application detected',
              details: 'This application hash has already been submitted. Please modify your application data before resubmitting.',
              existingApplication: {
                id: existingApp.id,
                createdAt: existingApp.created_at,
                txHash: existingApp.blockchain_tx_hash,
              },
            },
            { status: 409 } // 409 Conflict
          )
        }
      }
      
      console.log('✅ Blockchain API: No duplicate found, proceeding with blockchain submission')
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

    // Preflight: estimate gas to detect on-chain duplicate (revert with "Hash used")
    try {
      await contract.submitApplication.estimateGas(applicationHash)
    } catch (preflightError: any) {
      const reason = preflightError?.reason || preflightError?.shortMessage || preflightError?.message
      console.error('⚠️ Preflight revert detected:', reason)
      if (reason?.toLowerCase()?.includes('hash used')) {
        return NextResponse.json(
          {
            error: 'Duplicate application detected on-chain',
            details:
              'This application hash has already been recorded on the blockchain. Please modify your application data before resubmitting.',
          },
          { status: 409 }
        )
      }
      // Unknown preflight error - return as server error with details
      return NextResponse.json(
        {
          error: 'Blockchain preflight failed',
          details: reason || 'Unknown error during gas estimation',
        },
        { status: 500 }
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
    console.error('❌ Error Stack:', error.stack)
    console.error('❌ Error Details:', {
      message: error.message,
      code: error.code,
      reason: error.reason,
      data: error.data,
    })
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to submit to blockchain'
    let errorDetails = error.message

    // Check for common error types
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('network')) {
      errorMessage = 'Network error connecting to blockchain'
      errorDetails = 'Unable to connect to Base Sepolia. Please check your network connection.'
    } else if (error.message?.includes('insufficient funds') || error.message?.includes('balance')) {
      errorMessage = 'Insufficient funds for transaction'
      errorDetails = 'The deployer wallet does not have enough ETH to pay for gas fees.'
    } else if (error.message?.includes('contract') || error.message?.includes('address')) {
      errorMessage = 'Contract address error'
      errorDetails = 'There was an error with the contract address. Please check configuration.'
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        rawError: process.env.NODE_ENV === 'development' ? error.message : undefined, // Only in dev
      },
      { status: 500 }
    )
  }
}
