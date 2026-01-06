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

    // Log EVERYTHING for debugging - we need to see what Accio sends
    console.log('[MVR WEBHOOK] ========== INCOMING WEBHOOK ==========')
    console.log('[MVR WEBHOOK] Body length:', xmlBody.length)
    console.log('[MVR WEBHOOK] Full XML body:', xmlBody)
    console.log('[MVR WEBHOOK] ========================================')

    if (!xmlBody) {
      console.error('[MVR WEBHOOK] Empty body received')
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    // Check if this is a completion notification - Accio sends different formats:
    // 1. <ScreeningResults><completeOrder>...</completeOrder></ScreeningResults> (full order)
    // 2. <postResults order="..." subOrder="..." type="MVR">...</postResults> (individual result)
    const isScreeningResults = xmlBody.includes('<ScreeningResults>') || xmlBody.includes('<completeOrder')
    const isPostResults = xmlBody.includes('<postResults')
    const isCompletionNotification = isScreeningResults || isPostResults
    
    const isConfirmation = xmlBody.includes('<orderConfirmation>') || xmlBody.includes('<confirmation>')
    const isInProgress = xmlBody.includes('<inProgress>') || xmlBody.includes('<status>inprogress')
    
    if (!isCompletionNotification) {
      // This might be a confirmation or in-progress notification - acknowledge but don't process
      console.log('[MVR WEBHOOK] Non-completion notification received. Type detection:', {
        isConfirmation,
        isInProgress,
        hasScreeningResults: xmlBody.includes('<ScreeningResults>'),
        hasCompleteOrder: xmlBody.includes('<completeOrder'),
        hasPostResults: xmlBody.includes('<postResults'),
        firstTag: xmlBody.match(/<([a-zA-Z_]+)/)?.[1] || 'unknown'
      })
      // Return 200 to acknowledge receipt - don't want Accio to keep retrying
      return NextResponse.json({ 
        success: true, 
        message: 'Non-completion notification acknowledged',
        type: isConfirmation ? 'confirmation' : isInProgress ? 'in_progress' : 'unknown'
      })
    }
    
    console.log('[MVR WEBHOOK] Detected format:', isPostResults ? 'postResults' : 'ScreeningResults')

    console.log('[MVR WEBHOOK] Processing completion notification')

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
    // Use remoteOrderNumber as fallback if orderNumber is empty (Accio sometimes only sends remote_number)
    const orderNumber = parsedResult.orderNumber || parsedResult.remoteOrderNumber || ''
    const subOrderNumber = parsedResult.subOrderNumber || parsedResult.remoteSubOrderNumber

    if (!orderNumber || !subOrderNumber) {
      console.error('[MVR WEBHOOK] Missing order numbers in XML', {
        orderNumber: parsedResult.orderNumber,
        remoteOrderNumber: parsedResult.remoteOrderNumber,
        subOrderNumber: parsedResult.subOrderNumber,
        remoteSubOrderNumber: parsedResult.remoteSubOrderNumber,
        licenseNumber: parsedResult.licenseNumber,
        licenseState: parsedResult.licenseState,
        parsedResult: {
          orderNumber: parsedResult.orderNumber,
          subOrderNumber: parsedResult.subOrderNumber,
          remoteOrderNumber: parsedResult.remoteOrderNumber,
          remoteSubOrderNumber: parsedResult.remoteSubOrderNumber
        }
      })
      // Log more of the XML to help debug
      console.error('[MVR WEBHOOK] Full XML (first 2000 chars):', xmlBody.substring(0, 2000))
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

    // First, log ALL pending orders for debugging
    const { data: allPendingOrders } = await supabaseService
      .from('mvr_orders')
      .select('id, accio_order_number, accio_suborder_number, accio_remote_order_number, dl_number, dl_state, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10)
    
    console.log('[MVR WEBHOOK] All pending orders in DB:', JSON.stringify(allPendingOrders, null, 2))
    console.log('[MVR WEBHOOK] Looking for match with:', {
      orderNumber,
      subOrderNumber,
      remoteOrderNumber: parsedResult.remoteOrderNumber,
      remoteSubOrderNumber: parsedResult.remoteSubOrderNumber,
      licenseNumber: parsedResult.licenseNumber,
      licenseState: parsedResult.licenseState
    })

    // 1. Find the MVR order - try multiple matching strategies
    // Strategy 1: Match by our order number (from reference_number or direct match)
    // Handle case where accio_suborder_number might be NULL in DB
    console.log('[MVR WEBHOOK] Strategy 1: Looking for accio_order_number =', orderNumber)
    let { data: mvrOrder, error: orderError } = await supabaseService
      .from('mvr_orders')
      .select('*, driver_user_id, driver_profile_id')
      .eq('accio_order_number', orderNumber)
      .or(subOrderNumber 
        ? `accio_suborder_number.eq.${subOrderNumber},accio_suborder_number.is.null`
        : 'accio_suborder_number.is.null'
      )
      .maybeSingle()
    
    if (mvrOrder) {
      console.log('[MVR WEBHOOK] Strategy 1 SUCCESS: Found order', mvrOrder.id)
    } else {
      console.log('[MVR WEBHOOK] Strategy 1 FAILED: No match for accio_order_number =', orderNumber)
    }

    // Strategy 2: If not found, try matching by Accio's remote_number
    if (!mvrOrder && parsedResult.remoteOrderNumber) {
      console.log('[MVR WEBHOOK] Strategy 2: Looking for accio_remote_order_number =', parsedResult.remoteOrderNumber)
      const { data: remoteMatch, error: remoteError } = await supabaseService
        .from('mvr_orders')
        .select('*, driver_user_id, driver_profile_id')
        .eq('accio_remote_order_number', parsedResult.remoteOrderNumber)
        .maybeSingle()
      
      if (remoteMatch && !remoteError) {
        console.log('[MVR WEBHOOK] Strategy 2 SUCCESS: Found order', remoteMatch.id)
        mvrOrder = remoteMatch
        orderError = null
      } else {
        console.log('[MVR WEBHOOK] Strategy 2 FAILED: No match for accio_remote_order_number =', parsedResult.remoteOrderNumber)
      }
    }

    // Strategy 3: If still not found, try matching by DL number and state
    // This handles cases where Accio doesn't populate reference_number or remote_number wasn't stored
    if (!mvrOrder && parsedResult.licenseNumber && parsedResult.licenseState) {
      console.log('[MVR WEBHOOK] Strategy 3: Looking for dl_number =', parsedResult.licenseNumber, 'dl_state =', parsedResult.licenseState)
      const { data: accioMatch, error: accioError } = await supabaseService
        .from('mvr_orders')
        .select('*, driver_user_id, driver_profile_id')
        .eq('status', 'pending')
        .eq('dl_number', parsedResult.licenseNumber)
        .eq('dl_state', parsedResult.licenseState)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (accioMatch && !accioError) {
        console.log('[MVR WEBHOOK] Strategy 3 SUCCESS: Found order', accioMatch.id, '- updating remote order numbers')
        // Update the order with Accio's remote numbers for future matching
        await supabaseService
          .from('mvr_orders')
          .update({
            accio_remote_order_number: parsedResult.remoteOrderNumber || null,
            accio_remote_suborder_number: parsedResult.remoteSubOrderNumber || null
          })
          .eq('id', accioMatch.id)
        mvrOrder = accioMatch
        orderError = null
      } else {
        console.log('[MVR WEBHOOK] Strategy 3 FAILED: No match for dl_number =', parsedResult.licenseNumber)
      }
    }

    // Strategy 4: Last resort - find most recent pending order by state only
    // This helps when DL numbers don't match but we have a pending order in the same state
    if (!mvrOrder && parsedResult.licenseState) {
      console.log('[MVR WEBHOOK] Strategy 4: Looking for ANY pending order in state =', parsedResult.licenseState)
      const { data: stateMatch, error: stateError } = await supabaseService
        .from('mvr_orders')
        .select('*, driver_user_id, driver_profile_id')
        .eq('status', 'pending')
        .eq('dl_state', parsedResult.licenseState)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (stateMatch && !stateError) {
        console.log('[MVR WEBHOOK] Strategy 4 SUCCESS: Found order', stateMatch.id, 'with dl_number =', stateMatch.dl_number, '(webhook had dl =', parsedResult.licenseNumber, ')')
        // Log warning about DL mismatch
        console.warn('[MVR WEBHOOK] WARNING: DL number mismatch! Order DL:', stateMatch.dl_number, '!= Webhook DL:', parsedResult.licenseNumber)
        // Update the order with Accio's remote numbers
        await supabaseService
          .from('mvr_orders')
          .update({
            accio_remote_order_number: parsedResult.remoteOrderNumber || null,
            accio_remote_suborder_number: parsedResult.remoteSubOrderNumber || null
          })
          .eq('id', stateMatch.id)
        mvrOrder = stateMatch
        orderError = null
      } else {
        console.log('[MVR WEBHOOK] Strategy 4 FAILED: No pending orders in state =', parsedResult.licenseState)
      }
    }

    if (orderError || !mvrOrder) {
      console.error('[MVR WEBHOOK] MVR order not found after all strategies:', {
        orderNumber,
        subOrderNumber,
        remoteOrderNumber: parsedResult.remoteOrderNumber,
        remoteSubOrderNumber: parsedResult.remoteSubOrderNumber,
        licenseNumber: parsedResult.licenseNumber,
        licenseState: parsedResult.licenseState,
        pendingOrdersInDb: allPendingOrders?.map(o => ({ 
          id: o.id, 
          accio_order: o.accio_order_number, 
          dl: o.dl_number, 
          state: o.dl_state 
        })),
        strategiesAttempted: [
          'Strategy 1: order_number + suborder_number match',
          'Strategy 2: remote_order_number match',
          'Strategy 3: DL number + state match',
          'Strategy 4: Any pending order in same state'
        ]
      })
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

