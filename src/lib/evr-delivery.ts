/**
 * Per-packet secure delivery address for employment-verification responses.
 *
 * Boss requirement (2026-09-11): the employer's response must ALWAYS land in
 * Provven. Pingram catches all inbound mail on this domain, so any packet that
 * prints `evr-<requestId>@verify.provven.com` as its delivery destination
 * routes the response straight into our inbound webhook — even when the
 * employer composes a fresh email instead of replying to ours.
 *
 * Why a hardcoded domain instead of env: this renders inside a client
 * component (the authorization paper), where server env isn't available, and
 * Pingram's inbound catch-all is configured for exactly this domain. If the
 * domain ever changes, update it here and in Pingram together.
 */
export const EVR_DELIVERY_DOMAIN = 'verify.provven.com'

export function evrDeliveryAddress(requestId: string): string {
  return `evr-${requestId}@${EVR_DELIVERY_DOMAIN}`
}

/**
 * Pull the request id back out of an inbound `to` address.
 * Min 16 chars keeps short strings (test ids, unrelated `evr-` prefixes) from
 * false-matching; real ids are 36-char UUIDs.
 */
export function parseEvrDeliveryRequestId(to: string | null | undefined): string | null {
  const match = String(to ?? '')
    .toLowerCase()
    .match(/\bevr-([a-z0-9-]{16,64})@/)
  return match ? match[1] : null
}
