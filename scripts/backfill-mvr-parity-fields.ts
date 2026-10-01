/**
 * Backfill the Key-parity fields onto historical MVR results (Oct 2026).
 *
 * The parser now keeps the facts Key prints and we used to drop: the DMV's
 * mismatch-alert reasons behind a "discrepancy", Report Clear, the name as it
 * appears on the DMV record, and suspension clear/end dates + ACD/AVD codes.
 * Rows parsed before that change have none of them, so Stormi / dq-coach can
 * only say "there was a discrepancy" without saying which field.
 *
 * This re-parses `mvr_orders.result_xml` and patches ONLY those keys:
 *
 *   mvr_results.parsed_data.mismatchAlerts / reportClear / dmvRecordName
 *   mvr_results.parsed_data.suspensions.details   (same rows, now with
 *                                                  clearedDate/acdCode/avdCode)
 *   mvr_results.suspensions                        (mirror of the above)
 *
 * Everything else in parsed_data is preserved byte-for-byte. The PDF does not
 * need this — it re-parses result_xml on every request.
 *
 * Dry run (default):  npx tsx scripts/backfill-mvr-parity-fields.ts
 * Apply:              npx tsx scripts/backfill-mvr-parity-fields.ts --apply
 */
import { readFileSync } from 'node:fs'
import { parseAccioMvrResult, type Suspension } from '../src/lib/accio-xml-parser'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)

const APPLY = process.argv.includes('--apply')
const BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
  'Content-Type': 'application/json',
}

type OrderRow = { id: string; result_xml: string | null }
type ResultRow = { parsed_data: Record<string, unknown> | null }

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { ...init, headers: HEADERS })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

/** PostgREST caps rows per response, so page through the whole table. */
async function fetchAllOrders(): Promise<OrderRow[]> {
  const pageSize = 500
  const all: OrderRow[] = []
  for (let offset = 0; ; offset += pageSize) {
    const page = await rest<OrderRow[]>(
      `mvr_orders?result_xml=not.is.null&select=id,result_xml&order=created_at.asc&limit=${pageSize}&offset=${offset}`,
    )
    all.push(...page)
    if (page.length < pageSize) return all
  }
}

/**
 * Invariant: the re-parsed suspensions must be the stored ones plus new keys —
 * same count, same effective dates, in order. If the parser disagrees on the
 * rows themselves, this order is reported instead of patched.
 */
function suspensionsMatch(stored: unknown, fresh: Suspension[]): boolean {
  if (!Array.isArray(stored)) return fresh.length === 0
  if (stored.length !== fresh.length) return false
  return stored.every((s, i) => (s as { date?: string })?.date === fresh[i].date)
}

async function main() {
  const orders = await fetchAllOrders()
  console.log(`[BACKFILL] ${orders.length} MVR orders with raw XML${APPLY ? '' : ' (DRY RUN)'}\n`)

  let patched = 0
  let withAlerts = 0
  let withClearDates = 0
  let skippedNoResultRow = 0
  let errors = 0
  const samples: string[] = []
  const suspensionMismatches: string[] = []

  for (const order of orders) {
    try {
      const parsed = parseAccioMvrResult(order.result_xml!)
      const [existing] = await rest<ResultRow[]>(
        `mvr_results?mvr_order_id=eq.${order.id}&select=parsed_data`,
      )
      if (!existing) {
        skippedNoResultRow++
        continue
      }

      const storedSuspensions = (existing.parsed_data?.suspensions as { details?: unknown } | undefined)?.details
      const freshSuspensions = parsed.suspensions ?? []
      if (!suspensionsMatch(storedSuspensions, freshSuspensions)) {
        suspensionMismatches.push(
          `  ${order.id}  stored ${Array.isArray(storedSuspensions) ? storedSuspensions.length : 0} vs fresh ${freshSuspensions.length}`,
        )
        continue
      }

      const alerts = parsed.mismatchAlerts ?? []
      if (alerts.length > 0) withAlerts++
      if (freshSuspensions.some((s) => s.clearedDate)) withClearDates++
      patched++
      if (samples.length < 5 && (alerts.length > 0 || freshSuspensions.some((s) => s.clearedDate))) {
        samples.push(
          `  ${order.id}  alerts=${alerts.length}  ` +
            freshSuspensions
              .filter((s) => s.clearedDate)
              .map((s) => `${s.date}→${s.clearedDate} ${s.acdCode ?? ''}/${s.avdCode ?? ''}`)
              .join(' | '),
        )
      }

      if (!APPLY) continue

      await rest(`mvr_results?mvr_order_id=eq.${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          suspensions: freshSuspensions,
          parsed_data: {
            ...(existing.parsed_data ?? {}),
            mismatchAlerts: alerts,
            reportClear: parsed.reportClear,
            dmvRecordName: parsed.dmvRecordName,
            suspensions: { count: parsed.suspensionCount ?? freshSuspensions.length, details: freshSuspensions },
          },
        }),
      })
    } catch (err) {
      errors++
      console.error(`[BACKFILL] ${order.id}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log('Sample of records gaining data:')
  console.log(samples.join('\n') || '  (none)')
  if (suspensionMismatches.length > 0) {
    console.log(`\n⚠  ${suspensionMismatches.length} orders skipped — re-parsed suspensions differ from stored rows:`)
    console.log(suspensionMismatches.slice(0, 10).join('\n'))
  } else {
    console.log('\n✓ Invariant holds: suspension rows unchanged, only new keys added.')
  }
  console.log(
    `\n[BACKFILL] ${APPLY ? 'patched' : 'would patch'} ${patched} results · ` +
      `${withAlerts} with mismatch alerts · ${withClearDates} with suspension clear dates · ` +
      `${skippedNoResultRow} without an mvr_results row · ${errors} errors`,
  )
  if (!APPLY) console.log('[BACKFILL] Dry run only — re-run with --apply to write.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
