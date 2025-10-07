import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ethers } from 'ethers'

// Check if driver application is a duplicate at BOTH database and blockchain levels
export async function POST(request: NextRequest) {
  try {
    console.log(
      '🔍 Driver App Global Duplicate Check API: Starting POST request'
    )

    const body = await request.json()
    const { userAddress, applicationHash } = body

    console.log('📋 Driver App Global Duplicate Check API: Request body:', {
      userAddress,
      applicationHash,
    })

    // Validate required fields
    if (!userAddress || !applicationHash) {
      console.log(
        '❌ Driver App Global Duplicate Check API: Missing required fields'
      )
      return NextResponse.json(
        {
          error: 'Missing required fields: userAddress, applicationHash',
        },
        { status: 400 }
      )
    }

    // Step 1: Check database for user-specific duplicates
    const supabase = await createClient()
    console.log(
      '🗄️ Driver App Global Duplicate Check API: Connected to Supabase database'
    )

    // First get user_id from wallet address
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', userAddress)
      .maybeSingle()

    let userDuplicateExists = false
    let existingApp = null

    if (userData && !userError) {
      const { data, error: queryError } = await supabase
        .from('driver_applications')
        .select('id, created_at, application_hash')
        .eq('user_id', userData.id)
        .eq('application_hash', applicationHash)
        .single()

      if (queryError && queryError.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is fine
        console.error(
          '❌ Driver App Global Duplicate Check API: Database query error:',
          queryError
        )
        // Don't fail the whole request, just log and continue
        console.log('⚠️ Continuing without database check')
      }

      userDuplicateExists = !!data
      existingApp = data
    }

    console.log(
      `🗄️ Database duplicate check: ${userDuplicateExists ? 'Found' : 'Not found'}`
    )

    // Step 2: Check blockchain for global duplicates
    let blockchainDuplicateExists = false
    let blockchainError = null

    try {
      console.log(
        '⛓️ Driver App Global Duplicate Check API: Checking blockchain for global duplicates...'
      )

      // Create provider to check the blockchain
      const provider = new ethers.JsonRpcProvider(
        process.env.ALCHEMY_BASE_SEPOLIA_URL ||
          'https://base-sepolia.g.alchemy.com/v2/1EacVcYetgk_QIWCKp4hI'
      )

      // Contract ABI for checking if application hash exists
      const driverRegistryABI = [
        'function isHashUsed(string memory _hash) external view returns (bool)',
      ]

      const contractAddress =
        process.env.NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS

      if (!contractAddress) {
        throw new Error('Driver application contract address not configured')
      }

      try {
        const contract = new ethers.Contract(
          contractAddress,
          driverRegistryABI,
          provider
        )
        const result = await contract.isHashUsed(applicationHash)

        blockchainDuplicateExists = result === true

        if (blockchainDuplicateExists) {
          console.log(
            '⛓️ Driver App Global Duplicate Check API: Found blockchain duplicate for hash:',
            applicationHash
          )
        } else {
          console.log(
            '⛓️ Driver App Global Duplicate Check API: No blockchain duplicate found'
          )
        }
      } catch (readError: any) {
        console.log(
          '⛓️ Driver App Global Duplicate Check API: Contract read result:',
          readError.message
        )

        // If it's a revert error, assume no duplicate
        if (
          readError.message?.includes('revert') ||
          readError.message?.includes('execution reverted')
        ) {
          blockchainDuplicateExists = false
          console.log(
            '⛓️ Driver App Global Duplicate Check API: Contract revert - no duplicate found'
          )
        } else {
          // For other errors, we'll assume there might be a duplicate to be safe
          blockchainError = readError.message
          console.log(
            '⛓️ Driver App Global Duplicate Check API: Contract read error:',
            blockchainError
          )
        }
      }
    } catch (error: any) {
      blockchainError = error.message
      console.error(
        '❌ Driver App Global Duplicate Check API: Blockchain check error:',
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
        applicationId:
          userDuplicateExists && existingApp ? existingApp.id : null,
        uploadedAt:
          userDuplicateExists && existingApp ? existingApp.created_at : null,
      },
      blockchainDuplicate: {
        exists: blockchainDuplicateExists,
        error: blockchainError,
      },
      source: 'GLOBAL_CHECK',
    }

    if (hasAnyDuplicate) {
      console.log(
        `🔍 Driver App Global Duplicate Check API: Found ${duplicateType} duplicate`
      )
    } else {
      console.log(
        '🔍 Driver App Global Duplicate Check API: No duplicates found'
      )
    }

    console.log(
      '✅ Driver App Global Duplicate Check API: Check result:',
      checkResult
    )

    return NextResponse.json(checkResult, { status: 200 })
  } catch (error) {
    console.error(
      '❌ Driver App Global Duplicate Check API: Error checking application:',
      error
    )

    return NextResponse.json(
      {
        error: 'Failed to check application',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
