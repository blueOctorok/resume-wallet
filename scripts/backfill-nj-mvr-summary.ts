/**
 * Fill structured fields on New Jersey MVRs that arrived as a labeled summary.
 *
 * Those orders have no `<mvr_license>` or `<mvr_violation>` tags, so the old
 * parser stored a license number and an empty record. Re-parse `result_xml`
 * and write the license, violations, accidents, medical card, and parsed_data.
 * Order status is left alone.
 *
 * Dry run (default):  npx tsx scripts/backfill-nj-mvr-summary.ts
 * Apply:              npx tsx scripts/backfill-nj-mvr-summary.ts --apply
 */
import { readFileSync } from 'node:fs'
import { mvrResultToJsonb, parseAccioMvrResult } from '../src/lib/accio-xml-parser'

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
  Prefer: 'return=minimal',
}

function ymdToIso(value: string | undefined): string | null {
  if (!value || value.length !== 8) return null
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

async function rest(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${BASE}/${path}`, { ...init, headers: HEADERS })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`)
}

async function main() {
  const listRes = await fetch(
    `${BASE}/mvr_orders?result_xml=ilike.*NEW JERSEY MOTOR VEHICLE RECORD*&select=id,driver_user_id,ordered_by_company_id,result_xml`,
    { headers: HEADERS },
  )
  if (!listRes.ok) throw new Error(`list orders → ${listRes.status} ${await listRes.text()}`)
  const orders = (await listRes.json()) as Array<{
    id: string
    driver_user_id: string | null
    ordered_by_company_id: string | null
    result_xml: string
  }>

  console.log(`[NJ MVR] ${orders.length} summary orders${APPLY ? '' : ' (dry run)'}`)

  for (const order of orders) {
    const parsed = parseAccioMvrResult(order.result_xml)
    const license = parsed.licenses?.[0]
    const line = [
      order.id,
      license?.class ? `class ${license.class}` : 'no class',
      `${parsed.violationCount ?? 0} violations`,
      `${parsed.accidentCount ?? 0} accidents`,
      parsed.medicalCertStatus ? 'medical' : 'no medical',
    ].join(' · ')
    console.log(`  ${line}`)
    if (!APPLY) continue

    await rest(`mvr_results?mvr_order_id=eq.${order.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        license_class: license?.class ?? null,
        license_status: license?.status ?? null,
        license_issue_date: ymdToIso(license?.issueDate),
        license_expiration_date: ymdToIso(license?.expirationDate ?? parsed.licenseExpirationDate),
        violation_count: parsed.violationCount ?? 0,
        violations: parsed.violations ?? [],
        accident_count: parsed.accidentCount ?? 0,
        accidents: parsed.accidents ?? [],
        suspension_count: parsed.suspensionCount ?? 0,
        suspensions: parsed.suspensions ?? [],
        medical_cert_status: parsed.medicalCertStatus ?? null,
        medical_cert_expiration: ymdToIso(parsed.medicalCertExpiration),
        cdl_endorsements: license?.endorsements ? [license.endorsements] : [],
        cdl_restrictions: license?.restrictions ? [license.restrictions] : [],
        parsed_data: mvrResultToJsonb(parsed),
        parsed_at: new Date().toISOString(),
      }),
    })

    if (order.driver_user_id && !order.ordered_by_company_id) {
      await rest(`block_driver_mvr?user_id=eq.${order.driver_user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          license_status: license?.status ?? null,
          total_points: parsed.totalPoints ?? 0,
          violation_count: parsed.violationCount ?? 0,
          violations: parsed.violations ?? [],
          accidents: (parsed.accidents ?? []).map((accident) => ({
            date: accident.date ?? '',
            description: accident.description ?? '',
          })),
        }),
      })
    }
  }

  if (!APPLY) console.log('[NJ MVR] Dry run only — re-run with --apply to write.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
