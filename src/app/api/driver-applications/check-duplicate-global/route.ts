import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * Check if a driver application hash already exists for this user (DB only).
 * On-chain duplicate checks were removed in D2/D5 — registries are archived.
 */
export async function POST(request: NextRequest) {
  try {
    console.log(
      '🔍 Driver App Global Duplicate Check API: Starting POST request'
    )

    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { applicationHash } = body

    console.log('📋 Driver App Global Duplicate Check API: Request body:', {
      sessionUserId,
      applicationHash,
    })

    if (!applicationHash) {
      console.log(
        '❌ Driver App Global Duplicate Check API: Missing required fields'
      )
      return NextResponse.json(
        { error: 'Missing required field: applicationHash' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    console.log(
      '🗄️ Driver App Global Duplicate Check API: Connected to Supabase database'
    )

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', sessionUserId)
      .maybeSingle()

    let userDuplicateExists = false
    let existingApp: { id: string; created_at: string; application_hash: string } | null = null

    if (userData) {
      const { data, error: queryError } = await supabase
        .from('driver_applications')
        .select('id, created_at, application_hash')
        .eq('user_id', userData.id)
        .eq('application_hash', applicationHash)
        .single()

      if (queryError && queryError.code !== 'PGRST116') {
        console.error(
          '❌ Driver App Global Duplicate Check API: Database query error:',
          queryError
        )
        console.log('⚠️ Continuing without database check')
      } else {
        userDuplicateExists = !!data
        existingApp = data
      }
    }

    console.log(
      `🗄️ Database duplicate check: ${userDuplicateExists ? 'Found' : 'Not found'}`
    )

    const checkResult = {
      exists: userDuplicateExists,
      duplicateType: userDuplicateExists ? 'user' : 'none',
      userDuplicate: {
        exists: userDuplicateExists,
        applicationId: userDuplicateExists && existingApp ? existingApp.id : null,
        uploadedAt: userDuplicateExists && existingApp ? existingApp.created_at : null,
      },
      // Kept for client backward compat — always false after D5
      blockchainDuplicate: {
        exists: false,
        error: null,
      },
      source: 'GLOBAL_CHECK',
    }

    if (userDuplicateExists) {
      console.log('🔍 Driver App Global Duplicate Check API: Found user duplicate')
    } else {
      console.log('🔍 Driver App Global Duplicate Check API: No duplicates found')
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
