/**
 * Backfill accidents onto historical MVR results (Sept 2026 accident-parsing bug).
 *
 * The parser looked for an `<mvr_accident>` element Accio never sends, so every
 * stored MVR reported accidentCount 0 while real accidents sat misfiled under
 * additionalDriverInfo. This re-parses `mvr_orders.result_xml` with the fixed
 * parser and corrects ONLY the accident-related fields:
 *
 *   mvr_results.accidents / accident_count
 *   mvr_results.parsed_data.accidents  (+ .additionalDriverInfo, which shed the
 *                                       accident rows it was wrongly holding)
 *   block_driver_mvr.accidents         (driver-owned orders only)
 *
 * Status, outcome, violations, points, licences and medical fields are left
 * untouched on purpose — narrow blast radius, and nothing else regressed.
 *
 * Dry run (default):  npx tsx scripts/backfill-mvr-accidents.ts
 * Apply:              npx tsx scripts/backfill-mvr-accidents.ts --apply
 */
import { readFileSync } from 'node:fs'
import { parseAccioMvrResult } from '../src/lib/accio-xml-parser'

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

type OrderRow = {
  id: string
  driver_user_id: string | null
  ordered_by_company_id: string | null
  result_xml: string | null
}

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
      `mvr_orders?result_xml=not.is.null&select=id,driver_user_id,ordered_by_company_id,result_xml` +
        `&order=created_at.asc&limit=${pageSize}&offset=${offset}`,
    )
    all.push(...page)
    if (page.length < pageSize) return all
  }
}

/**
 * Key-order-insensitive serializer for comparing a freshly parsed object against
 * one read back from Postgres. `jsonb` does not preserve key order — it stores
 * keys sorted by length then bytewise — so plain JSON.stringify reports two
 * identical records as different purely because they round-tripped the DB.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`
}

async function main() {
  const orders = await fetchAllOrders()
  console.log(`[BACKFILL] ${orders.length} MVR orders with raw XML${APPLY ? '' : ' (DRY RUN)'}\n`)

  let changed = 0
  let accidentsFound = 0
  let errors = 0
  let skippedNoResultRow = 0
  const samples: string[] = []
  const invariantMismatches: string[] = []

  for (const order of orders) {
    try {
      const parsed = parseAccioMvrResult(order.result_xml!)
      const accidents = parsed.accidents ?? []
      if (accidents.length === 0) continue

      const [existing] = await rest<Array<{ parsed_data: Record<string, unknown> | null }>>(
        `mvr_results?mvr_order_id=eq.${order.id}&select=parsed_data`,
      )
      if (!existing) {
        skippedNoResultRow++
        continue
      }

      // Invariant: the new additionalDriverInfo must be the old list with only
      // accident rows removed — never anything added, never anything else lost.
      //
      // Removal count is allowed to be either accidents.length (first pass, the
      // accidents are still misfiled) or 0 (this order was already corrected).
      // Re-runs are expected: until the parser fix is deployed, a live Accio
      // webhook re-processes orders with the old parser and re-misfiles them.
      const oldAdditional = (existing.parsed_data?.additionalDriverInfo as unknown[] | undefined) ?? []
      const newAdditional = parsed.additionalDriverInfo ?? []
      const removed = oldAdditional.length - newAdditional.length
      const oldSerialized = new Set(oldAdditional.map(canonicalize))
      const keptAllFromOld = newAdditional.every((e) => oldSerialized.has(canonicalize(e)))

      if ((removed !== accidents.length && removed !== 0) || !keptAllFromOld) {
        invariantMismatches.push(
          `  ${order.id}  additionalDriverInfo ${oldAdditional.length}→${newAdditional.length}, ` +
            `accidents ${accidents.length}${keptAllFromOld ? '' : ', new entries not present in old list'}`,
        )
      }

      changed++
      accidentsFound += accidents.length
      if (samples.length < 5) {
        samples.push(
          `  ${order.id}  ${accidents.length} accident(s)  ` +
            accidents.map((a) => `${a.date ?? '?'} ${a.description ?? ''}`.trim()).join(' | '),
        )
      }

      if (!APPLY) continue

      // Patch only the accident keys inside parsed_data; every other key the
      // previous parse produced is preserved byte-for-byte.
      const parsedData = {
        ...(existing.parsed_data ?? {}),
        accidents: { count: accidents.length, details: accidents },
        additionalDriverInfo: parsed.additionalDriverInfo ?? [],
      }

      await rest(`mvr_results?mvr_order_id=eq.${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          accidents,
          accident_count: accidents.length,
          parsed_data: parsedData,
        }),
      })

      // Driver-owned orders also feed the hub block cache. atFault/injuries/
      // fatalities are omitted — the MVR doesn't report them.
      if (order.driver_user_id && !order.ordered_by_company_id) {
        await rest(`block_driver_mvr?user_id=eq.${order.driver_user_id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            accidents: accidents.map((a) => ({
              date: a.date ?? '',
              description: a.description ?? '',
            })),
          }),
        })
      }
    } catch (err) {
      errors++
      console.error(`[BACKFILL] ${order.id}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log('Sample of corrected records:')
  console.log(samples.join('\n'))
  if (invariantMismatches.length > 0) {
    console.log(`\n⚠  ${invariantMismatches.length} orders change more than just accidents:`)
    console.log(invariantMismatches.slice(0, 10).join('\n'))
  } else {
    console.log('\n✓ Invariant holds: accident rows only move out of additionalDriverInfo.')
  }
  console.log(
    `\n[BACKFILL] ${APPLY ? 'updated' : 'would update'} ${changed} orders / ` +
      `${accidentsFound} accident records · ${skippedNoResultRow} without an mvr_results row · ${errors} errors`,
  )
  if (!APPLY) console.log('[BACKFILL] Dry run only — re-run with --apply to write.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
