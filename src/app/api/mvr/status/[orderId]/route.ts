import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Extract a single XML tag value from raw XML string
 */
function extractXmlValue(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i')
  const match = xml.match(regex)
  return match?.[1]?.trim() || undefined
}

/**
 * Extract clean subject (name) from raw MVR XML
 * This bypasses any corrupted parsed_data by going straight to the source
 */
function extractSubjectFromRawXml(rawXml: string | null): { firstName?: string; middleName?: string; lastName?: string } | null {
  if (!rawXml) return null
  
  // Find the <subject> block
  const subjectMatch = rawXml.match(/<subject[^>]*>([\s\S]*?)<\/subject>/i)
  if (!subjectMatch) return null
  
  const subjectXml = subjectMatch[1]
  
  return {
    firstName: extractXmlValue(subjectXml, 'name_first'),
    middleName: extractXmlValue(subjectXml, 'name_middle'),
    lastName: extractXmlValue(subjectXml, 'name_last'),
  }
}

/**
 * API Route: Get MVR Order Status
 * 
 * GET /api/mvr/status/[orderId]
 * 
 * Returns the current status of an MVR order and its results (if available)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS (we use Alchemy wallet auth, not Supabase Auth)
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get MVR order with result - include all detailed data AND raw XML for clean name extraction
    const { data: mvrOrder, error: orderError } = await supabase
      .from('mvr_orders')
      .select(`
        *,
        result_xml,
        mvr_results (
          id,
          license_number,
          license_state,
          license_class,
          license_status,
          license_expiration_date,
          total_points,
          violation_count,
          violations,
          accident_count,
          accidents,
          suspension_count,
          suspensions,
          medical_cert_expiration,
          medical_cert_status,
          cdl_endorsements,
          cdl_restrictions,
          result_status,
          received_at,
          parsed_at,
          parsed_data
        )
      `)
      .eq('id', orderId)
      .eq('driver_user_id', user.id)
      .single()

    if (orderError || !mvrOrder) {
      return NextResponse.json(
        { error: 'MVR order not found' },
        { status: 404 }
      )
    }

    // Format response
    const result = Array.isArray(mvrOrder.mvr_results) 
      ? mvrOrder.mvr_results[0] 
      : mvrOrder.mvr_results

    // Extract clean subject directly from raw XML (bypasses corrupted parsed_data)
    const cleanSubject = extractSubjectFromRawXml(mvrOrder.result_xml)

    return NextResponse.json({
      success: true,
      order: {
        id: mvrOrder.id,
        orderNumber: mvrOrder.accio_order_number,
        subOrderNumber: mvrOrder.accio_suborder_number,
        status: mvrOrder.status,
        orderType: mvrOrder.order_type,
        dlNumber: mvrOrder.dl_number,
        dlState: mvrOrder.dl_state,
        orderedAt: mvrOrder.ordered_at,
        processedAt: mvrOrder.processed_at,
        completedAt: mvrOrder.completed_at,
        expiresAt: mvrOrder.expires_at,
        feeAmount: mvrOrder.fee_amount,
        errorMessage: mvrOrder.error_message,
        applicantPortalUrl: mvrOrder.applicant_portal_url
      },
      result: result ? {
        id: result.id,
        // Subject extracted directly from raw XML (clean, not from corrupted parsed_data)
        subject: cleanSubject,
        // License info
        licenseNumber: result.license_number,
        licenseState: result.license_state,
        licenseClass: result.license_class,
        licenseStatus: result.license_status,
        licenseExpirationDate: result.license_expiration_date,
        // All licenses (from parsed_data if available)
        licenses: result.parsed_data?.licenses || [],
        // Summary counts
        totalPoints: result.total_points,
        violationCount: result.violation_count,
        accidentCount: result.accident_count,
        suspensionCount: result.suspension_count,
        // Detailed arrays
        violations: result.violations || [],
        accidents: result.accidents || [],
        suspensions: result.suspensions || [],
        // Medical certificate
        medicalCertExpiration: result.medical_cert_expiration || result.parsed_data?.medical?.certExpiration,
        medicalCertIssueDate: result.parsed_data?.medical?.certIssueDate,
        medicalCertStatus: result.medical_cert_status || result.parsed_data?.medical?.certStatus,
        medicalCertSelfCertification: result.parsed_data?.medical?.selfCertification,
        // CDL info
        cdlEndorsements: result.cdl_endorsements || [],
        cdlRestrictions: result.cdl_restrictions || [],
        // Status
        resultStatus: result.result_status,
        receivedAt: result.received_at,
        parsedAt: result.parsed_at
      } : null
    })

  } catch (error: any) {
    console.error('[MVR STATUS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

