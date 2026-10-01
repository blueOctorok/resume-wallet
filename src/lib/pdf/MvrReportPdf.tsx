/**
 * Provven-branded MVR (Motor Vehicle Report) PDF.
 *
 * Structure (mirrors a Key Background Screening consumer report):
 *   1. FCRA cover — prepared for / CRA / component status / notice
 *   2. Structured summary — identity, licenses, violations, accidents,
 *      suspensions, medical. This layer is a *projection* of the DMV record
 *      and is allowed to be incomplete.
 *   3. Full DMV Record — the state's report, verbatim. This layer is NOT
 *      allowed to be missing. It is the ground truth a carrier audits against,
 *      and it's why we no longer fall behind Key one regex at a time.
 *   4. Appendix — "A Summary of Your Rights Under the FCRA".
 *
 * Renders server-side via @react-pdf/renderer. `parsed` is the canonical
 * ParsedMvrResult from `accio-xml-parser.ts`; `meta` carries Storm-side fields.
 */

import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import type { ParsedMvrResult } from '@/lib/accio-xml-parser'
import {
  KeyValue,
  OutcomeChip,
  STORM_COLORS,
  Section,
  StormPdfDocument,
  StormPdfFooter,
  StormPdfHeader,
  StormPdfPage,
  stormPdfStyles,
} from '@/lib/pdf/StormPdfChrome'
import {
  deriveScreeningStatus,
  outcomeLabel,
  type ScreeningOutcome,
} from '@/lib/accio-result-status'
import { hasValidMedicalCert } from '@/lib/accio-xml-parser'
import {
  collapseCumulativePipeField,
  formatDisplayGender,
  hasDmvPersonalCharacteristics,
  resolveDisplayPhone,
} from '@/lib/mvr-display-sanitize'
import { MvrReportFcraCover, type MvrReportParty } from '@/lib/pdf/MvrReportFcraCover'
import { FcraSummaryOfRights } from '@/lib/pdf/FcraSummaryOfRights'

export interface MvrReportPdfMeta {
  /** Storm internal order id (uuid) — printed in footer + cover. */
  stormOrderId: string
  /** Friendly display name for the candidate (header banner). */
  candidateName: string
  /** When the report was downloaded (ISO). Used on cover. */
  generatedAtIso: string
  /** Optional pre-derived outcome — falls back to deriveScreeningStatus. */
  outcome?: ScreeningOutcome
  /** On-chain verification (when the report was anchored to chain). */
  verifiedTxHash?: string | null
  verifiedExplorerUrl?: string | null
  /** Optional profile phone when Accio subject block has a placeholder. */
  profilePhone?: string | null
  /** Who the report is for — the ordering employer, or the candidate on a self-order. */
  preparedFor: MvrReportParty
  /** Who placed the order, when known. */
  requestedBy?: MvrReportParty | null
}

// Accio dates arrive as YYYYMMDD; `<dlexpiration>` on some fills is ISO
// (YYYY-MM-DD). Normalize both to MM/DD/YYYY so the page reads consistently.
function formatYmd(value?: string | null): string {
  if (!value) return ''
  const v = String(value).trim()
  if (/^\d{8}$/.test(v)) return `${v.slice(4, 6)}/${v.slice(6, 8)}/${v.slice(0, 4)}`
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  return v
}

/** Key masks the year ("08/01/XXXX") — month/day is enough to confirm identity on paper. */
function maskDob(value?: string | null): string {
  const formatted = formatYmd(value)
  return formatted ? formatted.replace(/\d{4}$/, 'XXXX') : ''
}

function maskSsn(value?: string | null): string {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? `XXX-XX-${digits.slice(-4)}` : ''
}

function formatTimestamp(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * "MASSACHUSETTS Driver Record - E335 ..." → "Massachusetts". Read from the
 * DMV's own header so the label is authentic; fall back to the abbreviation.
 */
function dmvJurisdictionLabel(parsed: ParsedMvrResult): string {
  const m = parsed.dmvRecordText?.match(/^\s*([A-Z][A-Z ]+?)\s+Driver Record\b/m)
  if (m) return titleCase(m[1].trim())
  return parsed.licenseState ?? 'Unknown state'
}

// Column widths sum to 100% per table.
const VIOLATION_COLS = ['14%', '38%', '14%', '12%', '10%', '12%']
const ACCIDENT_COLS = ['18%', '18%', '18%', '46%']
const SUSPENSION_COLS = ['13%', '35%', '14%', '13%', '13%', '12%']
const LICENSE_COLS = ['12%', '13%', '27%', '10%', '12%', '13%', '13%']

function ColHead({ label, width }: { label: string; width: string }) {
  return <Text style={[stormPdfStyles.tableHeaderCell, { width }]}>{label}</Text>
}

function Cell({ value, width }: { value?: string | number | null; width: string }) {
  return (
    <Text style={[stormPdfStyles.tableCell, { width }]}>
      {value === null || value === undefined || value === '' ? '—' : String(value)}
    </Text>
  )
}

function rowStyle(i: number) {
  return [stormPdfStyles.tableRow, i % 2 === 1 ? stormPdfStyles.tableRowAlt : {}]
}

/** Omit row entirely when value is empty — avoids a wall of dashes on sparse reports. */
function OptionalKeyValue({ label, value }: { label: string; value?: string | null }) {
  if (value === null || value === undefined || value === '') return null
  return <KeyValue label={label} value={value} />
}

export interface MvrReportPdfProps {
  parsed: ParsedMvrResult
  meta: MvrReportPdfMeta
}

export function MvrReportPdf({ parsed, meta }: MvrReportPdfProps) {
  const derivedOutcome = deriveScreeningStatus({
    filledStatus: parsed.filledStatus,
    filledCode: parsed.filledCode,
    heldForReview: parsed.heldForReview,
  }).outcome

  // Prefer freshly parsed Accio codes — stored result_outcome can be stale
  // until a backfill/reparse runs (e.g. filledCode=discrepancy was unknown).
  const outcome: ScreeningOutcome = derivedOutcome ?? meta.outcome ?? null

  const subjectName =
    [parsed.subject?.firstName, parsed.subject?.middleName, parsed.subject?.lastName]
      .filter(Boolean)
      .join(' ') || meta.candidateName

  const violations = parsed.violations ?? []
  const accidents = parsed.accidents ?? []
  const suspensions = parsed.suspensions ?? []
  const licenses = parsed.licenses ?? []
  const mismatchAlerts = parsed.mismatchAlerts ?? []

  const displayPhone = resolveDisplayPhone(parsed.subject?.phone, meta.profilePhone)
  const displayGender = formatDisplayGender(parsed.subject?.gender)
  const pc = parsed.personalCharacteristics
  const showPersonalCharacteristics = hasDmvPersonalCharacteristics(pc)

  const filledStatusLabel =
    (parsed.filledStatus ?? '').toLowerCase() === 'filled'
      ? 'Complete'
      : titleCase(parsed.filledStatus ?? 'Processing')
  const dmvRecordLines = (parsed.dmvRecordText ?? '').split('\n')
  const footerProps = {
    orderId: meta.stormOrderId,
    verifiedTxHash: meta.verifiedTxHash,
    verifiedExplorerUrl: meta.verifiedExplorerUrl,
    vendorReference: parsed.remoteOrderNumber,
  }
  const subtitle = `Provven Order ${meta.stormOrderId.slice(0, 8)} · Generated ${formatTimestamp(meta.generatedAtIso)}`

  return (
    <StormPdfDocument title={`Provven MVR — ${meta.candidateName}`}>
      <StormPdfPage wrap footer={<StormPdfFooter {...footerProps} />}>
        <StormPdfHeader reportLabel="Motor Vehicle Report" reportTitle={subjectName} reportSubtitle={subtitle} />

        <MvrReportFcraCover
          preparedFor={meta.preparedFor}
          requestedBy={meta.requestedBy}
          componentLabel={`Motor Vehicle Report in ${dmvJurisdictionLabel(parsed)} for ${subjectName}`}
          componentStatus={`${filledStatusLabel} — ${outcomeLabel(outcome)}`}
          componentUpdatedAt={formatTimestamp(parsed.timeFilled)}
          craOrderNumber={parsed.remoteOrderNumber}
        />

        {/* Cover summary */}
        <View style={[stormPdfStyles.coverBadgeRow, { marginTop: 12 }]}>
          <OutcomeChip outcome={outcome} label={`Status: ${outcomeLabel(outcome)}`} />
          {parsed.reportClear !== undefined ? (
            <Text style={{ marginLeft: 8, fontSize: 8, color: STORM_COLORS.muted }}>
              DMV report clear: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{parsed.reportClear ? 'YES' : 'NO'}</Text>
            </Text>
          ) : null}
        </View>
        <View style={stormPdfStyles.kvGrid}>
          <KeyValue label="License #" value={parsed.licenseNumber} />
          <KeyValue label="License State" value={parsed.licenseState} />
          <KeyValue label="DOB" value={maskDob(parsed.subject?.dateOfBirth)} />
          <OptionalKeyValue label="SSN" value={maskSsn(parsed.subject?.ssn)} />
          <KeyValue label="License Expires" value={formatYmd(parsed.licenseExpirationDate)} />
          {/* DMV's own pull date — distinct from Storm/Accio timestamps. Many states omit it. */}
          <OptionalKeyValue label="DMV As Of" value={parsed.dmvAsOfDate} />
          <KeyValue label="Time Ordered" value={formatTimestamp(parsed.timeOrdered)} />
          <KeyValue label="Time Filled" value={formatTimestamp(parsed.timeFilled)} />
        </View>

        {/* Why a report is "Discrepancy" — the DMV's identity mismatch lines. */}
        {mismatchAlerts.length > 0 ? (
          <View
            style={{
              marginTop: 8,
              padding: 8,
              borderRadius: 4,
              backgroundColor: STORM_COLORS.amberBg,
              borderLeftWidth: 3,
              borderLeftColor: STORM_COLORS.amber,
            }}
          >
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: STORM_COLORS.amber, marginBottom: 2 }}>
              Identity mismatch alerts from the DMV
            </Text>
            {mismatchAlerts.map((line) => (
              <Text key={line} style={{ fontSize: 8.5, color: STORM_COLORS.body }}>
                • {line}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Personal info — FCRA-required fields only */}
        <Section heading="Personal Information">
          <View style={stormPdfStyles.kvGrid}>
            <KeyValue label="Name" value={subjectName} />
            <OptionalKeyValue label="Name on DMV record" value={parsed.dmvRecordName} />
            <OptionalKeyValue label="Gender" value={displayGender} />
            <KeyValue label="Address" value={parsed.subject?.address} />
            <KeyValue
              label="City / State"
              value={[parsed.subject?.city, parsed.subject?.state].filter(Boolean).join(', ') || undefined}
            />
            <KeyValue label="ZIP" value={parsed.subject?.zip} />
            <OptionalKeyValue label="Phone" value={displayPhone} />
          </View>
        </Section>

        {showPersonalCharacteristics && pc ? (
          <Section heading="Personal Characteristics">
            <View style={stormPdfStyles.kvGrid}>
              <OptionalKeyValue label="Sex" value={pc.sex} />
              <OptionalKeyValue label="Height" value={pc.height} />
              <OptionalKeyValue label="Weight" value={pc.weight} />
              <OptionalKeyValue label="Eyes" value={pc.eyes} />
              <OptionalKeyValue label="Hair" value={pc.hair} />
              <OptionalKeyValue label="Organ Donor" value={pc.donor} />
            </View>
          </Section>
        ) : null}

        <Section heading="License History">
          {licenses.length === 0 ? (
            <Text style={stormPdfStyles.emptyTable}>No license records returned.</Text>
          ) : (
            <View style={stormPdfStyles.table}>
              <View style={stormPdfStyles.tableHeaderRow}>
                <ColHead label="Issued" width={LICENSE_COLS[0]} />
                <ColHead label="Type" width={LICENSE_COLS[1]} />
                <ColHead label="Class" width={LICENSE_COLS[2]} />
                <ColHead label="Status" width={LICENSE_COLS[3]} />
                <ColHead label="Expires" width={LICENSE_COLS[4]} />
                <ColHead label="Endorsements" width={LICENSE_COLS[5]} />
                <ColHead label="Restrictions" width={LICENSE_COLS[6]} />
              </View>
              {licenses.map((lic, i) => (
                <View key={i} style={rowStyle(i)} wrap={false}>
                  <Cell value={formatYmd(lic.issueDate)} width={LICENSE_COLS[0]} />
                  <Cell value={lic.type} width={LICENSE_COLS[1]} />
                  <Cell
                    value={[lic.class, lic.classDescription].filter(Boolean).join(' — ')}
                    width={LICENSE_COLS[2]}
                  />
                  <Cell value={lic.status} width={LICENSE_COLS[3]} />
                  <Cell value={formatYmd(lic.expirationDate)} width={LICENSE_COLS[4]} />
                  <Cell value={lic.endorsements} width={LICENSE_COLS[5]} />
                  <Cell value={collapseCumulativePipeField(lic.restrictions)} width={LICENSE_COLS[6]} />
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section heading={`Violations (${violations.length})`}>
          {violations.length === 0 ? (
            <Text style={stormPdfStyles.emptyTable}>No violations on record.</Text>
          ) : (
            <View style={stormPdfStyles.table}>
              <View style={stormPdfStyles.tableHeaderRow}>
                <ColHead label="Date" width={VIOLATION_COLS[0]} />
                <ColHead label="Description" width={VIOLATION_COLS[1]} />
                <ColHead label="Type" width={VIOLATION_COLS[2]} />
                <ColHead label="ACD" width={VIOLATION_COLS[3]} />
                <ColHead label="Points" width={VIOLATION_COLS[4]} />
                <ColHead label="State" width={VIOLATION_COLS[5]} />
              </View>
              {violations.map((v, i) => (
                <View key={i} style={rowStyle(i)} wrap={false}>
                  <Cell value={formatYmd(v.date)} width={VIOLATION_COLS[0]} />
                  <Cell value={v.description} width={VIOLATION_COLS[1]} />
                  <Cell value={v.type} width={VIOLATION_COLS[2]} />
                  <Cell value={v.acdCode} width={VIOLATION_COLS[3]} />
                  <Cell value={v.points} width={VIOLATION_COLS[4]} />
                  <Cell value={v.state} width={VIOLATION_COLS[5]} />
                </View>
              ))}
            </View>
          )}
          {parsed.totalPoints !== undefined && parsed.totalPoints > 0 ? (
            <Text style={{ marginTop: 4, fontSize: 8, color: STORM_COLORS.muted }}>
              Total points: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{parsed.totalPoints}</Text>
            </Text>
          ) : null}
        </Section>

        <Section heading={`Accidents (${accidents.length})`}>
          {accidents.length === 0 ? (
            <Text style={stormPdfStyles.emptyTable}>No accidents on record.</Text>
          ) : (
            <View style={stormPdfStyles.table}>
              <View style={stormPdfStyles.tableHeaderRow}>
                <ColHead label="Date" width={ACCIDENT_COLS[0]} />
                <ColHead label="Severity" width={ACCIDENT_COLS[1]} />
                <ColHead label="Fault" width={ACCIDENT_COLS[2]} />
                <ColHead label="Description" width={ACCIDENT_COLS[3]} />
              </View>
              {accidents.map((a, i) => (
                <View key={i} style={rowStyle(i)} wrap={false}>
                  <Cell value={formatYmd(a.date)} width={ACCIDENT_COLS[0]} />
                  <Cell value={a.severity} width={ACCIDENT_COLS[1]} />
                  <Cell value={a.fault} width={ACCIDENT_COLS[2]} />
                  <Cell value={a.description} width={ACCIDENT_COLS[3]} />
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section heading={`Suspensions / Withdrawals (${suspensions.length})`}>
          {suspensions.length === 0 ? (
            <Text style={stormPdfStyles.emptyTable}>No suspensions on record.</Text>
          ) : (
            <View style={stormPdfStyles.table}>
              <View style={stormPdfStyles.tableHeaderRow}>
                <ColHead label="Effective" width={SUSPENSION_COLS[0]} />
                <ColHead label="Reason" width={SUSPENSION_COLS[1]} />
                <ColHead label="Codes" width={SUSPENSION_COLS[2]} />
                <ColHead label="Cleared" width={SUSPENSION_COLS[3]} />
                <ColHead label="End" width={SUSPENSION_COLS[4]} />
                <ColHead label="State" width={SUSPENSION_COLS[5]} />
              </View>
              {suspensions.map((s, i) => (
                <View key={i} style={rowStyle(i)} wrap={false}>
                  <Cell value={formatYmd(s.date)} width={SUSPENSION_COLS[0]} />
                  <Cell value={s.reason} width={SUSPENSION_COLS[1]} />
                  <Cell value={[s.acdCode, s.avdCode].filter(Boolean).join(' / ')} width={SUSPENSION_COLS[2]} />
                  <Cell value={formatYmd(s.clearedDate)} width={SUSPENSION_COLS[3]} />
                  <Cell value={formatYmd(s.endDate)} width={SUSPENSION_COLS[4]} />
                  <Cell value={s.state} width={SUSPENSION_COLS[5]} />
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Medical certificate — only for drivers who actually hold a DOT med
            card. Non-CDL drivers' section says "NOT CERTIFIED"; we hide it rather
            than relabel license fields. See accio-xml-parser.ts. */}
        {hasValidMedicalCert(parsed.medicalCertStatus, parsed.medicalCertExpiration) ? (
          <Section heading="Medical Certificate">
            <View style={stormPdfStyles.kvGrid}>
              <KeyValue label="Status" value={parsed.medicalCertStatus} />
              <KeyValue label="Issued" value={formatYmd(parsed.medicalCertIssueDate)} />
              <KeyValue label="Expires" value={formatYmd(parsed.medicalCertExpiration)} />
              <KeyValue label="Self-Certification" value={parsed.medicalCertSelfCertification} />
            </View>
          </Section>
        ) : null}

        {parsed.medicalExaminer ? (
          <Section heading="Medical Examiner">
            <View style={stormPdfStyles.kvGrid}>
              <KeyValue label="Examiner Name" value={parsed.medicalExaminer.name} />
              <KeyValue label="License No." value={parsed.medicalExaminer.licenseNumber} />
              <KeyValue label="Jurisdiction" value={parsed.medicalExaminer.licenseJurisdiction} />
              <KeyValue label="National Registry No." value={parsed.medicalExaminer.nationalRegistryNumber} />
              <OptionalKeyValue label="Phone" value={parsed.medicalExaminer.phone} />
            </View>
          </Section>
        ) : null}

        {/* The record itself. Everything above is a summary of this; if the two
            ever disagree, this wins — it is what the state DMV sent. */}
        <Section heading={`Full DMV Record — ${dmvJurisdictionLabel(parsed)}`}>
          {!parsed.dmvRecordText ? (
            <Text style={stormPdfStyles.emptyTable}>
              The vendor did not return the state's text record for this order.
            </Text>
          ) : (
            <View style={stormPdfStyles.pre}>
              {dmvRecordLines.map((line, i) => (
                <Text key={i} style={{ fontFamily: 'Courier', fontSize: 7.5, lineHeight: 1.25 }}>
                  {/* react-pdf collapses an empty Text to zero height; keep blank lines visible */}
                  {line === '' ? ' ' : line}
                </Text>
              ))}
            </View>
          )}
        </Section>
      </StormPdfPage>

      <StormPdfPage wrap footer={<StormPdfFooter {...footerProps} />}>
        <StormPdfHeader reportLabel="Appendix" reportTitle="Summary of Your Rights" reportSubtitle={subtitle} />
        <FcraSummaryOfRights />
      </StormPdfPage>
    </StormPdfDocument>
  )
}
