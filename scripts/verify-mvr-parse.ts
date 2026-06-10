/**
 * One-off verification: parse a stored MVR order's raw XML with the CURRENT
 * local parser and print the fields that had bugs (June 2026 fixes).
 * Read-only — makes no writes. Run: npx tsx scripts/verify-mvr-parse.ts <orderId>
 */
import { readFileSync } from 'node:fs'
import { parseAccioMvrResult } from '../src/lib/accio-xml-parser'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)

const orderId = process.argv[2]
if (!orderId) throw new Error('Usage: npx tsx scripts/verify-mvr-parse.ts <orderId>')

// Wrapped in main() — tsx treats .ts as CJS here, so no top-level await.
// Uses PostgREST directly (no supabase-js) to avoid the realtime/ws dependency
// in a plain Node script.
async function main() {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/mvr_orders?id=eq.${orderId}&select=id,result_xml`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    },
  )
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as Array<{ id: string; result_xml: string | null }>
  if (!rows[0]?.result_xml) throw new Error('order not found or has no result_xml')

  const p = parseAccioMvrResult(rows[0].result_xml)
  console.log(
    JSON.stringify(
      {
        subject: p.subject
          ? { firstName: p.subject.firstName, lastName: p.subject.lastName, city: p.subject.city }
          : null,
        licenseNumber: p.licenseNumber,
        licenseExpirationDate: p.licenseExpirationDate,
        licenses: p.licenses?.map((l) => ({
          class: l.class,
          classDescription: l.classDescription,
          status: l.status,
          issueDate: l.issueDate,
          expirationDate: l.expirationDate,
          endorsements: l.endorsements,
        })),
        personalCharacteristics: p.personalCharacteristics,
        medical: {
          status: p.medicalCertStatus,
          issue: p.medicalCertIssueDate,
          expiration: p.medicalCertExpiration,
          selfCert: p.medicalCertSelfCertification,
        },
        medicalExaminer: p.medicalExaminer,
        totalPoints: p.totalPoints,
        totalPointsSource: p.totalPointsSource,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
