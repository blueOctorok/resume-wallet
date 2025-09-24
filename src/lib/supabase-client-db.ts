import { createClient } from '@/utils/supabase/client'

// Client-side database operations for driver applications
export async function getDriverApplicationClient(userAddress: string) {
  console.log('📋 Client DB: Getting driver application for:', userAddress)

  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('user_address', userAddress)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Client DB: Get application error:', error)
      // Don't throw on 406 errors, just log and return null
      if (
        error.message?.includes('406') ||
        error.message?.includes('Not Acceptable')
      ) {
        console.warn(
          '⚠️ Client DB: 406 error, likely table/RLS issue. Returning null.'
        )
        return null
      }
      throw error
    }

    if (data) {
      console.log('✅ Client DB: Found existing application:', data)
    } else {
      console.log('📝 Client DB: No existing application found')
    }

    return data
  } catch (error) {
    console.error('❌ Client DB: Get application failed:', error)
    throw error
  }
}

export async function saveDriverApplicationClient(
  userAddress: string,
  applicationData: any,
  currentStep: number
) {
  console.log('💾 Client DB: Saving driver application...')
  console.log('💾 Client DB: User:', userAddress)
  console.log('💾 Client DB: Step:', currentStep)

  try {
    const supabase = createClient()

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
      console.error('❌ Client DB: Save application error:', error)
      throw error
    }

    console.log('✅ Client DB: Application saved successfully:', data)
    return data
  } catch (error) {
    console.error('❌ Client DB: Save application failed:', error)
    throw error
  }
}

export async function completeDriverApplicationClient(
  userAddress: string,
  applicationData: any
) {
  console.log('🎉 Client DB: Completing driver application...')
  console.log('🎉 Client DB: User:', userAddress)

  try {
    const supabase = createClient()

    // First, try to get the existing record to get the ID
    const { data: existingData, error: fetchError } = await supabase
      .from('driver_applications')
      .select('id')
      .eq('user_address', userAddress)
      .single()

    let result

    if (existingData) {
      // Update existing record
      console.log('🔄 Client DB: Updating existing application')
      const { data, error } = await supabase
        .from('driver_applications')
        .update({
          application_data: applicationData,
          current_step: 10, // All 10 steps complete
          is_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_address', userAddress)
        .select()
        .single()

      if (error) {
        console.error('❌ Client DB: Update application error:', error)
        throw error
      }

      result = data
    } else {
      // Insert new record
      console.log('➕ Client DB: Creating new application')
      const { data, error } = await supabase
        .from('driver_applications')
        .insert({
          user_address: userAddress,
          application_data: applicationData,
          current_step: 10, // All 10 steps complete
          is_complete: true,
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Client DB: Insert application error:', error)
        throw error
      }

      result = data
    }

    console.log('✅ Client DB: Application completed successfully:', result)
    return { success: true, data: result }
  } catch (error) {
    console.error('❌ Client DB: Complete application failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
