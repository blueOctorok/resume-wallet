import { getAdminSupabaseClient } from '@/utils/supabase/admin'

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

export async function getUserProfile(walletAddress: string) {
  console.log('👤 Supabase DB: Getting user profile for:', walletAddress)

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
    .eq('wallet_address', walletAddress)
    .single()

  if (error) {
    // If user doesn't exist (PGRST116), return empty profile with empty resumes array
    if (error.code === 'PGRST116') {
      console.log('👤 Supabase DB: User not found, returning empty profile')
      return {
        wallet_address: walletAddress,
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

export async function upsertUser(data: {
  walletAddress: string
  name?: string
  cdlNumber?: string
  cdlState?: string
  cdlClass?: string
}) {
  console.log('👤 Supabase DB: Starting user upsert...')
  console.log('👤 Supabase DB: Input data:', data)

  try {
    const supabase = await getAdminSupabaseClient()
    console.log('👤 Supabase DB: Client created successfully')

    // Check if user exists (case-insensitive) — the unique constraint is on lower(wallet_address)
    // so we can't use onConflict with the raw column, we need to check manually
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .ilike('wallet_address', data.walletAddress)
      .single()

    if (existingUser) {
      // User exists — update if we have new data to set
      const updateData: Record<string, string | undefined> = {}
      if (data.name) updateData.name = data.name
      if (data.cdlNumber) updateData.cdl_number = data.cdlNumber
      if (data.cdlState) updateData.cdl_state = data.cdlState
      if (data.cdlClass) updateData.cdl_class = data.cdlClass

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        const { data: updated, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', existingUser.id)
          .select()
          .single()

        if (updateError) {
          console.error('❌ Supabase DB: User update error:', updateError)
          throw new Error(`Failed to update user: ${updateError.message}`)
        }
        console.log('✅ Supabase DB: User updated successfully:', updated)
        return updated
      }

      console.log('✅ Supabase DB: User already exists, no update needed:', existingUser)
      return existingUser
    }

    // User doesn't exist — insert new
    const dbData = {
      wallet_address: data.walletAddress,
      name: data.name,
      cdl_number: data.cdlNumber,
      cdl_state: data.cdlState,
      cdl_class: data.cdlClass,
    }
    console.log('👤 Supabase DB: Inserting new user:', dbData)

    const { data: user, error } = await supabase
      .from('users')
      .insert([dbData])
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase DB: User insert error:', error)
      throw new Error(`Failed to insert user: ${error.message}`)
    }

    console.log('✅ Supabase DB: User inserted successfully:', user)
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
