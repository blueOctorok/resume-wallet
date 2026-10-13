/**
 * Outreach numbers for the admin Verifications tab.
 *
 * Reply rate is "of packets that received email N, how many were answered on
 * that email." attempt_count is the number of emails sent, so a reply that
 * landed after the second email has attempt_count 2. Voice and SMS touches
 * do not increment attempt_count, so they do not move these rates.
 */

const REPLIED = new Set(['VERIFIED', 'PARTIALLY_VERIFIED', 'VERIFICATION_DENIED'])

export interface EvrMetricRequest {
  status: string
  attemptCount: number
}

export interface EvrMetricAttempt {
  deliveryStatus: string | null
}

export interface EvrReplyRate {
  attemptNumber: number
  sent: number
  replied: number
  rate: number
}

export interface EvrOutreachSummary {
  total: number
  byStatus: Record<string, number>
  exhaustedRate: number
  bounceRate: number
  replyRateByAttempt: EvrReplyRate[]
}

export function summarizeEvrOutreach(
  requests: EvrMetricRequest[],
  attempts: EvrMetricAttempt[],
): EvrOutreachSummary {
  const byStatus: Record<string, number> = {}
  for (const row of requests) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
  }

  const replyRateByAttempt = [1, 2, 3].map((attemptNumber) => {
    const sent = requests.filter((r) => r.attemptCount >= attemptNumber).length
    const replied = requests.filter(
      (r) => r.attemptCount === attemptNumber && REPLIED.has(r.status),
    ).length
    return {
      attemptNumber,
      sent,
      replied,
      rate: sent === 0 ? 0 : replied / sent,
    }
  })

  const failed = attempts.filter((a) => a.deliveryStatus === 'failed').length
  const exhausted = byStatus.ATTEMPTS_EXHAUSTED ?? 0

  return {
    total: requests.length,
    byStatus,
    exhaustedRate: requests.length === 0 ? 0 : exhausted / requests.length,
    bounceRate: attempts.length === 0 ? 0 : failed / attempts.length,
    replyRateByAttempt,
  }
}
