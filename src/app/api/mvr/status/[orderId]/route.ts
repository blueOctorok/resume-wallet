import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'

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

const MVR_ORDER_SELECT = `
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
      `

function jsonFromMvrOrderRow(mvrOrder: Record<string, unknown>) {
  const result = Array.isArray(mvrOrder.mvr_results)
    ? (mvrOrder.mvr_results[0] as Record<string, unknown> | undefined)
    : (mvrOrder.mvr_results as Record<string, unknown> | undefined)

  const cleanSubject = extractSubjectFromRawXml((mvrOrder.result_xml as string | null) ?? null)

  return {
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
      applicantPortalUrl: mvrOrder.applicant_portal_url,
    },
    result: result
      ? {
          id: result.id,
          subject: cleanSubject,
          licenseNumber: result.license_number,
          licenseState: result.license_state,
          licenseClass: result.license_class,
          licenseStatus: result.license_status,
          licenseExpirationDate: result.license_expiration_date,
          licenses: (result.parsed_data as { licenses?: unknown[] } | null)?.licenses || [],
          totalPoints: result.total_points,
          violationCount: result.violation_count,
          accidentCount: result.accident_count,
          suspensionCount: result.suspension_count,
          violations: result.violations || [],
          accidents: result.accidents || [],
          suspensions: result.suspensions || [],
          medicalCertExpiration:
            result.medical_cert_expiration ||
            (result.parsed_data as { medical?: { certExpiration?: string } } | null)?.medical?.certExpiration,
          medicalCertIssueDate: (result.parsed_data as { medical?: { certIssueDate?: string } } | null)?.medical
            ?.certIssueDate,
          medicalCertStatus:
            result.medical_cert_status ||
            (result.parsed_data as { medical?: { certStatus?: string } } | null)?.medical?.certStatus,
          medicalCertSelfCertification: (result.parsed_data as { medical?: { selfCertification?: string } } | null)
            ?.medical?.selfCertification,
          cdlEndorsements: result.cdl_endorsements || [],
          cdlRestrictions: result.cdl_restrictions || [],
          resultStatus: result.result_status,
          receivedAt: result.received_at,
          parsedAt: result.parsed_at,
        }
      : null,
  }
}

/**
 * API Route: Get MVR Order Status
 *
 * GET /api/mvr/status/[orderId]?walletAddress=...
 *
 * Candidate (driver): wallet must own the order (`driver_user_id`).
 *
 * Employer purchaser: pass **`employerCandidateUserId`** (the candidate’s `users.id`).
 * Wallet must belong to a user in the **same company** that paid (`ordered_by_company_id`).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')
    const employerCandidateUserId = searchParams.get('employerCandidateUserId')

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    if (employerCandidateUserId) {
      const ctx = await resolveEmployerCompanyForWallet(supabase, walletAddress)
      if (!ctx) {
        return NextResponse.json({ error: 'No company access' }, { status: 403 })
      }

      const { data: mvrOrder, error: orderError } = await supabase
        .from('mvr_orders')
        .select(MVR_ORDER_SELECT)
        .eq('id', orderId)
        .eq('driver_user_id', employerCandidateUserId)
        .eq('ordered_by_company_id', ctx.companyId)
        .single()

      if (orderError || !mvrOrder) {
        return NextResponse.json({ error: 'MVR order not found' }, { status: 404 })
      }

      return NextResponse.json(jsonFromMvrOrderRow(mvrOrder as Record<string, unknown>))
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: mvrOrder, error: orderError } = await supabase
      .from('mvr_orders')
      .select(MVR_ORDER_SELECT)
      .eq('id', orderId)
      .eq('driver_user_id', user.id)
      .single()

    if (orderError || !mvrOrder) {
      return NextResponse.json({ error: 'MVR order not found' }, { status: 404 })
    }

    return NextResponse.json(jsonFromMvrOrderRow(mvrOrder as Record<string, unknown>))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[MVR STATUS] Error:', error)
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}

