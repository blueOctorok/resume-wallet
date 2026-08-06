/**
 * Storm-branded FMCSA PSP (Pre-Employment Screening Program) PDF.
 *
 * Renders Accio's preformatted `<text>` block verbatim — the same artifact
 * Key Background prints. No cover summary; identity and outcome live in the
 * vendor text. Structured parsing stays in `accio-psp-parser.ts` for search.
 */

import React from 'react'
import { Text } from '@react-pdf/renderer'
import type { ParsedPspResult } from '@/lib/accio-psp-parser'
import {
  StormPdfDocument,
  StormPdfFooter,
  StormPdfPage,
  stormPdfStyles,
} from '@/lib/pdf/StormPdfChrome'
import type { ScreeningOutcome } from '@/lib/accio-result-status'

export interface PspReportPdfMeta {
  stormOrderId: string
  candidateName: string
  generatedAtIso: string
  outcome?: ScreeningOutcome
  verifiedTxHash?: string | null
  verifiedExplorerUrl?: string | null
}

export interface PspReportPdfProps {
  parsed: ParsedPspResult
  meta: PspReportPdfMeta
}

export function PspReportPdf({ parsed, meta }: PspReportPdfProps) {
  const reportBody =
    parsed.reportText?.trim() ||
    'No vendor report text was returned for this order.'

  return (
    <StormPdfDocument title={`Provven PSP — ${meta.candidateName}`}>
      <StormPdfPage wrap>
        <Text style={stormPdfStyles.pre}>{reportBody}</Text>

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
