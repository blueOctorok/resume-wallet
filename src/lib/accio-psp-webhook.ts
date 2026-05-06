/**
 * PSP (FMCSA crash-inspection) webhook helpers.
 * Full structured parsing waits on sample Accio XML — we only need stable
 * order/suborder + DL fallbacks to match `psp_orders` rows.
 */

function firstCapture(xml: string, re: RegExp): string | null {
  const m = xml.match(re)
  const v = m?.[1]?.trim()
  return v && v.length > 0 ? v : null
}

export interface PspWebhookExtract {
  orderNumber: string | null
  subOrderNumber: string | null
  remoteOrderNumber: string | null
  remoteSubOrderNumber: string | null
  dlNumber: string | null
  dlState: string | null
  filledCode: string | null
}

export function extractPspWebhookFields(xml: string): PspWebhookExtract {
  let orderNumber =
    firstCapture(xml, /reference_number=["']([^"']+)["']/i) ||
    firstCapture(xml, /<completeOrder[^>]*\bnumber=["']([^"']+)["']/i) ||
    firstCapture(xml, /<order[^>]*\bnumber=["']([^"']+)["']/i)

  let subOrderNumber =
    firstCapture(
      xml,
      /<subOrder[^>]*type=["']fmcsa_crash_inspection["'][^>]*suborderID=["']([^"']+)["']/i,
    ) ||
    firstCapture(
      xml,
      /<subOrder[^>]*suborderID=["']([^"']+)["'][^>]*type=["']fmcsa_crash_inspection["']/i,
    )

  const remoteOrderNumber =
    firstCapture(xml, /<completeOrder[^>]*remote_number=["']([^"']+)["']/i) ||
    firstCapture(xml, /<order[^>]*orderID=["']([^"']+)["']/i)

  const remoteSubOrderNumber =
    firstCapture(xml, /<completeOrder[^>]*remote_suborder_number=["']([^"']+)["']/i) ||
    subOrderNumber

  if (!orderNumber) orderNumber = firstCapture(xml, /<postResults[^>]*order=["']([^"']+)["']/i)
  if (!subOrderNumber) subOrderNumber = firstCapture(xml, /<postResults[^>]*subOrder=["']([^"']+)["']/i)

  const fmcsaBlock = xml.match(
    /<subOrder[^>]*type=["']fmcsa_crash_inspection["'][^>]*>([\s\S]*?)<\/subOrder>/i,
  )
  const inner = fmcsaBlock?.[1] ?? xml
  const dlNumber =
    firstCapture(inner, /<dlnum>([^<]*)<\/dlnum>/i) || firstCapture(xml, /<dlnum>([^<]*)<\/dlnum>/i)
  const dlState =
    firstCapture(inner, /<dlstate>([^<]*)<\/dlstate>/i) || firstCapture(xml, /<dlstate>([^<]*)<\/dlstate>/i)

  const filledCode =
    firstCapture(
      xml,
      /<subOrder[^>]*type=["']fmcsa_crash_inspection["'][^>]*filledCode=["']([^"']+)["']/i,
    ) || firstCapture(xml, /filledCode=["']([^"']+)["']/i)

  return {
    orderNumber,
    subOrderNumber,
    remoteOrderNumber,
    remoteSubOrderNumber,
    filledCode,
    dlNumber: dlNumber?.trim() || null,
    dlState: dlState?.trim().toUpperCase() || null,
  }
}
