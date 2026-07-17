'use server'

import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'

/**
 * Resolve Storm `users.id` from a session user id (UUID) or legacy wallet.
 * Post–Phase-1 callers pass Supabase auth / users.id — NOT a chain address.
 */
async function resolveDriverAppUserId(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  sessionOrWallet: string,
): Promise<string | null> {
  const user = await getUserByWallet(supabase, sessionOrWallet)
  return user?.id ?? null
}

// Types for driver application data
export interface DriverApplicationData {
  personalInfo: {
    firstName: string
    lastName: string
    middleName: string
    ssn: string
    dateOfBirth: string
    address: string
    city: string
    state: string
    zipCode: string
    phone: string
    email: string
    emergencyContact: {
      name: string
      relationship: string
      phone: string
    }
  }
  cdlInfo: {
    cdlNumber: string
    cdlState: string
    cdlExpiration: string
    cdlClass: string
    endorsements: string[]
    restrictions: string[]
  }
  employmentHistory: {
    company: string
    position: string
    startDate: string
    endDate: string
    reasonForLeaving: string
    supervisorName: string
    supervisorPhone: string
    duties: string
  }[]
  drivingRecord: {
    violations: {
      date: string
      violation: string
      location: string
      fine: string
      points: string
    }[]
    accidents: {
      date: string
      description: string
      fatalities: string
      injuries: string
      propertyDamage: string
    }[]
  }
  medicalInfo: {
    medicalExamDate: string
    medicalExamExpiration: string
    medicalExaminerName: string
    medicalExaminerPhone: string
    medicalConditions: string[]
    medications: string[]
    visionTest: {
      leftEye: string
      rightEye: string
      bothEyes: string
    }
    hearingTest: {
      leftEar: string
      rightEar: string
    }
  }
  drugAlcoholTesting: {
    lastTestDate: string
    testResult: string
    testingCompany: string
    testingCompanyPhone: string
    previousViolations: {
      date: string
      violation: string
      result: string
    }[]
  }
  trainingRecords: {
    trainingType: string
    trainingDate: string
    trainingCompany: string
    certificateNumber: string
    expirationDate: string
  }[]
  references: {
    name: string
    relationship: string
    phone: string
    email: string
    yearsKnown: string
  }[]
  drivingExperience: {
    equipmentTypes: {
      straightTruck: { years: number; miles: number }
      tractorTrailer: { years: number; miles: number }
      tractorTwoTrailers: { years: number; miles: number }
      specializedEquipment: { type: string; years: number; miles: number }[]
    }
    specialSkills: {
      moffettForklift: boolean
      craneOperations: boolean
      hazmatHandling: boolean
      borderCrossing: boolean
    }
  }
  safetyCompliance: {
    accidents: {
      date: string
      type: 'injury' | 'non-injury' | 'fatality'
      commercialVehicle: boolean
      dotRecordable: boolean
      atFault: boolean
      citationIssued: boolean
      description: string
    }[]
    violations: {
      date: string
      charge: string
      state: string
      commercialVehicle: boolean
      fineAmount: number
      licenseImpact: string
    }[]
    complianceQuestions: {
      fmcsrDisqualification: boolean
      licenseSuspension: boolean
      dotClearinghouseProhibitions: boolean
      positiveDrugTest: boolean
      duiDwi: boolean
      felonyCommercialVehicle: boolean
    }
  }
  authorizations: {
    fcraConsent: boolean
    backgroundCheckConsent: boolean
    drugTestingConsent: boolean
    employerContactConsent: boolean
    pspConsent: boolean
    clearinghouseQueryConsent: boolean
  }
}

export interface DriverApplicationRecord {
  id: string
  user_address: string
  application_data: DriverApplicationData
  current_step: number
  is_complete: boolean
  created_at: string
  updated_at: string
}

/**
 * Save driver application data to the database
 * This function handles both creating new applications and updating existing ones
 */
export async function saveDriverApplicationClient(
  userAddress: string,
  applicationData: DriverApplicationData,
  currentStep: number,
  // T1.6: when the caller already resolved the Storm users.id (via the dual-mode
  // session helper), pass it here to skip the wallet get-or-create entirely.
  // Legacy callers omit it and keep the wallet-keyed behavior unchanged.
  resolvedUserId?: string
): Promise<DriverApplicationRecord> {
  console.log('💾 Driver App DB: Saving application for user:', resolvedUserId || userAddress)
  console.log('💾 Driver App DB: Current step:', currentStep)

  // Use admin client to bypass RLS (called from API routes or server-side that validates wallet addresses)
  const supabase = await getAdminSupabaseClient()

  try {
    let userId: string
    if (resolvedUserId) {
      userId = resolvedUserId
    } else {
      // Legacy wallet path: single place for get-or-create user by wallet
      // (avoids duplicate user rows).
      const { getOrCreateUserByWallet } = await import('@/lib/user-by-wallet')
      const { user: userData } = await getOrCreateUserByWallet(supabase, userAddress)
      userId = userData.id
    }

    // Check if an application already exists for this user
    const { data: existingApp, error: fetchError } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, we'll create new
      console.error(
        '❌ Driver App DB: Error fetching existing application:',
        fetchError
      )
      throw new Error(
        `Failed to check existing application: ${fetchError.message}`
      )
    }

    let result
    if (existingApp) {
      // Update existing application
      console.log('💾 Driver App DB: Updating existing application')
      const { data, error } = await supabase
        .from('driver_applications')
        .update({
          application_data: applicationData,
          current_step: currentStep,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('❌ Driver App DB: Error updating application:', error)
        throw new Error(`Failed to update application: ${error.message}`)
      }

      result = data
    } else {
      // Create new application
      console.log('💾 Driver App DB: Creating new application')
      const { data, error } = await supabase
        .from('driver_applications')
        .insert({
          user_id: userId,
          application_data: applicationData,
          current_step: currentStep,
          is_complete: false,
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Driver App DB: Error creating application:', error)
        throw new Error(`Failed to create application: ${error.message}`)
      }

      result = data
    }

    console.log('✅ Driver App DB: Application saved successfully:', {
      id: result.id,
      current_step: result.current_step,
      is_complete: result.is_complete,
    })

    return result
  } catch (error) {
    console.error('❌ Driver App DB: Failed to save application:', error)
    throw error
  }
}

/**
 * Get driver application data for a specific user
 */
export async function getDriverApplicationClient(
  userAddress: string
): Promise<DriverApplicationRecord | null> {
  console.log('📖 Driver App DB: Getting application for user:', userAddress)

  // Use admin client to bypass RLS (called from API routes or server-side that validates wallet addresses)
  const supabase = await getAdminSupabaseClient()

  try {
    const userId = await resolveDriverAppUserId(supabase, userAddress)
    if (!userId) {
      console.log('📖 Driver App DB: User not found')
      return null
    }

    const { data, error } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('❌ Driver App DB: Error fetching application:', error)
      throw new Error(`Failed to fetch application: ${error.message}`)
    }

    if (!data) {
      // No application found - this is normal for new users
      console.log('📖 Driver App DB: No application found for user')
      return null
    }

    console.log('✅ Driver App DB: Application fetched successfully:', {
      id: data.id,
      current_step: data.current_step,
      is_complete: data.is_complete,
    })

    return data
  } catch (error) {
    console.error('❌ Driver App DB: Failed to get application:', error)
    throw error
  }
}

/**
 * Complete driver application (mark as finished)
 */
export async function completeDriverApplicationClient(
  userAddress: string,
  applicationData: DriverApplicationData,
  ipfsHash?: string,
  applicationHash?: string
): Promise<{
  success: boolean
  error?: string
  application?: DriverApplicationRecord
}> {
  console.log('🎯 Driver App DB: Completing application for user:', userAddress)

  // Use admin client to bypass RLS (called from API routes or server-side that validates wallet addresses)
  const supabase = await getAdminSupabaseClient()

  try {
    // Resolve id first — sessionUserId is users.id (UUID), not a wallet address
    const userId = await resolveDriverAppUserId(supabase, userAddress)
    if (!userId) {
      throw new Error(`User not found for session id: ${userAddress}`)
    }

    // Save final application data (pass resolved id so we skip wallet get-or-create)
    await saveDriverApplicationClient(
      userAddress,
      applicationData,
      10, // Final step
      userId,
    )

    // Mark complete. ipfs_hash is legacy (Pinata removed); keep column nullable.
    const updateData: Record<string, unknown> = {
      is_complete: true,
      ipfs_hash: ipfsHash && !ipfsHash.startsWith('placeholder_') ? ipfsHash : null,
      updated_at: new Date().toISOString(),
    }

    // Content hash for duplicate detection (not a chain tx)
    if (applicationHash) {
      updateData.application_hash = applicationHash
    }

    const { data, error } = await supabase
      .from('driver_applications')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error(
        '❌ Driver App DB: Error marking application as complete:',
        error
      )
      throw new Error(
        `Failed to mark application as complete: ${error.message}`
      )
    }

    console.log('✅ Driver App DB: Application completed successfully:', {
      id: data.id,
      is_complete: data.is_complete,
    })

    return {
      success: true,
      application: data,
    }
  } catch (error) {
    console.error('❌ Driver App DB: Failed to complete application:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if an application hash already exists for a user (duplicate detection)
 */
export async function checkDuplicateApplicationHash(
  userAddress: string,
  applicationHash: string
): Promise<{ exists: boolean; existingApplication?: DriverApplicationRecord }> {
  console.log('🔍 Driver App DB: Checking for duplicate hash:', applicationHash)
  
  // Use admin client to bypass RLS (called from API routes or server-side that validates wallet addresses)
  const supabase = await getAdminSupabaseClient()

  try {
    const userId = await resolveDriverAppUserId(supabase, userAddress)
    if (!userId) {
      console.log('🔍 Driver App DB: User not found, no duplicate possible')
      return { exists: false }
    }

    const { data, error } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('user_id', userId)
      .eq('application_hash', applicationHash)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 means not found, which is fine
      console.error('❌ Driver App DB: Error checking duplicate:', error)
      throw new Error(`Failed to check duplicate: ${error.message}`)
    }

    if (data) {
      console.log('⚠️ Driver App DB: Duplicate application hash found:', {
        id: data.id,
        created_at: data.created_at,
      })
      return { exists: true, existingApplication: data }
    }

    console.log('✅ Driver App DB: No duplicate found')
    return { exists: false }
  } catch (error) {
    console.error('❌ Driver App DB: Failed to check duplicate:', error)
    throw error
  }
}

/**
 * Get all applications for a user (for admin purposes)
 */
export async function getAllDriverApplicationsClient(
  userAddress: string
): Promise<DriverApplicationRecord[]> {
  console.log(
    '📋 Driver App DB: Getting all applications for user:',
    userAddress
  )

  // Use admin client to bypass RLS (called from API routes or server-side that validates wallet addresses)
  const supabase = await getAdminSupabaseClient()

  try {
    const userId = await resolveDriverAppUserId(supabase, userAddress)
    if (!userId) {
      console.log('📖 Driver App DB: User not found')
      return []
    }

    const { data, error } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Driver App DB: Error fetching applications:', error)
      throw new Error(`Failed to fetch applications: ${error.message}`)
    }

    console.log('✅ Driver App DB: Applications fetched successfully:', {
      count: data?.length || 0,
    })

    return data || []
  } catch (error) {
    console.error('❌ Driver App DB: Failed to get applications:', error)
    throw error
  }
}

/**
 * Delete a driver application
 */
export async function deleteDriverApplicationClient(
  userAddress: string,
  applicationId: string
): Promise<boolean> {
  console.log(
    '🗑️ Driver App DB: Deleting application:',
    applicationId,
    'for user:',
    userAddress
  )

  // Use admin client to bypass RLS (called from API routes or server-side that validates wallet addresses)
  const supabase = await getAdminSupabaseClient()

  try {
    const userId = await resolveDriverAppUserId(supabase, userAddress)
    if (!userId) {
      throw new Error(`User not found for session id: ${userAddress}`)
    }

    const { error } = await supabase
      .from('driver_applications')
      .delete()
      .eq('user_id', userId)
      .eq('id', applicationId)

    if (error) {
      console.error('❌ Driver App DB: Error deleting application:', error)
      throw new Error(`Failed to delete application: ${error.message}`)
    }

    console.log('✅ Driver App DB: Application deleted successfully')
    return true
  } catch (error) {
    console.error('❌ Driver App DB: Failed to delete application:', error)
    throw error
  }
}
