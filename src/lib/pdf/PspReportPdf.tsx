/**
 * Storm-branded FMCSA PSP (Pre-Employment Screening Program) PDF.
 *
 * The authoritative PSP artifact is Accio's preformatted `<text>` block — the
 * same content Key Background prints verbatim. Structured crash/inspection
 * parsing is kept in `accio-psp-parser.ts` for search/filter, but the PDF
 * surfaces the vendor report text so view and download stay 1:1 with FMCSA.
 */

import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import type { ParsedPspResult } from '@/lib/accio-psp-parser'
import {
  KeyValue,
  OutcomeChip,
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

  const reportBody =
    parsed.reportText?.trim() ||
    'No vendor report text was returned for this order.'

  return (
    <StormPdfDocument title={`Storm PSP — ${meta.candidateName}`}>
      {/* Cover summary — identity + outcome only; detail lives in report text. */}
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
      </StormPdfPage>

      {/* Vendor preformatted text — paginates across as many pages as needed. */}
      <StormPdfPage wrap>
        <Section heading="FMCSA PSP Report">
          <Text style={stormPdfStyles.pre}>{reportBody}</Text>
        </Section>

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
