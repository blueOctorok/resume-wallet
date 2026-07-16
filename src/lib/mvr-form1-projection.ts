/**
 * Load the latest driver-owned parsed MVR and map it to Form 1 + Form 2 + provenance.
 * Shared by prefill-from-mvr, save-progress projection, and MVR webhook late-apply.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedMvrResult } from '@/lib/accio-xml-parser'
import { mapMvrToForm1Data, getMvrExtractionSummary } from '@/lib/mvr-to-dot-mapper'
import { mapMvrToForm2Rows } from '@/lib/mvr-to-form2-mapper'
import { buildMvrForm1Provenance, type DotForm1FieldProvenance } from '@/lib/dot-field-provenance'
import type { Form2AccidentRow, Form2ConvictionRow } from '@/lib/mvr-to-form2-mapper'
import { isDriverOwnedScreeningOrder } from '@/lib/screening-order-ownership'

export interface MvrDotProjection {
  form1Data: Record<string, unknown>
  form1Provenance: DotForm1FieldProvenance
  mvrAccidents: Form2AccidentRow[]
  mvrConvictions: Form2ConvictionRow[]
  summary: ReturnType<typeof getMvrExtractionSummary>
  mvrResultId: string
  orderId: string | null
  accioOrderNumber: string | null
  mvrReceivedAt: string | null
  asOf: string
  parsed: ParsedMvrResult
}

/** @deprecated Use MvrDotProjection — kept for call sites mid-rename */
export type MvrForm1Projection = MvrDotProjection

function reconstructParsedMvr(
  parsedData: Record<string, unknown>,
  columns: {
    license_number: string | null
    license_state: string | null
    license_expiration_date: string | null
  },
): ParsedMvrResult {
  const subject = parsedData.subject as Record<string, unknown> | undefined
  const license = parsedData.license as Record<string, unknown> | undefined
  const status = parsedData.status as Record<string, unknown> | undefined
  const licenses = parsedData.licenses as Array<Record<string, unknown>> | undefined
  const violations = parsedData.violations as Record<string, unknown> | undefined
  const accidents = parsedData.accidents as Record<string, unknown> | undefined
  const suspensions = parsedData.suspensions as Record<string, unknown> | undefined
  const medical = parsedData.medical as Record<string, unknown> | undefined

  return {
    orderNumber: String(parsedData.orderNumber ?? ''),
    subOrderNumber: String(parsedData.subOrderNumber ?? ''),
    remoteOrderNumber: parsedData.remoteOrderNumber as string | undefined,
    remoteSubOrderNumber: parsedData.remoteSubOrderNumber as string | undefined,
    timeOrdered: parsedData.timeOrdered as string | undefined,
    timeFilled: parsedData.timeFilled as string | undefined,
    filledStatus: status?.filledStatus as string | undefined,
    filledCode: status?.filledCode as string | undefined,
    heldForReview: status?.heldForReview as boolean | undefined,
    heldForReleaseForm: status?.heldForReleaseForm as boolean | undefined,
    subject: subject
      ? {
          firstName: subject.firstName as string | undefined,
          middleName: subject.middleName as string | undefined,
          lastName: subject.lastName as string | undefined,
          nameSuffix: subject.nameSuffix as string | undefined,
          dateOfBirth: subject.dateOfBirth as string | undefined,
          email: subject.email as string | undefined,
          phone: subject.phone as string | undefined,
          address: subject.address as string | undefined,
          city: subject.city as string | undefined,
          state: subject.state as string | undefined,
          zip: subject.zip as string | undefined,
          country: subject.country as string | undefined,
          gender: subject.gender as string | undefined,
        }
      : undefined,
    // `||` not `??` — parsed_data often has license.state: "" while the column has "OH"
    licenseNumber: String(license?.number || columns.license_number || ''),
    licenseState: String(license?.state || columns.license_state || ''),
    licenseExpirationDate: String(
      license?.expirationDate || columns.license_expiration_date || '',
    ),
    licenses: licenses?.map((l) => ({
      issueDate: l.issueDate as string | undefined,
      expirationDate: l.expirationDate as string | undefined,
      class: l.class as string | undefined,
      code: l.code as string | undefined,
      type: l.type as string | undefined,
      status: l.status as string | undefined,
      endorsements: l.endorsements as string | undefined,
      restrictions: l.restrictions as string | undefined,
    })),
    violations: (violations?.details as ParsedMvrResult['violations']) || [],
    violationCount: Number(violations?.count ?? 0),
    totalPoints: Number(violations?.totalPoints ?? 0),
    accidents: (accidents?.details as ParsedMvrResult['accidents']) || [],
    accidentCount: Number(accidents?.count ?? 0),
    suspensions: (suspensions?.details as ParsedMvrResult['suspensions']) || [],
    suspensionCount: Number(suspensions?.count ?? 0),
    medicalCertExpiration: medical?.certExpiration as string | undefined,
    medicalCertStatus: medical?.certStatus as string | undefined,
    fees: parsedData.fees as ParsedMvrResult['fees'],
  }
}

/**
 * Prefer a completed driver-owned MVR order's result.
 * Falls back to latest parsed mvr_results for the user (legacy / self-order without order link).
 */
export async function loadMvrDotProjection(
  supabase: SupabaseClient,
  userId: string,
): Promise<MvrDotProjection | null> {
  const { data: order } = await supabase
    .from('mvr_orders')
    .select('id, status, accio_order_number, completed_at, ordered_by_company_id')
    .eq('driver_user_id', userId)
    .is('ordered_by_company_id', null)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let mvrResult: {
    id: string
    parsed_data: Record<string, unknown> | null
    license_number: string | null
    license_state: string | null
    license_expiration_date: string | null
    received_at: string | null
    mvr_order_id?: string | null
  } | null = null

  let orderId: string | null = null
  let accioOrderNumber: string | null = null
  let asOf: string

  if (order && isDriverOwnedScreeningOrder(order)) {
    orderId = order.id
    accioOrderNumber = order.accio_order_number
    asOf = order.completed_at ?? new Date().toISOString()

    const { data: byOrder } = await supabase
      .from('mvr_results')
      .select(
        'id, parsed_data, license_number, license_state, license_expiration_date, received_at, mvr_order_id',
      )
      .eq('mvr_order_id', order.id)
      .eq('result_status', 'parsed')
      .maybeSingle()

    mvrResult = byOrder as typeof mvrResult
  } else {
    const { data: latest } = await supabase
      .from('mvr_results')
      .select(
        'id, parsed_data, license_number, license_state, license_expiration_date, received_at, mvr_order_id',
      )
      .eq('driver_user_id', userId)
      .eq('result_status', 'parsed')
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    mvrResult = latest as typeof mvrResult
    asOf = mvrResult?.received_at ?? new Date().toISOString()
    orderId = mvrResult?.mvr_order_id ?? null
  }

  if (!mvrResult?.parsed_data) return null

  const parsed = reconstructParsedMvr(mvrResult.parsed_data, {
    license_number: mvrResult.license_number,
    license_state: mvrResult.license_state,
    license_expiration_date: mvrResult.license_expiration_date,
  })

  const form1Data = mapMvrToForm1Data(parsed) as Record<string, unknown>
  const summary = getMvrExtractionSummary(parsed)
  const stampAsOf = mvrResult.received_at ?? asOf
  const form1Provenance = buildMvrForm1Provenance(form1Data, {
    mvrResultId: mvrResult.id,
    orderId,
    accioOrderNumber,
    asOf: stampAsOf,
  })

  const { accidents, convictions } = mapMvrToForm2Rows(parsed)

  // Need at least Form 1 locks OR Form 2 rows to be useful
  if (
    Object.keys(form1Provenance.fields).length === 0 &&
    accidents.length === 0 &&
    convictions.length === 0
  ) {
    return null
  }

  return {
    form1Data,
    form1Provenance,
    mvrAccidents: accidents,
    mvrConvictions: convictions,
    summary,
    mvrResultId: mvrResult.id,
    orderId,
    accioOrderNumber,
    mvrReceivedAt: mvrResult.received_at,
    asOf: stampAsOf,
    parsed,
  }
}

/** Alias for older call sites */
export async function loadMvrForm1Projection(
  supabase: SupabaseClient,
  userId: string,
): Promise<MvrDotProjection | null> {
  return loadMvrDotProjection(supabase, userId)
}
