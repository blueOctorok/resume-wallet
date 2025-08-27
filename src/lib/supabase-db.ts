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
    throw new Error(`Failed to fetch user profile: ${error.message}`)
  }

  return user
}

export async function upsertUser(data: {
  walletAddress: string
  name?: string
  cdlNumber?: string
  cdlState?: string
  cdlClass?: string
}) {
  const supabase = await createClient()

  // Transform camelCase to snake_case for database
  const dbData = {
    wallet_address: data.walletAddress,
    name: data.name,
    cdl_number: data.cdlNumber,
    cdl_state: data.cdlState,
    cdl_class: data.cdlClass,
  }

  const { data: user, error } = await supabase
    .from('users')
    .upsert([dbData], { onConflict: 'wallet_address' })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to upsert user: ${error.message}`)
  }

  return user
}
