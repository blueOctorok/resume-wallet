/**
 * Storm-branded PDF of a good-faith employment-verification attempt record.
 * Composes StormPdfChrome primitives; see evr-attempt-record.ts for the data.
 */

import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import {
  KeyValue,
  Section,
  StormPdfDocument,
  StormPdfHeader,
  StormPdfPage,
  stormPdfStyles,
} from '@/lib/pdf/StormPdfChrome'
import type { EvrAttemptRecord } from '@/lib/evr-attempt-record'

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) + ' UTC' : '—'

function deliveryLabel(attempt: EvrAttemptRecord['attempts'][number]): string {
  if (attempt.deliveryStatus === 'failed' && attempt.method === 'phone') return 'Call failed'
  if (attempt.deliveryStatus === 'failed' && attempt.method === 'sms') return 'Text failed'
  if (attempt.deliveryStatus === 'delivered' && attempt.method === 'sms') return 'Text delivered'
  if (attempt.deliveryStatus === 'sent' && attempt.method === 'phone') return 'Call placed'
  if (attempt.deliveryStatus === 'sent' && attempt.method === 'sms') return 'Text sent'
  const generic: Record<typeof attempt.deliveryStatus, string> = {
    sent: 'Sent',
    delivered: 'Delivered',
    opened: 'Opened',
    clicked: 'Link clicked',
    failed: 'Bounced / failed',
  }
  return generic[attempt.deliveryStatus]
}

const COL = { n: 28, when: 120, to: 150, status: 90, by: 60 } as const

function RecordFooter({ hash, packetId }: { hash: string; packetId: string }) {
  // Not StormPdfFooter: that one carries CRA/FCRA language, and this record
  // is explicitly NOT a consumer report — Storm acted as the driver's agent.
  return (
    <View style={stormPdfStyles.footer} fixed>
      <View style={stormPdfStyles.footerCol}>
        <Text style={stormPdfStyles.footerLine}>Packet {packetId}</Text>
        <Text style={stormPdfStyles.footerLine}>SHA-256 {hash}</Text>
        <Text style={stormPdfStyles.footerLine}>
          Prepared by Provven as the applicant&apos;s authorized agent. This is a record of outreach
          attempts, not a consumer report and not an employment verification.
        </Text>
      </View>
      <View style={[stormPdfStyles.footerCol, { alignItems: 'flex-end' }]}>
        <Text
          style={stormPdfStyles.footerStrong}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
        <Text style={stormPdfStyles.footerLine}>provven.com</Text>
      </View>
    </View>
  )
}

export function EvrAttemptRecordPdf({ record, hash }: { record: EvrAttemptRecord; hash: string }) {
  const { packet, attempts } = record
  return (
    <StormPdfDocument title={`Verification attempt record – ${packet.employerName}`}>
      <StormPdfPage wrap footer={<RecordFooter hash={hash} packetId={packet.id} />}>
        <StormPdfHeader
          reportLabel="Employment verification"
          reportTitle="Good-faith attempt record"
          reportSubtitle={`Generated ${fmt(record.generatedAt)}`}
        />

        <Section heading="Previous employer">
          <View style={stormPdfStyles.kvGrid}>
            <KeyValue label="Company" value={packet.employerName} />
            <KeyValue label="Email" value={packet.employerEmail} />
            <KeyValue label="Phone" value={packet.employerPhone} />
            <KeyValue label="Status" value={packet.status.replace(/_/g, ' ').toLowerCase()} />
          </View>
        </Section>

        <Section heading="Applicant's claimed employment">
          <View style={stormPdfStyles.kvGrid}>
            <KeyValue label="Applicant" value={record.driver.name} />
            <KeyValue label="Position" value={packet.claimedPosition} />
            <KeyValue label="Start" value={packet.claimedStartDate} />
            <KeyValue label="End" value={packet.claimedEndDate ?? 'Present'} />
          </View>
        </Section>

        <Section heading={`Outreach attempts (${attempts.length})`}>
          <View style={stormPdfStyles.table}>
            <View style={stormPdfStyles.tableHeaderRow}>
              <Text style={[stormPdfStyles.tableHeaderCell, { width: COL.n }]}>#</Text>
              <Text style={[stormPdfStyles.tableHeaderCell, { width: COL.when }]}>Sent</Text>
              <Text style={[stormPdfStyles.tableHeaderCell, { width: COL.to }]}>To</Text>
              <Text style={[stormPdfStyles.tableHeaderCell, { width: COL.status }]}>Delivery</Text>
              <Text style={[stormPdfStyles.tableHeaderCell, { width: COL.by }]}>Trigger</Text>
              <Text style={[stormPdfStyles.tableHeaderCell, { flex: 1 }]}>Detail</Text>
            </View>
            {attempts.length === 0 ? (
              <Text style={stormPdfStyles.emptyTable}>No attempts recorded.</Text>
            ) : (
              attempts.map((a, i) => (
                <View
                  key={a.attemptNumber}
                  style={[stormPdfStyles.tableRow, ...(i % 2 ? [stormPdfStyles.tableRowAlt] : [])]}
                >
                  <Text style={[stormPdfStyles.tableCell, { width: COL.n }]}>{a.attemptNumber}</Text>
                  <Text style={[stormPdfStyles.tableCell, { width: COL.when }]}>{fmt(a.sentAt)}</Text>
                  <Text style={[stormPdfStyles.tableCell, { width: COL.to }]}>{a.to ?? '—'}</Text>
                  <Text style={[stormPdfStyles.tableCell, { width: COL.status }]}>
                    {deliveryLabel(a)}
                  </Text>
                  <Text style={[stormPdfStyles.tableCell, { width: COL.by }]}>{a.triggeredBy}</Text>
                  <Text style={[stormPdfStyles.tableCell, { flex: 1 }]}>
                    {a.failureCode
                      ? `Failure: ${a.failureCode}`
                      : [
                          a.deliveredAt ? `Delivered ${fmt(a.deliveredAt)}` : null,
                          a.openedAt ? `Opened ${fmt(a.openedAt)}` : null,
                          a.clickedAt ? `Clicked ${fmt(a.clickedAt)}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                  </Text>
                </View>
              ))
            )}
          </View>
        </Section>

        <Section heading="Statement">
          <Text>{record.statement}</Text>
          {packet.exhaustedAt ? (
            <Text style={{ marginTop: 4 }}>Outreach marked exhausted {fmt(packet.exhaustedAt)}.</Text>
          ) : null}
        </Section>
      </StormPdfPage>
    </StormPdfDocument>
  )
}
