import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * API route to save employment verification data to Supabase
 * This saves the employment verification form data to the driver_applications table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, employmentVerificationData, applicationHash, transactionHash, applicationId } = body

    if (!userAddress || !employmentVerificationData) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress and employmentVerificationData are required' },
        { status: 400 }
      )
    }

    console.log('💾 Saving employment verification to Supabase for user:', userAddress)

    const supabase = await createClient()

    // Get user_id from wallet address
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', userAddress)
      .maybeSingle()

    if (userError || !userData) {
      console.error('❌ User not found for wallet address:', userAddress)
      return NextResponse.json(
        { error: 'User not found for wallet address' },
        { status: 404 }
      )
    }

    // Check if a driver_application exists for this user
    const { data: existingApp, error: fetchError } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, we'll create new
      console.error('❌ Error fetching existing application:', fetchError)
      return NextResponse.json(
        { error: `Failed to check existing application: ${fetchError.message}` },
        { status: 500 }
      )
    }

    let result
    if (existingApp) {
      // Update existing application with employment verification data
      console.log('💾 Updating existing driver application with employment verification')
      
      // Merge employment verification into existing application_data
      const updatedApplicationData = {
        ...existingApp.application_data,
        employmentVerification: employmentVerificationData,
      }

      const updateData: any = {
        application_data: updatedApplicationData,
        updated_at: new Date().toISOString(),
      }

      // If we have blockchain data, add it
      if (applicationHash) {
        updateData.application_hash = applicationHash
      }
      if (transactionHash) {
        updateData.blockchain_tx_hash = transactionHash
      }
      if (applicationId) {
        updateData.blockchain_application_id = String(applicationId)
      }

      const { data, error } = await supabase
        .from('driver_applications')
        .update(updateData)
        .eq('id', existingApp.id)
        .select()
        .single()

      if (error) {
        console.error('❌ Error updating application:', error)
        return NextResponse.json(
          { error: `Failed to update application: ${error.message}` },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Create new application record with employment verification data
      console.log('💾 Creating new driver application with employment verification')
      
      const insertData: any = {
        user_id: userData.id,
        application_data: {
          employmentVerification: employmentVerificationData,
        },
        current_step: 10, // Employment verification is typically after main forms
        is_complete: false,
      }

      // If we have blockchain data, add it
      if (applicationHash) {
        insertData.application_hash = applicationHash
      }
      if (transactionHash) {
        insertData.blockchain_tx_hash = transactionHash
      }
      if (applicationId) {
        insertData.blockchain_application_id = String(applicationId)
      }

      const { data, error } = await supabase
        .from('driver_applications')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating application:', error)
        return NextResponse.json(
          { error: `Failed to create application: ${error.message}` },
          { status: 500 }
        )
      }

      result = data
    }

    console.log('✅ Employment verification saved successfully:', {
      applicationId: result.id,
      hasEmploymentVerification: !!result.application_data?.employmentVerification,
    })

    return NextResponse.json({
      success: true,
      application: result,
    })
  } catch (error) {
    console.error('❌ Error saving employment verification:', error)
    return NextResponse.json(
      {
        error: 'Failed to save employment verification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

