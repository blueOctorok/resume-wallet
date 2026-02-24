import { NextRequest, NextResponse } from 'next/server'
import { saveDriverApplicationClient } from '@/lib/supabase-client-db'

/**
 * POST /api/driver-applications/save-progress
 * Save in-progress DOT application data to database
 * 
 * This allows users to resume their application across devices/sessions.
 * 
 * Headers:
 *   x-wallet-address: User's wallet address (required)
 * 
 * Body:
 *   {
 *     form1Data?: DotForm1Data,
 *     form2Data?: DotForm2Data,
 *     form3Data?: DotForm3Data,
 *     currentStep: number (1, 2, or 3)
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const { form1Data, form2Data, form3Data, currentStep } = await request.json()

    if (!currentStep || (currentStep < 1 || currentStep > 3)) {
      return NextResponse.json(
        { error: 'Valid currentStep (1-3) is required' },
        { status: 400 }
      )
    }

    // Combine all form data into a single application_data object
    const applicationData = {
      form1: form1Data || null,
      form2: form2Data || null,
      form3: form3Data || null,
    }

    console.log('[SAVE PROGRESS] Saving application progress:', {
      walletAddress,
      walletAddressLower: walletAddress.toLowerCase(),
      currentStep,
      hasForm1: !!form1Data,
      hasForm2: !!form2Data,
      hasForm3: !!form3Data,
    })

    // Save to database (creates or updates existing application)
    const result = await saveDriverApplicationClient(
      walletAddress,
      applicationData,
      currentStep
    )

    console.log('[SAVE PROGRESS] Application saved successfully:', {
      applicationId: result.id,
      userId: result.user_id,
      currentStep: result.current_step,
      isComplete: result.is_complete,
    })

    return NextResponse.json({
      success: true,
      application: {
        id: result.id,
        currentStep: result.current_step,
        isComplete: result.is_complete,
        updatedAt: result.updated_at,
      },
    })
  } catch (error: any) {
    console.error('[SAVE PROGRESS] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save progress',
        details: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
