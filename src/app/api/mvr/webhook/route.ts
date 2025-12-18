import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseAccioMvrResult, mvrResultToJsonb } from '@/lib/accio-xml-parser'
import { calculateProfileScore } from '@/lib/profile-completeness'

/**
 * Convert YYYYMMDD date format to ISO date string for database storage
 */
function formatDateForDb(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr.length !== 8) return null
  
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)
  
  // Return as YYYY-MM-DD format
  return `${year}-${month}-${day}`
}

/**
 * API Route: Accio Webhook Handler
 * 
 * POST /api/mvr/webhook
 * 
 * Receives MVR results from Accio via webhook
 * Parses XML, stores results, and updates driver profiles
 * 
 * Note: This endpoint should be called by Accio, not directly by users
 * Uses service role key to bypass RLS for webhook processing
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw XML body
    const xmlBody = await request.text()

    if (!xmlBody || !xmlBody.includes('<ScreeningResults>')) {
      console.error('[MVR WEBHOOK] Invalid XML body received')
      return NextResponse.json(
        { error: 'Invalid XML body' },
        { status: 400 }
      )
    }

    console.log('[MVR WEBHOOK] Received MVR results from Accio')

    // Parse XML result
    let parsedResult
    try {
      parsedResult = parseAccioMvrResult(xmlBody)
    } catch (error: any) {
      console.error('[MVR WEBHOOK] Error parsing XML:', error)
      return NextResponse.json(
        { error: 'Failed to parse XML result', details: error.message },
        { status: 400 }
      )
    }

    // Extract order numbers from XML
    const orderNumber = parsedResult.orderNumber
    const subOrderNumber = parsedResult.subOrderNumber

    if (!orderNumber || !subOrderNumber) {
      console.error('[MVR WEBHOOK] Missing order numbers in XML')
      return NextResponse.json(
        { error: 'Missing order numbers in result' },
        { status: 400 }
      )
    }

    console.log('[MVR WEBHOOK] Processing order:', orderNumber, 'subOrder:', subOrderNumber)

    // Use service role client to bypass RLS
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Find the MVR order
    const { data: mvrOrder, error: orderError } = await supabaseService
      .from('mvr_orders')
      .select('*, driver_user_id, driver_profile_id')
      .eq('accio_order_number', orderNumber)
      .eq('accio_suborder_number', subOrderNumber)
      .single()

    if (orderError || !mvrOrder) {
      console.error('[MVR WEBHOOK] MVR order not found:', orderNumber, subOrderNumber)
      return NextResponse.json(
        { error: 'MVR order not found' },
        { status: 404 }
      )
    }

    // 2. Check if result already exists (idempotency)
    const { data: existingResult } = await supabaseService
      .from('mvr_results')
      .select('id')
      .eq('mvr_order_id', mvrOrder.id)
      .maybeSingle()

    if (existingResult) {
      console.log('[MVR WEBHOOK] Result already exists, updating...')
    }

    // 3. Convert parsed result to JSONB for storage
    const parsedData = mvrResultToJsonb(parsedResult)

    // 4. Extract license details from mvr_license blocks (use first license as primary)
    const primaryLicense = parsedResult.licenses && parsedResult.licenses.length > 0 
      ? parsedResult.licenses[0] 
      : null

    // 5. Store or update MVR result
    const resultData = {
      mvr_order_id: mvrOrder.id,
      driver_user_id: mvrOrder.driver_user_id,
      driver_profile_id: mvrOrder.driver_profile_id,
      license_number: parsedResult.licenseNumber,
      license_state: parsedResult.licenseState,
      license_class: primaryLicense?.class || null, // From mvr_license block
      license_status: primaryLicense?.status || null, // From mvr_license block
      license_expiration_date: primaryLicense?.expirationDate 
        ? formatDateForDb(primaryLicense.expirationDate) 
        : (parsedResult.licenseExpirationDate ? formatDateForDb(parsedResult.licenseExpirationDate) : null),
      total_points: parsedResult.totalPoints || 0,
      violation_count: parsedResult.violationCount || 0,
      violations: parsedResult.violations || [],
      accident_count: parsedResult.accidentCount || 0,
      accidents: parsedResult.accidents || [],
      suspension_count: parsedResult.suspensionCount || 0,
      suspensions: parsedResult.suspensions || [],
      medical_cert_expiration: parsedResult.medicalCertExpiration || null,
      medical_cert_status: parsedResult.medicalCertStatus || null,
      cdl_endorsements: primaryLicense?.endorsements ? [primaryLicense.endorsements] : [],
      cdl_restrictions: primaryLicense?.restrictions ? [primaryLicense.restrictions] : [],
      parsed_data: parsedData, // Complete structured data for prefilling
      result_status: 'parsed',
      parsed_at: new Date().toISOString()
    }

    let mvrResult
    if (existingResult) {
      // Update existing result
      const { data: updated, error: updateError } = await supabaseService
        .from('mvr_results')
        .update(resultData)
        .eq('id', existingResult.id)
        .select()
        .single()

      if (updateError) {
        console.error('[MVR WEBHOOK] Error updating result:', updateError)
        throw updateError
      }
      mvrResult = updated
    } else {
      // Insert new result
      const { data: inserted, error: insertError } = await supabaseService
        .from('mvr_results')
        .insert(resultData)
        .select()
        .single()

      if (insertError) {
        console.error('[MVR WEBHOOK] Error inserting result:', insertError)
        throw insertError
      }
      mvrResult = inserted
    }

    // 5. Update MVR order status
    const { error: orderUpdateError } = await supabaseService
      .from('mvr_orders')
      .update({
        status: parsedResult.filledCode === 'verified' ? 'completed' : 'needs_review',
        accio_remote_order_number: parsedResult.remoteOrderNumber,
        accio_remote_suborder_number: parsedResult.remoteSubOrderNumber,
        processed_at: parsedResult.timeFilled || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        result_xml: xmlBody,
        fee_amount: parsedResult.fees?.addon || null
      })
      .eq('id', mvrOrder.id)

    if (orderUpdateError) {
      console.error('[MVR WEBHOOK] Error updating order:', orderUpdateError)
      // Don't fail - result is stored, order update is secondary
    }

    // 6. Update driver profile (trigger should handle this, but we'll do it explicitly)
    if (mvrOrder.driver_profile_id) {
      const { error: profileUpdateError } = await supabaseService
        .from('driver_profiles')
        .update({
          mvr_order_id: mvrOrder.id,
          mvr_result_id: mvrResult.id,
          mvr_expires_at: mvrOrder.expires_at,
          mvr_license_status: parsedResult.licenseStatus,
          mvr_total_points: parsedResult.totalPoints || 0,
          mvr_violation_count: parsedResult.violationCount || 0,
          mvr_last_ordered_at: mvrOrder.ordered_at
        })
        .eq('id', mvrOrder.driver_profile_id)

      if (profileUpdateError) {
        console.error('[MVR WEBHOOK] Error updating profile:', profileUpdateError)
        // Don't fail - result is stored
      }

      // 7. Recalculate profile completeness score
      const { data: updatedProfile } = await supabaseService
        .from('driver_profiles')
        .select('*')
        .eq('id', mvrOrder.driver_profile_id)
        .single()

      if (updatedProfile) {
        const scoreResult = calculateProfileScore(updatedProfile)
        await supabaseService
          .from('driver_profiles')
          .update({ profile_completion_score: scoreResult.score })
          .eq('id', mvrOrder.driver_profile_id)
      }
    }

    console.log('[MVR WEBHOOK] MVR result processed successfully:', mvrResult.id)

    return NextResponse.json({
      success: true,
      message: 'MVR result processed successfully',
      orderNumber,
      subOrderNumber
    })

  } catch (error: any) {
    console.error('[MVR WEBHOOK] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET handler for webhook health check
 * Allows verification that the webhook endpoint is accessible
 */
export async function GET() {
  return NextResponse.json(
    { 
      message: 'MVR webhook endpoint is active',
      method: 'POST',
      description: 'This endpoint receives MVR results from Accio via POST requests'
    },
    { status: 200 }
  )
}

