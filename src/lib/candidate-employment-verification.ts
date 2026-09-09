/**
 * Candidate hub EV: merge work history (DOT Form 3 + block tables + resumes)
 * and applicant identity for the official § 391.23 paper. DOT fields are
 * self-reported. Verified only when a previous-employer reply has dkim_valid.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getCdlData, getDriverEmployment, getDevProfile } from '@/lib/block-data'
import { form3DateToProfileDate } from '@/lib/dot-form-mapper'
import type { VerificationRequest } from '@/types/employment-verification'

export type CandidateEmploymentSource = 'driver' | 'developer' | 'general'

export interface CandidateEmploymentRow {
  verificationKey: string
  source: CandidateEmploymentSource
  sourceLabel: string
  id: string
  companyName: string
  position: string
  startDate: string
  endDate?: string | null
  location?: string
  supervisorName?: string
  supervisorEmail?: string
  supervisorPhone?: string
  reasonForLeaving?: string
  /** From Form 3 only — not a block_driver_employment row (do not DELETE it). */
  fromDotDraft?: boolean
  isCurrent?: boolean
  /** Driver prefers we not send — packet still exists; send stays opt-in. */
  preferNoContact?: boolean
}

export function isCurrentEmploymentRow(row: CandidateEmploymentRow): boolean {
  return row.isCurrent === true || !String(row.endDate ?? '').trim()
}

/** Current job or Form 3 "prefer not to contact" — default the send opt-out on. */
export function shouldHoldEvSend(row: CandidateEmploymentRow): boolean {
  return Boolean(row.preferNoContact) || isCurrentEmploymentRow(row)
}

export function compositeVerificationKey(
  source: CandidateEmploymentSource,
  rawId: string,
): string {
  return `${source}:${rawId}`
}

/** Legacy rows use raw UUID with applicant_type driver/developer — no prefix. */
export function parseVerificationEmploymentId(stored: string): {
  source: CandidateEmploymentSource
  rawId: string
} {
  const i = stored.indexOf(':')
  if (i <= 0) return { source: 'driver', rawId: stored }
  const prefix = stored.slice(0, i)
  const rawId = stored.slice(i + 1)
  if (prefix === 'developer' || prefix === 'general') {
    return { source: prefix, rawId }
  }
  return { source: 'driver', rawId: stored }
}

export function applicantTypeForSource(
  source: CandidateEmploymentSource,
): 'driver' | 'developer' | 'general' {
  return source
}

export async function fetchGeneralEmploymentsFromResumes(
  supabase: SupabaseClient,
  userId: string,
): Promise<CandidateEmploymentRow[]> {
  const { data: resumes } = await supabase
    .from('resumes')
    .select('structured_data')
    .eq('user_id', userId)
    .eq('source_role', 'general')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!resumes?.length) return []

  for (const resume of resumes) {
    const sd = resume.structured_data as {
      employments?: Array<{
        id: string
        companyName?: string
        position?: string
        startDate?: string
        endDate?: string
        isCurrent?: boolean
        location?: string
      }>
    } | null
    const em = sd?.employments
    if (!em?.length) continue
    return em.map((e) => ({
      verificationKey: compositeVerificationKey('general', e.id),
      source: 'general',
      sourceLabel: 'General resume',
      id: e.id,
      companyName: e.companyName ?? '',
      position: e.position ?? '',
      startDate: e.startDate ?? '',
      endDate: e.isCurrent ? '' : (e.endDate ?? ''),
      location: e.location ?? '',
    }))
  }
  return []
}

function normCompany(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normStartMonth(date: string): string {
  const s = date.trim()
  const iso = s.match(/^(\d{4})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}`
  return form3DateToProfileDate(s).slice(0, 7)
}

export function employmentDedupeKey(company: string, startDate: string): string {
  return `${normCompany(company)}|${normStartMonth(startDate)}`
}

type Form3EmployerLoose = {
  id?: string
  type?: string
  name?: string
  phone?: string
  email?: string
  hiringManagerName?: string
  hiringManagerPhone?: string
  hiringManagerEmail?: string
  address?: string
  positionHeld?: string
  fromDate?: string
  toDate?: string
  reasonForLeaving?: string
  isUnemployment?: boolean
  /** Driver asked us not to contact this employer — no EV packet. */
  doNotContact?: boolean
}

/** Real employers always get a packet — current jobs included. Send is opt-out, not hidden. */
export function shouldCreateEvPacket(emp: Form3EmployerLoose): boolean {
  return isRealEmployer(emp)
}

function isRealEmployer(emp: Form3EmployerLoose): boolean {
  if (emp.isUnemployment) return false
  const type = emp.type ?? 'employment'
  if (type === 'unemployment' || type === 'school' || type === 'drivingSchool' || type === 'military') {
    return false
  }
  return Boolean(emp.name?.trim())
}

/** DOT Form 3 employers as EV rows — hiring manager contact rides along. */
export function form3EmployersToCandidateRows(
  employers: Form3EmployerLoose[] | undefined,
): CandidateEmploymentRow[] {
  if (!employers?.length) return []
  const rows: CandidateEmploymentRow[] = []
  employers.forEach((emp, index) => {
    if (!shouldCreateEvPacket(emp)) return
    const id = emp.id?.trim() || `dot-form3-${index}`
    const startDate = form3DateToProfileDate(emp.fromDate ?? '')
    const isCurrent = emp.toDate?.toLowerCase() === 'present'
    const endDate = isCurrent ? '' : form3DateToProfileDate(emp.toDate ?? '')
    rows.push({
      verificationKey: compositeVerificationKey('driver', id),
      source: 'driver',
      sourceLabel: 'DOT application',
      id,
      companyName: emp.name!.trim(),
      position: emp.positionHeld?.trim() ?? '',
      startDate,
      endDate,
      location: emp.address?.trim() || undefined,
      supervisorName: emp.hiringManagerName?.trim() || undefined,
      supervisorEmail: emp.hiringManagerEmail?.trim() || emp.email?.trim() || undefined,
      supervisorPhone: emp.hiringManagerPhone?.trim() || emp.phone?.trim() || undefined,
      reasonForLeaving: emp.reasonForLeaving?.trim() || undefined,
      fromDotDraft: true,
      isCurrent,
      preferNoContact: emp.doNotContact === true,
    })
  })
  return rows
}

/** Same company + start month: keep the driver row, fill empty contact from Form 3. */
export function mergeDotForm3IntoEmployments(
  existing: CandidateEmploymentRow[],
  form3Rows: CandidateEmploymentRow[],
): CandidateEmploymentRow[] {
  const driverIndex = new Map<string, number>()
  existing.forEach((row, i) => {
    if (row.source === 'driver') {
      driverIndex.set(employmentDedupeKey(row.companyName, row.startDate), i)
    }
  })
  const next = [...existing]
  for (const incoming of form3Rows) {
    const key = employmentDedupeKey(incoming.companyName, incoming.startDate)
    const idx = driverIndex.get(key)
    if (idx === undefined) {
      driverIndex.set(key, next.length)
      next.push(incoming)
      continue
    }
    const prev = next[idx]
    next[idx] = {
      ...prev,
      supervisorName: prev.supervisorName || incoming.supervisorName,
      supervisorEmail: prev.supervisorEmail || incoming.supervisorEmail,
      supervisorPhone: prev.supervisorPhone || incoming.supervisorPhone,
      reasonForLeaving: prev.reasonForLeaving || incoming.reasonForLeaving,
      location: prev.location || incoming.location,
      isCurrent: prev.isCurrent || incoming.isCurrent,
      preferNoContact: prev.preferNoContact || incoming.preferNoContact,
    }
  }
  return next
}

async function fetchDotForm3Employers(
  supabase: SupabaseClient,
  userId: string,
): Promise<CandidateEmploymentRow[]> {
  const { data } = await supabase
    .from('driver_applications')
    .select('application_data')
    .eq('user_id', userId)
    .maybeSingle()

  const appData = (data?.application_data ?? {}) as {
    form3?: { employers?: Form3EmployerLoose[] }
    form3Data?: { employers?: Form3EmployerLoose[] }
  }
  const employers = appData.form3?.employers ?? appData.form3Data?.employers
  return form3EmployersToCandidateRows(employers)
}

export async function getMergedCandidateEmployments(
  supabase: SupabaseClient,
  userId: string,
): Promise<CandidateEmploymentRow[]> {
  const [driverRows, devProfile, generalRows, form3Rows] = await Promise.all([
    getDriverEmployment(supabase, userId),
    getDevProfile(supabase, userId),
    fetchGeneralEmploymentsFromResumes(supabase, userId),
    fetchDotForm3Employers(supabase, userId),
  ])

  const out: CandidateEmploymentRow[] = []

  for (const e of driverRows) {
    out.push({
      verificationKey: compositeVerificationKey('driver', e.id),
      source: 'driver',
      sourceLabel: 'Driver / DOT',
      id: e.id,
      companyName: e.companyName,
      position: e.position,
      startDate: e.startDate,
      endDate: e.endDate,
      location: e.location,
      supervisorName: e.supervisorName,
      supervisorEmail: e.supervisorEmail,
      supervisorPhone: e.supervisorPhone,
      reasonForLeaving: e.reasonForLeaving,
      isCurrent: e.isCurrent || !String(e.endDate ?? '').trim(),
    })
  }

  const devHist = (devProfile?.employment_history as Array<Record<string, unknown>>) ?? []
  for (const e of devHist) {
    const id = String(e.id ?? '')
    if (!id) continue
    out.push({
      verificationKey: compositeVerificationKey('developer', id),
      source: 'developer',
      sourceLabel: 'Developer resume',
      id,
      companyName: String(e.companyName ?? ''),
      position: String(e.position ?? ''),
      startDate: String(e.startDate ?? ''),
      endDate: e.endDate != null ? String(e.endDate) : '',
      location: e.location != null ? String(e.location) : '',
      supervisorName: e.supervisorName != null ? String(e.supervisorName) : undefined,
      supervisorEmail: e.supervisorEmail != null ? String(e.supervisorEmail) : undefined,
      supervisorPhone: e.supervisorPhone != null ? String(e.supervisorPhone) : undefined,
      reasonForLeaving: e.reasonForLeaving != null ? String(e.reasonForLeaving) : undefined,
    })
  }

  out.push(...generalRows)
  return mergeDotForm3IntoEmployments(out, form3Rows)
}

/** Match verification request to a merged employment row (supports legacy unprefixed employment_id). */
export function requestMatchesCandidateRow(
  r: VerificationRequest,
  row: CandidateEmploymentRow,
): boolean {
  if (r.initiatedBy !== 'applicant') return false
  if (r.employmentId === row.verificationKey) return true
  if (row.source === 'driver' && r.applicantType === 'driver' && r.employmentId === row.id) {
    return true
  }
  if (
    row.source === 'developer' &&
    r.applicantType === 'developer' &&
    r.employmentId === row.id
  ) {
    return true
  }
  if (row.source === 'general' && r.applicantType === 'general' && r.employmentId === row.id) {
    return true
  }
  return false
}

export function findApplicantVerificationsForRow(
  requests: VerificationRequest[],
  row: CandidateEmploymentRow,
): VerificationRequest[] {
  return requests.filter((r) => requestMatchesCandidateRow(r, row))
}

export function findApplicantVerificationForRow(
  requests: VerificationRequest[],
  row: CandidateEmploymentRow,
): VerificationRequest | undefined {
  return findApplicantVerificationsForRow(requests, row)[0]
}

/** Portal / email reply on file is not a verified fact. DKIM + domain align is. */
export function isDkimVerifiedRequest(
  req: Pick<VerificationRequest, 'dkimValid'> | null | undefined,
): boolean {
  return Boolean(req?.dkimValid)
}

export type EvApplicantIdentity = {
  driverName: string
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string
  /** Last 4 only — never a full SSN. */
  ssnLastFour: string
  email: string
  phone: string
  mailingAddress: string
  cdlNumber: string
  cdlState: string
  licenseNumber: string
  licenseState: string
}

export type EvForm1Loose = {
  firstName?: string
  lastName?: string
  middleName?: string
  dateOfBirth?: string
  socialSecurity?: string
  email?: string
  phone?: string
  currentMailing?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
  }
  currentLicenses?: Array<{
    state?: string
    licenseNumber?: string
    typeClass?: string
  }>
}

function formatPersonName(
  first?: string | null,
  middle?: string | null,
  last?: string | null,
): string {
  return [first, middle, last]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ')
}

function last4Ssn(ssn?: string | null): string {
  if (!ssn) return ''
  const digits = ssn.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : ''
}

function formatMailing(m?: EvForm1Loose['currentMailing']): string {
  if (!m) return ''
  return [m.street, m.city, m.state, m.zipCode].map((p) => p?.trim()).filter(Boolean).join(', ')
}

/** Profile wins for name/DOB/contact; DOT Form 1 fills gaps + last-4 SSN. Never a verification signal. */
export function extractEvApplicantIdentity(input: {
  firstName?: string | null
  lastName?: string | null
  dateOfBirth?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  form1?: EvForm1Loose | null
  cdlNumber?: string | null
  cdlState?: string | null
}): EvApplicantIdentity {
  const form1 = input.form1
  const firstName = input.firstName?.trim() || form1?.firstName?.trim() || ''
  const middleName = form1?.middleName?.trim() || ''
  const lastName = input.lastName?.trim() || form1?.lastName?.trim() || ''
  const license0 = form1?.currentLicenses?.[0]
  const mailing = formatMailing(form1?.currentMailing)
  const profilePlace = [input.city, input.state, input.zip].map((p) => p?.trim()).filter(Boolean).join(', ')
  return {
    firstName,
    middleName,
    lastName,
    driverName: formatPersonName(firstName, middleName, lastName),
    dateOfBirth: input.dateOfBirth?.trim() || form1?.dateOfBirth?.trim() || '',
    ssnLastFour: last4Ssn(form1?.socialSecurity),
    email: input.email?.trim() || form1?.email?.trim() || '',
    phone: input.phone?.trim() || form1?.phone?.trim() || '',
    mailingAddress: mailing || profilePlace,
    cdlNumber: input.cdlNumber?.trim() || '',
    cdlState: input.cdlState?.trim() || '',
    licenseNumber: license0?.licenseNumber?.trim() || '',
    licenseState: license0?.state?.trim() || '',
  }
}

export async function getEvApplicantIdentity(
  supabase: SupabaseClient,
  userId: string,
): Promise<EvApplicantIdentity> {
  const [profileRes, appRes, cdl] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('first_name, last_name, date_of_birth, email, phone, city, state, zip_code')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('driver_applications')
      .select('application_data')
      .eq('user_id', userId)
      .maybeSingle(),
    getCdlData(supabase, userId),
  ])
  const appData = (appRes.data?.application_data ?? {}) as {
    form1?: EvForm1Loose
    form1Data?: EvForm1Loose
  }
  return extractEvApplicantIdentity({
    firstName: profileRes.data?.first_name as string | undefined,
    lastName: profileRes.data?.last_name as string | undefined,
    dateOfBirth: profileRes.data?.date_of_birth as string | undefined,
    email: profileRes.data?.email as string | undefined,
    phone: profileRes.data?.phone as string | undefined,
    city: profileRes.data?.city as string | undefined,
    state: profileRes.data?.state as string | undefined,
    zip: profileRes.data?.zip_code as string | undefined,
    form1: appData.form1 ?? appData.form1Data,
    cdlNumber: cdl?.cdl_number,
    cdlState: cdl?.cdl_state,
  })
}
