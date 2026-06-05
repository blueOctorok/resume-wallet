import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet, normalizeWalletAddress } from '@/lib/user-by-wallet'

// Database operations using Supabase
export async function createResume(data: {
  title: string
  filename: string
  ipfsHash: string
  isPublic: boolean
  userId: string
  sourceRole?: 'driver' | 'developer' | 'general'
}) {
  // Use admin client to bypass RLS (called from API routes that validate wallet addresses)
  const supabase = await getAdminSupabaseClient()

  // Transform camelCase to snake_case for database
  const dbData = {
    title: data.title,
    filename: data.filename,
    ipfs_hash: data.ipfsHash,
    is_public: data.isPublic,
    user_id: data.userId,
    source_role: data.sourceRole ?? 'driver',
  }

  const { data: resume, error } = await supabase
    .from('resumes')
    .insert([dbData])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create resume: ${error.message}`)
  }

  return resume
}

export async function getUserResumes(userId: string) {
  // Use admin client to bypass RLS (called from API routes that validate wallet addresses)
  const supabase = await getAdminSupabaseClient()

  const { data: resumes, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch resumes: ${error.message}`)
  }

  return resumes
}

export async function getUserProfile(sessionUserId: string) {
  console.log('👤 Supabase DB: Getting user profile for:', sessionUserId)

  // Use admin client to bypass RLS (called from API routes that validate wallet addresses)
  const supabase = await getAdminSupabaseClient()

  const { data: user, error } = await supabase
    .from('users')
    .select(
      `
      *,
      resumes (*)
    `
    )
    .eq('id', sessionUserId)
    .single()

  if (error) {
    // If user doesn't exist (PGRST116), return empty profile with empty resumes array
    if (error.code === 'PGRST116') {
      console.log('👤 Supabase DB: User not found, returning empty profile')
      return {
        id: sessionUserId,
        resumes: [],
        created_at: null,
        updated_at: null,
      }
    }
    console.error('❌ Supabase DB: Error fetching user profile:', error)
    throw new Error(`Failed to fetch user profile: ${error.message}`)
  }

  console.log('✅ Supabase DB: User profile fetched successfully:', {
    wallet_address: user.wallet_address,
    resumes_count: user.resumes?.length || 0,
  })

  return user
}

/**
 * Ensure a users row exists for this wallet. Identity display name lives on
 * user_profiles.display_name (migration 042 dropped users.name and CDL cols).
 * cdl* args are ignored here — use block_driver_cdl / block-data APIs instead.
 */
export async function upsertUser(data: {
  sessionUserId: string
  name?: string
  cdlNumber?: string
  cdlState?: string
  cdlClass?: string
}) {
  console.log('👤 Supabase DB: Starting user upsert...')
  console.log('👤 Supabase DB: Input data:', {
    sessionUserId: data.sessionUserId,
    hasName: !!data.name,
  })

  try {
    const supabase = await getAdminSupabaseClient()

    let user = await getUserByWallet(supabase, data.sessionUserId)

    if (!user) {
      const normalized = normalizeWalletAddress(data.sessionUserId)
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({
          wallet_address: normalized,
          is_active: true,
        })
        .select('*')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          user = await getUserByWallet(supabase, data.sessionUserId)
        } else {
          console.error('❌ Supabase DB: User insert error:', insertError)
          throw new Error(`Failed to insert user: ${insertError.message}`)
        }
      } else {
        user = inserted
      }
    }

    if (!user) {
      throw new Error('Failed to resolve user after insert')
    }

    // Placeholder / fallback display name only when profile has none yet
    if (data.name?.trim()) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!prof) {
        const { error: pErr } = await supabase.from('user_profiles').insert({
          user_id: user.id,
          display_name: data.name.trim(),
        })
        if (pErr?.code === '23505') {
          const { data: row } = await supabase
            .from('user_profiles')
            .select('display_name')
            .eq('user_id', user.id)
            .maybeSingle()
          if (!row?.display_name?.trim()) {
            await supabase
              .from('user_profiles')
              .update({
                display_name: data.name.trim(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.id)
          }
        } else if (pErr) {
          console.warn('👤 Supabase DB: user_profiles insert (non-fatal):', pErr.message)
        }
      } else if (!prof.display_name?.trim()) {
        await supabase
          .from('user_profiles')
          .update({
            display_name: data.name.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      }
    }

    console.log('✅ Supabase DB: User upsert OK:', user.id)
    return user
  } catch (error) {
    console.error('❌ Supabase DB: User upsert failed:', error)
    throw error
  }
}

// Driver Application Functions
export async function getDriverApplication(userAddress: string) {
  console.log('📋 Supabase DB: Getting driver application for:', userAddress)

  try {
    // Use admin client to bypass RLS (called from API routes that validate wallet addresses)
    const supabase = await getAdminSupabaseClient()

    const { data, error } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('user_address', userAddress)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Supabase DB: Get application error:', error)
      throw error
    }

    if (data) {
      console.log('✅ Supabase DB: Found existing application:', data)
    } else {
      console.log('📝 Supabase DB: No existing application found')
    }

    return data
  } catch (error) {
    console.error('❌ Supabase DB: Get application failed:', error)
    throw error
  }
}

export async function saveDriverApplication(
  userAddress: string,
  applicationData: any,
  currentStep: number
) {
  console.log('💾 Supabase DB: Saving driver application...')
  console.log('💾 Supabase DB: User:', userAddress)
  console.log('💾 Supabase DB: Step:', currentStep)

  try {
    // Use admin client to bypass RLS (called from API routes that validate wallet addresses)
    const supabase = await getAdminSupabaseClient()

    const { data, error } = await supabase
      .from('driver_applications')
      .upsert({
        user_address: userAddress,
        application_data: applicationData,
        current_step: currentStep,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase DB: Save application error:', error)
      throw error
    }

    console.log('✅ Supabase DB: Application saved successfully:', data)
    return data
  } catch (error) {
    console.error('❌ Supabase DB: Save application failed:', error)
    throw error
  }
}

export async function completeDriverApplication(
  userAddress: string,
  applicationData: any
) {
  console.log('🎉 Supabase DB: Completing driver application...')
  console.log('🎉 Supabase DB: User:', userAddress)

  try {
    // Use admin client to bypass RLS (called from API routes that validate wallet addresses)
    const supabase = await getAdminSupabaseClient()

    const { data, error } = await supabase
      .from('driver_applications')
      .upsert({
        user_address: userAddress,
        application_data: applicationData,
        current_step: 8, // All steps complete
        is_complete: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase DB: Complete application error:', error)
      throw error
    }

    console.log('✅ Supabase DB: Application completed successfully:', data)
    return data
  } catch (error) {
    console.error('❌ Supabase DB: Complete application failed:', error)
    throw error
  }
}
