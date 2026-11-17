/**
 * What the Provven paper draws. A driver packet and a professional resume
 * are two ways to fill this shape. The document and the PDF do not care which.
 *
 * A proof chip is only for a fact an issuer signed. Self-reported lines never
 * become chips (DEC-2026-05-014).
 */

import type { DriverResumePacket, DriverResumeProofChip } from '@/lib/driver-resume-packet'

export interface ResumeSheetRole {
  title: string
  date: string
  /** Line under the title, such as "Software architect · provven.com". */
  meta: string | null
  bullets: string[]
}

export type ResumeSheetSection =
  | { kind: 'roles'; title: string; roles: ResumeSheetRole[] }
  | { kind: 'lines'; title: string; note: string | null; lines: string[] }
  | { kind: 'prose'; title: string; text: string }
  | { kind: 'pairs'; title: string; pairs: { label: string; detail: string }[] }

export interface ResumeSheet {
  /**
   * provven — the career-card letterhead. Shown on Provven.
   * portfolio — no Provven wordmark or QR mark. Printed for another site.
   * A portfolio sheet is not a hub block, a career card, or a route.
   */
  letterhead: 'provven' | 'portfolio'
  fullName: string
  tagline: string
  contactLine: string
  summary: string | null
  proofChips: DriverResumeProofChip[]
  sections: ResumeSheetSection[]
  verifyUrl: string
  verifyDisplayPath: string
  qrLabelTop: string
  footerTitle: string
  footerBody: string
  thinStateHint: string | null
  freshnessNote: string | null
  hasVerifiedClaims: boolean
  expiresLabel: string
}

/** Driver packet → paper. Section order matches the driver document. */
export function driverPacketToSheet(packet: DriverResumePacket): ResumeSheet {
  const sections: ResumeSheetSection[] = []

  if (packet.documentLines.length > 0) {
    sections.push({
      kind: 'lines',
      title: 'Equipment & authority',
      note: 'From documents on file. Not a verified claim.',
      lines: packet.documentLines,
    })
  }

  if (packet.experience.length > 0) {
    sections.push({
      kind: 'roles',
      title: 'Experience',
      roles: packet.experience.map((row) => ({
        title: row.titleLine,
        date: row.dateRange,
        meta: null,
        bullets: row.bullets,
      })),
    })
  }

  if (packet.safetySummary) {
    sections.push({
      kind: 'prose',
      title: 'Safety summary (driver-stated)',
      text: packet.safetySummary,
    })
  }

  return {
    letterhead: 'provven',
    fullName: packet.fullName,
    tagline: packet.tagline,
    contactLine: packet.contactLine,
    summary: packet.summary,
    proofChips: packet.proofChips,
    sections,
    verifyUrl: packet.verifyUrl,
    verifyDisplayPath: packet.verifyDisplayPath,
    qrLabelTop: packet.qrLabelTop,
    footerTitle: packet.footerTitle,
    footerBody: packet.footerBody,
    thinStateHint: packet.thinStateHint,
    freshnessNote: packet.freshnessNote,
    hasVerifiedClaims: packet.hasVerifiedClaims,
    expiresLabel: packet.expiresLabel,
  }
}
