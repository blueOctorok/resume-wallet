/**
 * Shared chrome (header / footer / brand tokens) for every Storm-generated PDF
 * report. Built on @react-pdf/renderer so we can stream PDF bytes from a
 * Vercel serverless function with no Chromium dependency.
 *
 * All Storm PDFs (MVR, PSP, future credentials) should compose these
 * primitives so the brand stays consistent and the verified-on-chain badge
 * lives in one place.
 */

import '@/lib/pdf/storm-pdf-fonts'
import React from 'react'
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import { outcomeLabel, type ScreeningOutcome } from '@/lib/accio-result-status'
import { StormPdfWordmark } from '@/lib/pdf/StormPdfWordmark'

// ── Storm brand tokens (mirror tailwind.config.ts) ──────────────────────────
export const STORM_COLORS = {
  teal: '#0d9488',
  tealLight: '#14b8a6',
  tealDark: '#0f766e',
  cream: '#fef5ed',
  ink: '#0f172a', // slate-900
  body: '#1e293b', // slate-800
  muted: '#475569', // slate-600
  hint: '#64748b', // slate-500
  border: '#e2e8f0', // slate-200
  borderStrong: '#cbd5e1', // slate-300
  rowAlt: '#f8fafc', // slate-50
  // Outcome chips
  emerald: '#059669',
  emeraldBg: '#ecfdf5',
  amber: '#b45309',
  amberBg: '#fef3c7',
  rose: '#be123c',
  roseBg: '#ffe4e6',
  slate: '#475569',
  slateBg: '#f1f5f9',
  sky: '#0369a1',
  skyBg: '#e0f2fe',
} as const

// ── shared stylesheet ──────────────────────────────────────────────────────
export const stormPdfStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 36,
    fontSize: 9,
    color: STORM_COLORS.body,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: STORM_COLORS.teal,
    paddingBottom: 10,
    marginBottom: 14,
  },
  brandWrap: { flexDirection: 'column', alignItems: 'flex-start' },
  brandSub: { fontSize: 8, color: STORM_COLORS.muted, marginTop: 1 },
  reportLabelWrap: { alignItems: 'flex-end' },
  reportLabel: {
    fontSize: 9,
    color: STORM_COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reportTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: STORM_COLORS.ink,
    marginTop: 2,
  },

  // Cover badge
  coverBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  outcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },

  // Section heading
  sectionWrap: { marginTop: 12 },
  sectionHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: STORM_COLORS.tealDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: STORM_COLORS.border,
    marginBottom: 6,
  },

  // Two-column key/value pairs
  kvGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kvRow: { flexDirection: 'row', width: '50%', marginBottom: 4, paddingRight: 8 },
  kvLabel: {
    width: 90,
    color: STORM_COLORS.hint,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kvValue: { flex: 1, color: STORM_COLORS.ink, fontSize: 9 },

  // Tables
  table: {
    borderWidth: 1,
    borderColor: STORM_COLORS.border,
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: STORM_COLORS.tealDark,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: STORM_COLORS.border,
  },
  tableRowAlt: { backgroundColor: STORM_COLORS.rowAlt },
  tableCell: {
    fontSize: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    color: STORM_COLORS.body,
  },
  emptyTable: {
    padding: 8,
    fontSize: 9,
    color: STORM_COLORS.hint,
    textAlign: 'center',
  },

  // Pre-formatted (vendor text dump)
  pre: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: STORM_COLORS.body,
    backgroundColor: STORM_COLORS.slateBg,
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: STORM_COLORS.border,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerCol: { flexDirection: 'column' },
  footerLine: { fontSize: 7, color: STORM_COLORS.hint },
  footerStrong: {
    fontSize: 7,
    color: STORM_COLORS.ink,
    fontFamily: 'Helvetica-Bold',
  },
  verifiedChip: {
    backgroundColor: STORM_COLORS.emeraldBg,
    color: STORM_COLORS.emerald,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
})

// ── color helpers for outcome badge ────────────────────────────────────────
export function outcomeColors(outcome: ScreeningOutcome): {
  bg: string
  fg: string
} {
  switch (outcome) {
    case 'clear':
    case 'no_hits':
    case 'pass':
      return { bg: STORM_COLORS.emeraldBg, fg: STORM_COLORS.emerald }
    case 'hits':
    case 'discrepancy':
      return { bg: STORM_COLORS.amberBg, fg: STORM_COLORS.amber }
    case 'fail':
      return { bg: STORM_COLORS.roseBg, fg: STORM_COLORS.rose }
    case 'unknown':
      return { bg: STORM_COLORS.slateBg, fg: STORM_COLORS.slate }
    case null:
      return { bg: STORM_COLORS.skyBg, fg: STORM_COLORS.sky }
  }
}

// ── shared components ──────────────────────────────────────────────────────

export interface StormPdfHeaderProps {
  reportLabel: string
  reportTitle: string
  /** e.g. order id — printed under the title */
  reportSubtitle?: string
}

export function StormPdfHeader({
  reportLabel,
  reportTitle,
  reportSubtitle,
}: StormPdfHeaderProps) {
  return (
    <View style={stormPdfStyles.headerRow} fixed>
      <View style={stormPdfStyles.brandWrap}>
        <StormPdfWordmark tagline="Verified Career Identity" />
      </View>
      <View style={stormPdfStyles.reportLabelWrap}>
        <Text style={stormPdfStyles.reportLabel}>{reportLabel}</Text>
        <Text style={stormPdfStyles.reportTitle}>{reportTitle}</Text>
        {reportSubtitle ? (
          <Text style={stormPdfStyles.brandSub}>{reportSubtitle}</Text>
        ) : null}
      </View>
    </View>
  )
}

export interface StormPdfFooterProps {
  /** Storm order id — always printed so support can trace any report. */
  orderId: string
  /** Optional on-chain verification info. When present we show the green chip. */
  verifiedTxHash?: string | null
  /** Polygon scan / explorer URL for the tx hash. */
  verifiedExplorerUrl?: string | null
  /** Accio's vendor reference, when known — small print at the bottom. */
  vendorReference?: string | null
}

export function StormPdfFooter({
  orderId,
  verifiedTxHash,
  verifiedExplorerUrl,
  vendorReference,
}: StormPdfFooterProps) {
  return (
    <View style={stormPdfStyles.footer} fixed>
      <View style={stormPdfStyles.footerCol}>
        {verifiedTxHash ? (
          <Text style={stormPdfStyles.verifiedChip}>VERIFIED ON-CHAIN</Text>
        ) : null}
        <Text style={stormPdfStyles.footerLine}>
          Provven Order {orderId}
          {vendorReference ? ` · Vendor ref ${vendorReference}` : ''}
        </Text>
        {verifiedExplorerUrl ? (
          <Text style={stormPdfStyles.footerLine}>{verifiedExplorerUrl}</Text>
        ) : null}
        <Text style={stormPdfStyles.footerLine}>
          This report was prepared by a Consumer Reporting Agency and is
          governed by the Fair Credit Reporting Act (15 U.S.C. § 1681 et seq).
        </Text>
      </View>
      <View style={[stormPdfStyles.footerCol, { alignItems: 'flex-end' }]}>
        <Text
          style={stormPdfStyles.footerStrong}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
        <Text style={stormPdfStyles.footerLine}>provven.com</Text>
      </View>
    </View>
  )
}

export interface StormPdfDocumentProps {
  title: string
  children: React.ReactNode
}

export function StormPdfDocument({ title, children }: StormPdfDocumentProps) {
  return (
    <Document title={title} author="Provven">
      {children}
    </Document>
  )
}

export interface StormPdfPageProps {
  children: React.ReactNode
  /** When true, long content flows onto additional LETTER pages. */
  wrap?: boolean
}

export function StormPdfPage({ children, wrap }: StormPdfPageProps) {
  return (
    <Page size="LETTER" style={stormPdfStyles.page} wrap={wrap}>
      {children}
    </Page>
  )
}

// ── small reusable bits ────────────────────────────────────────────────────

export interface KeyValueProps {
  label: string
  value?: string | number | null
}

export function KeyValue({ label, value }: KeyValueProps) {
  return (
    <View style={stormPdfStyles.kvRow}>
      <Text style={stormPdfStyles.kvLabel}>{label}</Text>
      <Text style={stormPdfStyles.kvValue}>
        {value === null || value === undefined || value === '' ? '—' : String(value)}
      </Text>
    </View>
  )
}

export interface SectionProps {
  heading: string
  children: React.ReactNode
}

export function Section({ heading, children }: SectionProps) {
  return (
    <View style={stormPdfStyles.sectionWrap}>
      <Text style={stormPdfStyles.sectionHeading}>{heading}</Text>
      {children}
    </View>
  )
}

export interface OutcomeChipProps {
  outcome: ScreeningOutcome
  /** When provided, used as the label override (e.g. "STATUS: CLEAR"). */
  label?: string
}

export function OutcomeChip({ outcome, label }: OutcomeChipProps) {
  const colors = outcomeColors(outcome)
  return (
    <Text
      style={[
        stormPdfStyles.outcomeBadge,
        { backgroundColor: colors.bg, color: colors.fg },
      ]}
    >
      {(label ?? outcomeLabel(outcome)).toUpperCase()}
    </Text>
  )
}
