/**
 * Storm-branded FMCSA PSP (Pre-Employment Screening Program) PDF.
 *
 * Built around `accio-psp-parser.ts`'s structured output. Mirrors the Key-style
 * report layout the user shared (cover summary with crash/inspection/OOS
 * counts, then 5-year crash table, then 5-year inspection table with
 * violations expanded per row), but composed from the shared StormPdfChrome
 * primitives so the brand stays consistent with MVR.
 *
 * Falls back to rendering the vendor `<text>` block at the bottom whenever
 * structured fields are missing — the FMCSA crash/inspection schema isn't
 * publicly documented by Accio, so the raw text guarantees nothing is lost.
 */

import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import type { ParsedPspResult, PspInspection } from '@/lib/accio-psp-parser'
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

export interface PspReportPdfMeta {
  stormOrderId: string
  candidateName: string
  generatedAtIso: string
  outcome?: ScreeningOutcome
  verifiedTxHash?: string | null
  verifiedExplorerUrl?: string | null
}

function formatYmd(value?: string | null): string {
  if (!value) return ''
  const v = String(value).trim()
  if (/^\d{8}$/.test(v)) return `${v.slice(4, 6)}/${v.slice(6, 8)}/${v.slice(0, 4)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split('-')
    return `${m}/${d}/${y}`
  }
  return v
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

const CRASH_COLS = ['14%', '12%', '20%', '12%', '12%', '12%', '18%']
const INSPECTION_COLS = ['12%', '10%', '14%', '20%', '12%', '32%']

function ColHead({ label, width }: { label: string; width: string }) {
  return (
    <Text style={[stormPdfStyles.tableHeaderCell, { width }]}>{label}</Text>
  )
}

function Cell({ value, width }: { value?: string | number | null; width: string }) {
  return (
    <Text style={[stormPdfStyles.tableCell, { width }]}>
      {value === null || value === undefined || value === '' ? '—' : String(value)}
    </Text>
  )
}

function StatTile({
  label,
  value,
  emphasis,
}: {
  label: string
  value: number
  emphasis?: 'positive' | 'negative' | 'neutral'
}) {
  const fg =
    emphasis === 'negative'
      ? STORM_COLORS.rose
      : emphasis === 'positive'
        ? STORM_COLORS.emerald
        : STORM_COLORS.ink
  return (
    <View
      style={{
        flex: 1,
        marginHorizontal: 4,
        padding: 8,
        borderWidth: 1,
        borderColor: STORM_COLORS.border,
        borderRadius: 4,
        backgroundColor: STORM_COLORS.rowAlt,
      }}
    >
      <Text style={{ fontSize: 7, color: STORM_COLORS.hint, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontFamily: 'Helvetica-Bold',
          color: fg,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function inspectionViolationsSummary(insp: PspInspection): string {
  if (insp.violations.length === 0) return insp.result || 'No violations'
  return insp.violations
    .map((v) => {
      const oos = v.outOfService ? ' (OOS)' : ''
      const code = v.code ? `${v.code} — ` : ''
      return `${code}${v.description ?? '—'}${oos}`
    })
    .join('; ')
}

export interface PspReportPdfProps {
  parsed: ParsedPspResult
  meta: PspReportPdfMeta
}

export function PspReportPdf({ parsed, meta }: PspReportPdfProps) {
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

  return (
    <StormPdfDocument title={`Storm PSP — ${meta.candidateName}`}>
      <StormPdfPage>
        <StormPdfHeader
          reportLabel="FMCSA PSP Report"
          reportTitle={subjectName}
          reportSubtitle={`Storm Order ${meta.stormOrderId.slice(0, 8)} · Generated ${formatTimestamp(meta.generatedAtIso)}`}
        />

        <View style={stormPdfStyles.coverBadgeRow}>
          <OutcomeChip
            outcome={outcome}
            label={`Status: ${outcomeLabel(outcome)}`}
          />
        </View>
        <View style={stormPdfStyles.kvGrid}>
          <KeyValue label="License #" value={parsed.subject?.licenseNumber} />
          <KeyValue label="License State" value={parsed.subject?.licenseState} />
          <KeyValue label="DOB" value={formatYmd(parsed.subject?.dateOfBirth)} />
          <KeyValue label="Time Filled" value={formatTimestamp(parsed.timeFilled)} />
          <KeyValue label="Vendor Order" value={parsed.remoteOrderNumber} />
          <KeyValue label="Vendor SubOrder" value={parsed.remoteSubOrderNumber} />
        </View>

        {/* Headline counters — modeled after the Key PDF cover stats */}
        <View style={[stormPdfStyles.sectionWrap, { flexDirection: 'row', marginHorizontal: -4 }]}>
          <StatTile
            label="5-yr Crashes"
            value={parsed.crashCount}
            emphasis={parsed.crashCount === 0 ? 'positive' : 'negative'}
          />
          <StatTile
            label="5-yr Inspections"
            value={parsed.inspectionCount}
            emphasis="neutral"
          />
          <StatTile
            label="Out-of-Service"
            value={parsed.oosCount}
            emphasis={parsed.oosCount === 0 ? 'positive' : 'negative'}
          />
        </View>

        {/* Crash table */}
        <Section heading={`Crash History — Last 5 Years (${parsed.crashes.length})`}>
          {parsed.crashes.length === 0 ? (
            <Text style={stormPdfStyles.emptyTable}>No reported crashes.</Text>
          ) : (
            <View style={stormPdfStyles.table}>
              <View style={stormPdfStyles.tableHeaderRow}>
                <ColHead label="Date" width={CRASH_COLS[0]} />
                <ColHead label="Report #" width={CRASH_COLS[1]} />
                <ColHead label="Location" width={CRASH_COLS[2]} />
                <ColHead label="Fatal" width={CRASH_COLS[3]} />
                <ColHead label="Injury" width={CRASH_COLS[4]} />
                <ColHead label="Tow" width={CRASH_COLS[5]} />
                <ColHead label="Hazmat" width={CRASH_COLS[6]} />
              </View>
              {parsed.crashes.map((c, i) => {
                const location =
                  [c.city, c.state].filter(Boolean).join(', ') || c.description || ''
                return (
                  <View
                    key={i}
                    style={[
                      stormPdfStyles.tableRow,
                      i % 2 === 1 ? stormPdfStyles.tableRowAlt : {},
                    ]}
                  >
                    <Cell value={formatYmd(c.date)} width={CRASH_COLS[0]} />
                    <Cell value={c.reportNumber} width={CRASH_COLS[1]} />
                    <Cell value={location} width={CRASH_COLS[2]} />
                    <Cell value={c.fatalities} width={CRASH_COLS[3]} />
                    <Cell value={c.injuries} width={CRASH_COLS[4]} />
                    <Cell value={c.towAway === true ? 'Yes' : c.towAway === false ? 'No' : '—'} width={CRASH_COLS[5]} />
                    <Cell
                      value={c.hazmatReleased === true ? 'Yes' : c.hazmatReleased === false ? 'No' : '—'}
                      width={CRASH_COLS[6]}
                    />
                  </View>
                )
              })}
            </View>
          )}
        </Section>

        {/* Inspection table */}
        <Section heading={`Inspection History — Last 5 Years (${parsed.inspections.length})`}>
          {parsed.inspections.length === 0 ? (
            <Text style={stormPdfStyles.emptyTable}>No reported inspections.</Text>
          ) : (
            <View style={stormPdfStyles.table}>
              <View style={stormPdfStyles.tableHeaderRow}>
                <ColHead label="Date" width={INSPECTION_COLS[0]} />
                <ColHead label="Level" width={INSPECTION_COLS[1]} />
                <ColHead label="State" width={INSPECTION_COLS[2]} />
                <ColHead label="Result" width={INSPECTION_COLS[3]} />
                <ColHead label="OOS" width={INSPECTION_COLS[4]} />
                <ColHead label="Violations" width={INSPECTION_COLS[5]} />
              </View>
              {parsed.inspections.map((insp, i) => (
                <View
                  key={i}
                  style={[
                    stormPdfStyles.tableRow,
                    i % 2 === 1 ? stormPdfStyles.tableRowAlt : {},
                  ]}
                >
                  <Cell value={formatYmd(insp.date)} width={INSPECTION_COLS[0]} />
                  <Cell value={insp.level} width={INSPECTION_COLS[1]} />
                  <Cell value={insp.state} width={INSPECTION_COLS[2]} />
                  <Cell value={insp.result} width={INSPECTION_COLS[3]} />
                  <Cell
                    value={insp.outOfService === true ? 'Yes' : insp.outOfService === false ? 'No' : '—'}
                    width={INSPECTION_COLS[4]}
                  />
                  <Cell value={inspectionViolationsSummary(insp)} width={INSPECTION_COLS[5]} />
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Vendor preformatted text — only when we have something. Useful as a
            safety net while we refine the structured parser against real data. */}
        {parsed.reportText ? (
          <Section heading="Vendor-Provided Report Text">
            <Text style={stormPdfStyles.pre}>{parsed.reportText}</Text>
          </Section>
        ) : null}

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
