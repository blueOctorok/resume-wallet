import { NextResponse } from 'next/server'

/**
 * Accio treats a result post as accepted only when the HTTP body is valid XML
 * with no `<error>` node. JSON, even with status 200, is a failed post: they
 * resend until the retry limit, then stop delivering to this URL.
 * See docs/result_receipt.md, chapter 4.
 */
export function accioPostAckResponse(status: number, errorText?: string): NextResponse {
  const accepted = status < 400
  return new NextResponse(accioPostAckXml(accepted ? undefined : (errorText ?? 'Result was not stored')), {
    status: accepted ? 200 : status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

export function accioPostAckXml(errorText?: string): string {
  if (!errorText) return '<XML>Accepted</XML>'
  return `<XML><error><errortext>${escapeXml(errorText)}</errortext></error></XML>`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Short text for a failed post. Never echoes the inbound result XML. */
export function accioPostAckErrorText(body: Record<string, unknown>): string {
  const error = typeof body.error === 'string' ? body.error : 'Result was not stored'
  const details = typeof body.details === 'string' ? body.details : ''
  return details ? `${error}: ${details}` : error
}
