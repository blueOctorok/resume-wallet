/**
 * Storm-branded MVR (Motor Vehicle Report) PDF.
 *
 * Mirrors the Key Background Screening report layout the user shared, but
 * built with Storm's brand chrome (StormPdfChrome.tsx). Renders entirely
 * server-side via @react-pdf/renderer so the candidate / employer downloads
 * a real, archivable artifact (not a `window.print()` hack).
 *
 * Inputs:
 * - `parsed` is the canonical ParsedMvrResult from `accio-xml-parser.ts`
 * - `meta` carries Storm-side fields (order id, candidate display name,
 *   verification info) that the parser doesn't have.
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
}

// Accio dates come back as YYYYMMDD strings. Helper for human formatting.
function formatYmd(value?: string | null): string {
  if (!value) return ''
  const v = String(value).trim()
  if (!/^\d{8}$/.test(v)) return v
  return `${v.slice(4, 6)}/${v.slice(6, 8)}/${v.slice(0, 4)}`
}

function formatTimestamp(value?: string | null): string {
  if (!value) return ''
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

// Column widths sum to 100% per table — kept inline so each table can size to
// its specific data without abstracting too eagerly.
const VIOLATION_COLS = ['16%', '38%', '12%', '14%', '10%', '10%']
const ACCIDENT_COLS = ['18%', '18%', '18%', '46%']
const SUSPENSION_COLS = ['18%', '40%', '18%', '24%']
const LICENSE_COLS = ['18%', '14%', '14%', '18%', '18%', '18%']

function ColHead({ label, width }: { label: string; width: string }) {
  return (
    <Text
      style={[stormPdfStyles.tableHeaderCell, { width }]}
    >
      {label}
    </Text>
  )
}

function Cell({ value, width }: { value?: string | number | null; width: string }) {
  return (
    <Text style={[stormPdfStyles.tableCell, { width }]}>
      {value === null || value === undefined || value === '' ? '—' : String(value)}
    </Text>
  )
}

export interface MvrReportPdfProps {
  parsed: ParsedMvrResult
  meta: MvrReportPdfMeta
}

export function MvrReportPdf({ parsed, meta }: MvrReportPdfProps) {
  const outcome: ScreeningOutcome =
    meta.outcome ??
    deriveScreeningStatus({
      filledStatus: parsed.filledStatus,
      filledCode: parsed.filledCode,
      heldForReview: parsed.heldForReview,
    }).outcome

  const subjectName =
    [parsed.subject?.firstName, parsed.subject?.middleName, parsed.subject?.lastName]
      .filter(Boolean)
      .join(' ') || meta.candidateName

  const violations = parsed.violations ?? []
  const accidents = parsed.accidents ?? []
  const suspensions = parsed.suspensions ?? []
  const licenses = parsed.licenses ?? []

  return (
    <StormPdfDocument title={`Storm MVR — ${meta.candidateName}`}>
      <StormPdfPage>
        <StormPdfHeader
          reportLabel="Motor Vehicle Report"
          reportTitle={subjectName}
          reportSubtitle={`Storm Order ${meta.stormOrderId.slice(0, 8)} · Generated ${formatTimestamp(meta.generatedAtIso)}`}
        />

        {/* Cover summary */}
        <View style={stormPdfStyles.coverBadgeRow}>
          <OutcomeChip
            outcome={outcome}
            label={`Status: ${outcomeLabel(outcome)}`}
          />
        </View>
        <View style={stormPdfStyles.kvGrid}>
          <KeyValue label="License #" value={parsed.licenseNumber} />
          <KeyValue label="License State" value={parsed.licenseState} />
          <KeyValue label="DOB" value={formatYmd(parsed.subject?.dateOfBirth)} />
          <KeyValue label="License Expires" value={formatYmd(parsed.licenseExpirationDate)} />
          {/* DMV's own pull date — distinct from Storm/Accio timestamps. */}
          <KeyValue label="DMV As Of" value={parsed.dmvAsOfDate} />
          <KeyValue label="Time Ordered" value={formatTimestamp(parsed.timeOrdered)} />
          <KeyValue label="Time Filled" value={formatTimestamp(parsed.timeFilled)} />
        </View>

        {/* Personal info — FCRA-required fields only */}
        <Section heading="Personal Information">
          <View style={stormPdfStyles.kvGrid}>
            <KeyValue label="Name" value={subjectName} />
            <KeyValue label="Gender" value={parsed.subject?.gender} />
            <KeyValue label="Address" value={parsed.subject?.address} />
            <KeyValue
              label="City / State"
              value={
                [parsed.subject?.city, parsed.subject?.state]
                  .filter(Boolean)
                  .join(', ') || undefined
              }
            />
            <KeyValue label="ZIP" value={parsed.subject?.zip} />
            <KeyValue label="Phone" value={parsed.subject?.phone} />
          </View>
        </Section>

        {/* DMV-reported physical description. Only render the section when at
            least one field is present (not all states publish all fields). */}
        {parsed.personalCharacteristics &&
        (parsed.personalCharacteristics.sex ||
          parsed.personalCharacteristics.weight ||
          parsed.personalCharacteristics.height ||
          parsed.personalCharacteristics.eyes ||
          parsed.personalCharacteristics.hair ||
          parsed.personalCharacteristics.donor ||
          parsed.personalCharacteristics.age !== undefined) ? (
          <Section heading="Personal Characteristics">
            <View style={stormPdfStyles.kvGrid}>
              <KeyValue label="Sex" value={parsed.personalCharacteristics.sex} />
              <KeyValue
                label="Age"
                value={
                  parsed.personalCharacteristics.age !== undefined
                    ? String(parsed.personalCharacteristics.age)
                    : undefined
                }
              />
              <KeyValue label="Height" value={parsed.personalCharacteristics.height} />
              <KeyValue label="Weight" value={parsed.personalCharacteristics.weight} />
              <KeyValue label="Eyes" value={parsed.personalCharacteristics.eyes} />
              <KeyValue label="Hair" value={parsed.personalCharacteristics.hair} />
              <KeyValue label="Organ Donor" value={parsed.personalCharacteristics.donor} />
            </View>
          </Section>
        ) : null}

        {/* Licenses */}
        <Section heading="License History">
          {licenses.length === 0 ? (
            <Text style={stormPdfStyles.emptyTable}>No license records returned.</Text>
          ) : (
            <View style={stormPdfStyles.table}>
              <View style={stormPdfStyles.tableHeaderRow}>
                <ColHead label="Issued" width={LICENSE_COLS[0]} />
                <ColHead label="Class" width={LICENSE_COLS[1]} />
                <ColHead label="Status" width={LICENSE_COLS[2]} />
                <ColHead label="Expires" width={LICENSE_COLS[3]} />
                <ColHead label="Endorsements" width={LICENSE_COLS[4]} />
                <ColHead label="Restrictions" width={LICENSE_COLS[5]} />
              </View>
              {licenses.map((lic, i) => (
                <View
                  key={i}
                  style={[
                    stormPdfStyles.tableRow,
                    i % 2 === 1 ? stormPdfStyles.tableRowAlt : {},
                  ]}
                >
                  <Cell value={formatYmd(lic.issueDate)} width={LICENSE_COLS[0]} />
                  <Cell value={lic.class} width={LICENSE_COLS[1]} />
                  <Cell value={lic.status} width={LICENSE_COLS[2]} />
                  <Cell value={formatYmd(lic.expirationDate)} width={LICENSE_COLS[3]} />
                  <Cell value={lic.endorsements} width={LICENSE_COLS[4]} />
                  <Cell value={lic.restrictions} width={LICENSE_COLS[5]} />
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Violations */}
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
                <View
                  key={i}
                  style={[
                    stormPdfStyles.tableRow,
                    i % 2 === 1 ? stormPdfStyles.tableRowAlt : {},
                  ]}
                >
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

        {/* Accidents */}
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
                <View
                  key={i}
                  style={[
                    stormPdfStyles.tableRow,
                    i % 2 === 1 ? stormPdfStyles.tableRowAlt : {},
                  ]}
                >
                  <Cell value={formatYmd(a.date)} width={ACCIDENT_COLS[0]} />
                  <Cell value={a.severity} width={ACCIDENT_COLS[1]} />
                  <Cell value={a.fault} width={ACCIDENT_COLS[2]} />
                  <Cell value={a.description} width={ACCIDENT_COLS[3]} />
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Suspensions */}
        <Section heading={`Suspensions (${suspensions.length})`}>
          {suspensions.length === 0 ? (
            <Text style={stormPdfStyles.emptyTable}>No suspensions on record.</Text>
          ) : (
            <View style={stormPdfStyles.table}>
              <View style={stormPdfStyles.tableHeaderRow}>
                <ColHead label="Date" width={SUSPENSION_COLS[0]} />
                <ColHead label="Reason" width={SUSPENSION_COLS[1]} />
                <ColHead label="State" width={SUSPENSION_COLS[2]} />
                <ColHead label="Reinstated" width={SUSPENSION_COLS[3]} />
              </View>
              {suspensions.map((s, i) => (
                <View
                  key={i}
                  style={[
                    stormPdfStyles.tableRow,
                    i % 2 === 1 ? stormPdfStyles.tableRowAlt : {},
                  ]}
                >
                  <Cell value={formatYmd(s.date)} width={SUSPENSION_COLS[0]} />
                  <Cell value={s.reason} width={SUSPENSION_COLS[1]} />
                  <Cell value={s.state} width={SUSPENSION_COLS[2]} />
                  <Cell value={formatYmd(s.endDate)} width={SUSPENSION_COLS[3]} />
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Medical certificate — only render for drivers who actually hold a
            real DOT med card. Class D / non-CDL drivers' med section says
            "NOT CERTIFIED" with empty dates; we hide it instead of relabeling
            license fields as a med cert. See accio-xml-parser.ts. */}
        {hasValidMedicalCert(parsed.medicalCertStatus, parsed.medicalCertExpiration) ? (
          <Section heading="Medical Certificate">
            <View style={stormPdfStyles.kvGrid}>
              <KeyValue label="Status" value={parsed.medicalCertStatus} />
              <KeyValue
                label="Issued"
                value={formatYmd(parsed.medicalCertIssueDate)}
              />
              <KeyValue
                label="Expires"
                value={formatYmd(parsed.medicalCertExpiration)}
              />
              <KeyValue
                label="Self-Certification"
                value={parsed.medicalCertSelfCertification}
              />
            </View>
          </Section>
        ) : null}

        {/* Medical Examiner — populated for CDL drivers on states that include
            examiner info in the text block (e.g. VA). */}
        {parsed.medicalExaminer && (
          <Section heading="Medical Examiner">
            <View style={stormPdfStyles.kvGrid}>
              <KeyValue label="Examiner Name" value={parsed.medicalExaminer.name} />
              <KeyValue label="License No." value={parsed.medicalExaminer.licenseNumber} />
              <KeyValue label="Jurisdiction" value={parsed.medicalExaminer.licenseJurisdiction} />
              <KeyValue label="National Registry No." value={parsed.medicalExaminer.nationalRegistryNumber} />
              {parsed.medicalExaminer.phone && (
                <KeyValue label="Phone" value={parsed.medicalExaminer.phone} />
              )}
            </View>
          </Section>
        )}

        <StormPdfFooter
          orderId={meta.stormOrderId}
          verifiedTxHash={meta.verifiedTxHash}
          verifiedExplorerUrl={meta.verifiedExplorerUrl}
          vendorReference={parsed.remoteOrderNumber}
        />
      </StormPdfPage>
    </StormPdfDocument>
  )
}
