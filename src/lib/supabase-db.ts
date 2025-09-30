import { createClient } from '@/utils/supabase/server'

// Database operations using Supabase
export async function createResume(data: {
  title: string
  filename: string
  ipfsHash: string
  isPublic: boolean
  userId: string
}) {
  const supabase = await createClient()

  // Transform camelCase to snake_case for database
  const dbData = {
    title: data.title,
    filename: data.filename,
    ipfs_hash: data.ipfsHash,
    is_public: data.isPublic,
    user_id: data.userId,
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
  const supabase = await createClient()

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

  const supabase = await createClient()

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
    const supabase = await createClient()
    console.log('👤 Supabase DB: Client created successfully')

    // Transform camelCase to snake_case for database
    const dbData = {
      wallet_address: data.walletAddress,
      name: data.name,
      cdl_number: data.cdlNumber,
      cdl_state: data.cdlState,
      cdl_class: data.cdlClass,
    }
    console.log('👤 Supabase DB: Transformed data:', dbData)

    const { data: user, error } = await supabase
      .from('users')
      .upsert([dbData], { onConflict: 'wallet_address' })
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase DB: User upsert error:', error)
      throw new Error(`Failed to upsert user: ${error.message}`)
    }

    console.log('✅ Supabase DB: User upserted successfully:', user)
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
    const supabase = await createClient()

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
    const supabase = await createClient()

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
    const supabase = await createClient()

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
