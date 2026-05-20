/**
 * Pull order status/results directly from Accio via `getOrderResults`.
 * Used when webhooks are delayed or never arrive — same XML the webhook would post.
 */

const ACCIO_API_URL =
  process.env.ACCIO_API_URL || 'https://service.keybackground.com/c/p/researcherxml'

export interface AccioSuborderSummary {
  type: string | null
  filledStatus: string | null
  filledCode: string | null
  heldForReview: string | null
  remoteSubOrderNumber: string | null
}

export function buildGetOrderResultsXml(accioOrderNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<XML>
    <login>
        <account>${process.env.ACCIO_ACCOUNT || ''}</account>
        <username>${process.env.ACCIO_USERNAME || ''}</username>
        <password>${process.env.ACCIO_PASSWORD || ''}</password>
    </login>
    <getOrderResults orderID="${accioOrderNumber}" />
</XML>`
}

/** Summarize every `<subOrder>` in an Accio response for logging / reconcile decisions. */
export function summarizeAccioSuborders(xml: string): AccioSuborderSummary[] {
  const re = /<subOrder([^>]*)>/gi
  const out: AccioSuborderSummary[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1]
    const a = (name: string) =>
      new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(attrs)?.[1] ?? null
    out.push({
      type: a('type'),
      filledStatus: a('filledStatus'),
      filledCode: a('filledCode'),
      heldForReview: a('held_for_review'),
      remoteSubOrderNumber: a('remote_number') ?? a('number'),
    })
  }
  return out
}

function isFilledStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  if (!s) return false
  if (s === 'in progress' || s === 'inprogress' || s === 'pending' || s === 'unfilled') {
    return false
  }
  return s === 'filled' || s === 'complete' || s === 'completed'
}

/** True when Accio reports the MVR suborder as filled (ready to import). */
export function accioXmlHasFilledMvr(xml: string): boolean {
  return summarizeAccioSuborders(xml).some(
    (s) => s.type?.toUpperCase() === 'MVR' && isFilledStatus(s.filledStatus),
  )
}

/** True when Accio reports the FMCSA PSP suborder as filled. */
export function accioXmlHasFilledFmcsa(xml: string): boolean {
  return summarizeAccioSuborders(xml).some(
    (s) =>
      (s.type?.toLowerCase().includes('fmcsa') ||
        s.type?.toLowerCase().includes('crash')) &&
      isFilledStatus(s.filledStatus),
  )
}

export type AccioPullResult =
  | { ok: true; xml: string }
  | { ok: false; status: number; body: string }

/**
 * Detect Accio error responses that come back as HTTP 200 with XML error nodes.
 * Common cases: error code 90 (invalid orderID), 91 (cannot view), missing perms.
 */
export function hasAccioErrorXml(xml: string): boolean {
  return (
    /<error\b/i.test(xml) ||
    /<errors\b/i.test(xml) ||
    /<status>\s*ERROR\s*<\/status>/i.test(xml) ||
    /errorCode/i.test(xml)
  )
}

export async function pullAccioOrderResults(
  accioOrderNumber: string,
): Promise<AccioPullResult> {
  const requestXml = buildGetOrderResultsXml(accioOrderNumber)
  try {
    const res = await fetch(ACCIO_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: requestXml,
    })
    const xml = await res.text()
    if (!res.ok) return { ok: false, status: res.status, body: xml }
    // HTTP 200 with XML error nodes → still a failure
    if (hasAccioErrorXml(xml)) {
      return { ok: false, status: 200, body: xml }
    }
    return { ok: true, xml }
  } catch (e) {
    return {
      ok: false,
      status: 502,
      body: e instanceof Error ? e.message : String(e),
    }
  }
}
