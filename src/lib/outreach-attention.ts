import type { Invite, ScreeningRow } from '@/components/employer/outreach/types'
import { hubDocStatusFromScreeningOrder } from '@/lib/hub-document-types'

/**
 * "Needs attention" detection for an outreach card.
 *
 * Lives in its own module (pure functions, no React) so it can run on the
 * kanban tile, the detail modal, and — later — on the server if we want to
 * batch-flag stale orders. We intentionally do NOT add a new column to
 * `application_invites`: this state is **derived** from the screening rows
 * the company already paid for. Less DB drift, less mutation, and the
 * conditions get smarter as we learn about real failure modes.
 *
 * Order of `detectOutreachAttention`'s checks matters — first hit wins.
 * Most-actionable / clearest cause first so Stormi shows the highest-signal
 * explanation rather than a generic "stalled" one.
 */

const STALE_PENDING_HOURS = 24

export type AttentionKind =
  | 'order_failed'        // result_outcome === 'fail' or status === 'failed'
  | 'order_error'         // non-null error_code / error_message on the Accio row
  | 'dl_looks_like_name'  // DL number equals candidate's name (the Isaiah Martin case)
  | 'stuck_pending'       // pending > 24h, no processed_at

export interface OutreachAttention {
  kind: AttentionKind
  /** Short label for the badge tooltip and kanban hover. */
  label: string
  /** Long-form, candidate-aware reason rendered in the detail modal. */
  reason: string
  /** Action copy for the CTA (the parent decides what the button does). */
  cta: 'resend_consent' | 'review'
  /** Screening file that triggered the flag — used to deep-link / scope the resend. */
  triggeringFile: ScreeningRow
}

function lettersOnly(value: string | null | undefined): string {
  if (!value) return ''
  return value.toUpperCase().replace(/[^A-Z]/g, '')
}

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / 3_600_000
}

function dlNumberLooksLikeName(file: ScreeningRow, invite: Invite): boolean {
  const dl = lettersOnly(file.dlNumber)
  if (!dl) return false
  // The candidate's name parts. If a single name field exists ("Isaiah Martin"),
  // we still split on whitespace so "MARTIN" alone matches as the last name.
  const nameParts = (invite.candidateName ?? '').trim().split(/\s+/).filter(Boolean)
  const letters = nameParts.map(lettersOnly).filter(Boolean)
  if (letters.length === 0) return false
  if (letters.includes(dl)) return true
  // also full concatenated name, e.g. "ISAIAHMARTIN"
  if (letters.join('') === dl) return true
  return false
}

/**
 * Returns the highest-priority attention reason for the candidate (across all
 * their screenings) or null when nothing looks off. Designed for cheap eval
 * on every render — no DB access, no async.
 */
export function detectOutreachAttention(
  invite: Invite,
  files: ScreeningRow[] | undefined,
): OutreachAttention | null {
  if (!files || files.length === 0) return null

  // 1. Hard failures from Accio — most actionable.
  //    Key off the RAW status, not the derived doc status: `expired`/`cancelled`
  //    both collapse to `failed` in hubDocStatusFromScreeningOrder, but an
  //    expired order is just a lapsed TTL (order window closed), NOT a screening
  //    that "came back failed". Flagging those produced false "MVR error" panels
  //    on completed cards for old/lapsed orders.
  for (const f of files) {
    const raw = String(f.status ?? '').toLowerCase()
    if (raw === 'failed' || f.resultOutcome === 'fail') {
      return {
        kind: 'order_failed',
        label: `${f.kind.toUpperCase()} came back failed`,
        reason: `The ${f.kind.toUpperCase()} pulled on ${formatDate(f.orderedAt)} returned a non-passing result from the screening provider. Open the file to review the report or resend the consent to start over with corrected data.`,
        cta: 'review',
        triggeringFile: f,
      }
    }
  }

  // 2. Errored at intake (Accio set error_code / error_message).
  for (const f of files) {
    if (f.errorCode || f.errorMessage) {
      return {
        kind: 'order_error',
        label: `${f.kind.toUpperCase()} rejected by provider`,
        reason: `Accio rejected this ${f.kind.toUpperCase()} order: ${f.errorMessage || f.errorCode}. Usually means a malformed field (DL number, SSN, or state). Resend the consent so ${displayName(invite)} can re-enter the correct values.`,
        cta: 'resend_consent',
        triggeringFile: f,
      }
    }
  }

  // 3. DL number looks like the candidate's name (the Isaiah Martin case).
  //    Accio silently accepts garbage like "MARTIN" and never errors — it
  //    just hangs forever on applicant-portal lookup. This explicit check
  //    catches it the moment the order lands in our DB.
  for (const f of files) {
    if (dlNumberLooksLikeName(f, invite)) {
      return {
        kind: 'dl_looks_like_name',
        label: 'DL number looks like a name',
        reason: `The ${f.kind.toUpperCase()} order was placed with "${f.dlNumber}" in the driver license field — that matches ${displayName(invite)}'s name. Accio won't return a useful report. Resend the consent and ask them to enter the DL number from the front of their license.`,
        cta: 'resend_consent',
        triggeringFile: f,
      }
    }
  }

  // 4. Stuck pending — last resort, low-signal fallback.
  for (const f of files) {
    const docStatus = hubDocStatusFromScreeningOrder(f.status)
    if (docStatus === 'processing' || docStatus === 'pending') {
      const age = hoursSince(f.orderedAt)
      if (age !== null && age > STALE_PENDING_HOURS) {
        const hours = Math.floor(age)
        return {
          kind: 'stuck_pending',
          label: `${f.kind.toUpperCase()} pending ${hours}h`,
          reason: `The ${f.kind.toUpperCase()} ordered on ${formatDate(f.orderedAt)} hasn't moved in ${hours} hours. Accio typically returns within 30 minutes. Common cause: a typo in DL number or SSN. Resend the consent so ${displayName(invite)} can correct it.`,
          cta: 'resend_consent',
          triggeringFile: f,
        }
      }
    }
  }

  return null
}

function displayName(invite: Invite): string {
  return invite.candidateName?.trim() || invite.candidateEmail || 'this candidate'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}
