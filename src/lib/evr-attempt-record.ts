/**
 * Good-faith attempt record for an employment-verification packet.
 *
 * 49 CFR §391.23(c)(3) lets a carrier document a good-faith effort when a
 * previous employer never responds. This module turns the packet + its
 * attempt rows into a canonical, hashable record so the driver can hand a
 * new carrier something concrete ("3 emails, delivered, never answered")
 * instead of "I tried".
 *
 * Not a CRA artifact — Storm acted as the driver's agent. The record states
 * what Storm sent and what the mail provider reported back; nothing more.
 */

import { createHash } from 'node:crypto'
import type { VerificationAttempt, VerificationRequest } from '@/types/employment-verification'

export interface EvrAttemptRecord {
  recordVersion: 1
  generatedAt: string
  packet: {
    id: string
    employerName: string
    employerEmail: string | null
    employerPhone: string | null
    claimedPosition: string
    claimedStartDate: string
    claimedEndDate: string | null
    status: VerificationRequest['status']
    firstSentAt: string | null
    lastSentAt: string | null
    exhaustedAt: string | null
  }
  driver: { name: string }
  attempts: {
    attemptNumber: number
    sentAt: string
    method: VerificationAttempt['method']
    to: string | null
    deliveryStatus: VerificationAttempt['deliveryStatus']
    deliveredAt: string | null
    openedAt: string | null
    clickedAt: string | null
    failedAt: string | null
    failureCode: string | null
    triggeredBy: VerificationAttempt['triggeredBy']
  }[]
  statement: string
}

/**
 * JSON.stringify is key-order dependent, so two identical records built from
 * differently-ordered objects would hash differently. Sorting keys recursively
 * makes the hash a function of the data alone.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

export function buildAttemptRecord(
  request: VerificationRequest,
  attempts: VerificationAttempt[],
  driverName: string,
  generatedAt = new Date().toISOString(),
): { record: EvrAttemptRecord; hash: string } {
  const ordered = [...attempts].sort((a, b) => a.attemptNumber - b.attemptNumber)
  const delivered = ordered.filter((a) => a.deliveryStatus !== 'sent' && a.deliveryStatus !== 'failed').length

  const record: EvrAttemptRecord = {
    recordVersion: 1,
    generatedAt,
    packet: {
      id: request.id,
      employerName: request.previousEmployerName,
      employerEmail: request.previousEmployerEmail,
      employerPhone: request.previousEmployerPhone,
      claimedPosition: request.claimedPosition,
      claimedStartDate: request.claimedStartDate,
      claimedEndDate: request.claimedEndDate,
      status: request.status,
      firstSentAt: ordered[0]?.sentAt ?? null,
      lastSentAt: ordered.at(-1)?.sentAt ?? null,
      exhaustedAt: request.outreachExhaustedAt ?? null,
    },
    driver: { name: driverName },
    attempts: ordered.map((a) => ({
      attemptNumber: a.attemptNumber,
      sentAt: a.sentAt,
      method: a.method,
      to: a.contactEmail ?? a.contactPhone,
      deliveryStatus: a.deliveryStatus,
      deliveredAt: a.deliveredAt,
      openedAt: a.emailOpenedAt,
      clickedAt: a.linkClickedAt,
      failedAt: a.failedAt,
      failureCode: a.failureCode,
      triggeredBy: a.triggeredBy,
    })),
    statement:
      `Acting as ${driverName}'s agent under a signed authorization, Provven sent ${ordered.length} ` +
      `employment verification request${ordered.length === 1 ? '' : 's'} to ${request.previousEmployerName}` +
      `${request.previousEmployerEmail ? ` at ${request.previousEmployerEmail}` : ''}. ` +
      `${delivered} ${delivered === 1 ? 'was' : 'were'} confirmed delivered by the mail provider. ` +
      'No verification response was received through the secure reply link or by email reply.',
  }

  return { record, hash: sha256Hex(canonicalJson(record)) }
}
