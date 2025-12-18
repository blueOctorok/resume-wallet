import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ParsedMvrResult } from '@/lib/accio-xml-parser'
import { mapMvrToForm1Data, getMvrExtractionSummary } from '@/lib/mvr-to-dot-mapper'

/**
 * API Route: Prefill DOT Application from MVR Results
 * 
 * POST /api/driver/prefill-from-mvr
 * 
 * Gets the latest MVR result for a driver and maps it to DOT application Form 1 data.
 * Only returns data - does not update the application. The client should merge this
 * with existing application data and update the form.
 * 
 * Request Body: { walletAddress: string }
 * 
 * Response: {
 *   success: boolean
 *   form1Data: any (Form 1 data structure)
 *   summary: { totalFields, extractedFields, fieldNames }
 *   mvrResultId: string (UUID of the MVR result used)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json()

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    console.log('[MVR PREFILL] Starting prefill for wallet:', walletAddress)

    const supabase = await createClient()

    // 1. Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      console.error('[MVR PREFILL] User not found:', walletAddress)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 2. Get latest MVR result with parsed data
    const { data: mvrResult, error: mvrError } = await supabase
      .from('mvr_results')
      .select('id, parsed_data, license_number, license_state, license_expiration_date, result_status, received_at')
      .eq('driver_user_id', user.id)
      .eq('result_status', 'parsed') // Only use successfully parsed results
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (mvrError) {
      console.error('[MVR PREFILL] Error fetching MVR result:', mvrError)
      return NextResponse.json(
        { error: 'Failed to fetch MVR result' },
        { status: 500 }
      )
    }

    if (!mvrResult || !mvrResult.parsed_data) {
      console.log('[MVR PREFILL] No parsed MVR result found for user')
      return NextResponse.json(
        { 
          error: 'No MVR results found',
          message: 'Please order an MVR first before using prefill'
        },
        { status: 404 }
      )
    }

    // 3. Convert parsed_data JSONB to ParsedMvrResult format
    // The parsed_data is stored as JSONB from mvrResultToJsonb function
    // We need to reconstruct it to match ParsedMvrResult interface
    const parsedData = mvrResult.parsed_data as any

    // Reconstruct ParsedMvrResult from stored JSONB
    const mvrResultParsed: ParsedMvrResult = {
      orderNumber: parsedData.orderNumber || '',
      subOrderNumber: parsedData.subOrderNumber || '',
      remoteOrderNumber: parsedData.remoteOrderNumber,
      remoteSubOrderNumber: parsedData.remoteSubOrderNumber,
      timeOrdered: parsedData.timeOrdered,
      timeFilled: parsedData.timeFilled,
      filledStatus: parsedData.status?.filledStatus,
      filledCode: parsedData.status?.filledCode,
      heldForReview: parsedData.status?.heldForReview,
      heldForReleaseForm: parsedData.status?.heldForReleaseForm,
      subject: parsedData.subject ? {
        firstName: parsedData.subject.firstName,
        middleName: parsedData.subject.middleName,
        lastName: parsedData.subject.lastName,
        nameSuffix: parsedData.subject.nameSuffix,
        dateOfBirth: parsedData.subject.dateOfBirth,
        email: parsedData.subject.email,
        phone: parsedData.subject.phone,
        address: parsedData.subject.address,
        city: parsedData.subject.city,
        state: parsedData.subject.state,
        zip: parsedData.subject.zip,
        country: parsedData.subject.country,
        gender: parsedData.subject.gender
      } : undefined,
      licenseNumber: parsedData.license?.number || mvrResult.license_number,
      licenseState: parsedData.license?.state || mvrResult.license_state,
      licenseExpirationDate: parsedData.license?.expirationDate || mvrResult.license_expiration_date,
      licenses: parsedData.licenses ? parsedData.licenses.map((l: any) => ({
        issueDate: l.issueDate,
        expirationDate: l.expirationDate,
        class: l.class,
        code: l.code,
        type: l.type,
        status: l.status,
        endorsements: l.endorsements,
        restrictions: l.restrictions
      })) : undefined,
      violations: parsedData.violations?.details || [],
      violationCount: parsedData.violations?.count || 0,
      totalPoints: parsedData.violations?.totalPoints || 0,
      accidents: parsedData.accidents?.details || [],
      accidentCount: parsedData.accidents?.count || 0,
      suspensions: parsedData.suspensions?.details || [],
      suspensionCount: parsedData.suspensions?.count || 0,
      medicalCertExpiration: parsedData.medical?.certExpiration,
      medicalCertStatus: parsedData.medical?.certStatus,
      fees: parsedData.fees
    }

    // 4. Map MVR result to Form 1 data
    const form1Data = mapMvrToForm1Data(mvrResultParsed)

    // 5. Get extraction summary
    const summary = getMvrExtractionSummary(mvrResultParsed)

    console.log('[MVR PREFILL] Successfully mapped MVR to Form 1 data:', summary.extractedFields, 'fields extracted')

    return NextResponse.json({
      success: true,
      form1Data,
      summary,
      mvrResultId: mvrResult.id,
      mvrReceivedAt: mvrResult.received_at
    })

  } catch (error: any) {
    console.error('[MVR PREFILL] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

