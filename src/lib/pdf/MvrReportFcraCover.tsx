/**
 * Consumer-report framing for the MVR PDF cover: who the report was prepared
 * for, who requested it, the component status table, and the FCRA notice.
 *
 * This is what turns a "data summary" into a document a carrier can file in a
 * DQ folder. Key Background's report has all of it; ours didn't until Oct 2026.
 *
 * Posture (DEC-2026-05-011): Storm is the candidate's agent, not a CRA. The
 * CRA is Key Background Screening, Inc. — the notice names them and says
 * Provven does not conduct MVR searches itself. Copy adapted from Key's notice
 * and the counsel-reviewed language already in `MvrOrderForm.tsx`.
 */

import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { STORM_COLORS, Section, stormPdfStyles } from '@/lib/pdf/StormPdfChrome'

export interface MvrReportParty {
  name: string
  addressLines?: string[]
  phone?: string | null
  email?: string | null
}

export interface MvrReportFcraCoverProps {
  /** Employer that ordered (or the candidate, for self-initiated pulls). */
  preparedFor: MvrReportParty
  /** Person who placed the order, when known. */
  requestedBy?: MvrReportParty | null
  /** e.g. "Motor Vehicle Report in Massachusetts for David Hulme" */
  componentLabel: string
  /** e.g. "Complete — Hits found" */
  componentStatus: string
  /** When the vendor last updated the component (already formatted). */
  componentUpdatedAt: string
  /** Key Background's order number (Accio remote_number). */
  craOrderNumber?: string | null
}

const CRA_NAME = 'Key Background Screening, Inc.'
const CRA_ADDRESS = '3711 Chester Ave., Suite 200, Cleveland, OH 44114 · 1-800-648-6148'

const FCRA_NOTICE =
  `Notice: The motor vehicle record in this report is a consumer report as defined in the federal Fair Credit Reporting Act (15 U.S.C. §§ 1681–1681x). It was obtained from the issuing state by ${CRA_NAME}, a consumer reporting agency, through its secure ordering system, and is furnished through Provven at the direction of the named individual and/or the requesting employer. Provven does not independently conduct motor vehicle record searches. ` +
  'This report contains confidential information about the individual named and may be used solely as a factor in evaluating that individual for employment, promotion, reassignment, or retention as an employee, or for another permissible purpose under the FCRA. While the information is furnished from reliable sources, its accuracy is not guaranteed; proper use of this report and final verification of the named individual\u2019s identity are the sole responsibility of the user. ' +
  'If any adverse action is taken based in whole or in part on this report, a copy of the report and "A Summary of Your Rights Under the Fair Credit Reporting Act" (attached) must be provided to the consumer before taking that action.'

const partyCol = { width: '50%', paddingRight: 10 } as const
const partyLabel = {
  fontSize: 8,
  color: STORM_COLORS.hint,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: 2,
} as const
const partyLine = { fontSize: 9, color: STORM_COLORS.ink } as const
const STATUS_COLS = ['50%', '25%', '25%']

function PartyBlock({ label, party }: { label: string; party: MvrReportParty }) {
  return (
    <View style={partyCol}>
      <Text style={partyLabel}>{label}</Text>
      <Text style={{ ...partyLine, fontFamily: 'Helvetica-Bold' }}>{party.name}</Text>
      {party.addressLines?.filter(Boolean).map((line) => (
        <Text key={line} style={partyLine}>
          {line}
        </Text>
      ))}
      {party.phone ? <Text style={partyLine}>{party.phone}</Text> : null}
      {party.email ? <Text style={partyLine}>{party.email}</Text> : null}
    </View>
  )
}

export function MvrReportFcraCover({
  preparedFor,
  requestedBy,
  componentLabel,
  componentStatus,
  componentUpdatedAt,
  craOrderNumber,
}: MvrReportFcraCoverProps) {
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        <PartyBlock label="Prepared for" party={preparedFor} />
        <View style={partyCol}>
          <Text style={partyLabel}>Consumer reporting agency</Text>
          <Text style={{ ...partyLine, fontFamily: 'Helvetica-Bold' }}>{CRA_NAME}</Text>
          <Text style={partyLine}>{CRA_ADDRESS}</Text>
          {craOrderNumber ? <Text style={partyLine}>CRA order {craOrderNumber}</Text> : null}
          {requestedBy ? (
            <View style={{ marginTop: 6 }}>
              <Text style={partyLabel}>Requested by</Text>
              <Text style={partyLine}>
                {[requestedBy.name, requestedBy.email].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Section heading="Report Summary">
        <View style={stormPdfStyles.table}>
          <View style={stormPdfStyles.tableHeaderRow}>
            <Text style={[stormPdfStyles.tableHeaderCell, { width: STATUS_COLS[0] }]}>Component</Text>
            <Text style={[stormPdfStyles.tableHeaderCell, { width: STATUS_COLS[1] }]}>Status</Text>
            <Text style={[stormPdfStyles.tableHeaderCell, { width: STATUS_COLS[2] }]}>Last update</Text>
          </View>
          <View style={stormPdfStyles.tableRow}>
            <Text style={[stormPdfStyles.tableCell, { width: STATUS_COLS[0] }]}>{componentLabel}</Text>
            <Text style={[stormPdfStyles.tableCell, { width: STATUS_COLS[1], fontFamily: 'Helvetica-Bold' }]}>
              {componentStatus}
            </Text>
            <Text style={[stormPdfStyles.tableCell, { width: STATUS_COLS[2] }]}>{componentUpdatedAt}</Text>
          </View>
        </View>
      </Section>

      <Text style={{ fontSize: 7.5, color: STORM_COLORS.muted, lineHeight: 1.4, marginTop: 8 }}>
        {FCRA_NOTICE}
      </Text>
    </View>
  )
}
