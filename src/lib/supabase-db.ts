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

  const { data: resume, error } = await supabase
    .from('resumes')
    .insert([data])
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
    .eq('userId', userId)
    .order('createdAt', { ascending: false })

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
    .eq('walletAddress', walletAddress)
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

  const { data: user, error } = await supabase
    .from('users')
    .upsert([data], { onConflict: 'walletAddress' })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to upsert user: ${error.message}`)
  }

  return user
}
