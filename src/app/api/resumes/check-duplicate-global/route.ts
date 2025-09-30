import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAlchemySmartAccountClient, alchemy } from '@account-kit/infra'
import { createLightAccount } from '@account-kit/smart-contracts'
import { LocalAccountSigner } from '@aa-sdk/core'
import { generatePrivateKey } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

// Check if file is a duplicate at BOTH database and blockchain levels
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Global Duplicate Check API: Starting POST request')

    const body = await request.json()
    const { userAddress, ipfsHash } = body

    console.log('📋 Global Duplicate Check API: Request body:', {
      userAddress,
      ipfsHash,
    })

    // Validate required fields
    if (!userAddress || !ipfsHash) {
      console.log('❌ Global Duplicate Check API: Missing required fields')
      return NextResponse.json(
        {
          error: 'Missing required fields: userAddress, ipfsHash',
        },
        { status: 400 }
      )
    }

    // Step 1: Check database for user-specific duplicates
    const supabase = await createClient()
    console.log('🗄️ Global Duplicate Check API: Connected to Supabase database')

    const { data: existingResume, error: queryError } = await supabase
      .from('resumes')
      .select(
        `
        id,
        created_at,
        title,
        filename,
        users!inner(wallet_address)
      `
      )
      .eq('users.wallet_address', userAddress)
      .eq('ipfs_hash', ipfsHash)
      .single()

    if (queryError && queryError.code !== 'PGRST116') {
      console.error(
        '❌ Global Duplicate Check API: Database query error:',
        queryError
      )
      return NextResponse.json(
        {
          error: 'Failed to check database for duplicates',
          details: queryError.message,
        },
        { status: 500 }
      )
    }

    const userDuplicateExists = !!existingResume

    // Step 2: Check blockchain for global duplicates
    let blockchainDuplicateExists = false
    let blockchainError = null

    try {
      console.log(
        '⛓️ Global Duplicate Check API: Checking blockchain for global duplicates...'
      )

      // Create a temporary client to check the blockchain
      const transport = alchemy({ apiKey: process.env.ALCHEMY_API_KEY! })
      const tempClient = createAlchemySmartAccountClient({
        transport,
        chain: baseSepolia,
      })

      // Contract ABI for checking if IPFS hash exists
      const resumeRegistryABI = [
        {
          name: 'getResumeByHash',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'ipfsHash', type: 'string' }],
          outputs: [
            { name: 'resumeId', type: 'uint256' },
            { name: 'ipfsHash', type: 'string' },
            { name: 'title', type: 'string' },
            { name: 'filename', type: 'string' },
            { name: 'isPublic', type: 'bool' },
            { name: 'uploader', type: 'address' },
            { name: 'timestamp', type: 'uint256' },
          ],
        },
      ]

      // Try to read from the blockchain to see if this IPFS hash exists
      const contractAddress = process.env
        .NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS as `0x${string}`

      try {
        const result = await tempClient.readContract({
          address: contractAddress,
          abi: resumeRegistryABI,
          functionName: 'getResumeByHash',
          args: [ipfsHash],
        })

        // If we get a result and resumeId is not 0, it exists
        blockchainDuplicateExists = result && result[0] && Number(result[0]) > 0

        if (blockchainDuplicateExists) {
          console.log(
            '⛓️ Global Duplicate Check API: Found blockchain duplicate:',
            {
              resumeId: result[0],
              uploader: result[5],
              timestamp: result[6],
            }
          )
        } else {
          console.log(
            '⛓️ Global Duplicate Check API: No blockchain duplicate found'
          )
        }
      } catch (readError: any) {
        // If the contract call fails, it might mean the hash doesn't exist
        // or there's an issue with the contract call
        console.log(
          '⛓️ Global Duplicate Check API: Contract read result:',
          readError.message
        )

        // If it's a revert error, assume no duplicate
        if (
          readError.message?.includes('revert') ||
          readError.message?.includes('execution reverted')
        ) {
          blockchainDuplicateExists = false
          console.log(
            '⛓️ Global Duplicate Check API: Contract revert - no duplicate found'
          )
        } else {
          // For other errors, we'll assume there might be a duplicate to be safe
          blockchainError = readError.message
          console.log(
            '⛓️ Global Duplicate Check API: Contract read error:',
            blockchainError
          )
        }
      }
    } catch (error: any) {
      blockchainError = error.message
      console.error(
        '❌ Global Duplicate Check API: Blockchain check error:',
        error
      )
    }

    // Determine overall duplicate status
    const hasAnyDuplicate = userDuplicateExists || blockchainDuplicateExists
    const duplicateType = userDuplicateExists
      ? 'user'
      : blockchainDuplicateExists
        ? 'global'
        : 'none'

    const checkResult = {
      exists: hasAnyDuplicate,
      duplicateType,
      userDuplicate: {
        exists: userDuplicateExists,
        resumeId: userDuplicateExists ? existingResume.id : null,
        uploadedAt: userDuplicateExists ? existingResume.created_at : null,
        title: userDuplicateExists ? existingResume.title : null,
        filename: userDuplicateExists ? existingResume.filename : null,
      },
      blockchainDuplicate: {
        exists: blockchainDuplicateExists,
        error: blockchainError,
      },
      source: 'GLOBAL_CHECK',
    }

    if (hasAnyDuplicate) {
      console.log(
        `🔍 Global Duplicate Check API: Found ${duplicateType} duplicate`
      )
    } else {
      console.log('🔍 Global Duplicate Check API: No duplicates found')
    }

    console.log('✅ Global Duplicate Check API: Check result:', checkResult)

    return NextResponse.json(checkResult, { status: 200 })
  } catch (error) {
    console.error('❌ Global Duplicate Check API: Error checking file:', error)

    return NextResponse.json(
      {
        error: 'Failed to check file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
