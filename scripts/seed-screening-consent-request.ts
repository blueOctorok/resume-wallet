/**
 * Dev helper — create a pending employer → candidate screening consent request
 * so you can walk through the P3.4-C driver-owned order flow locally.
 *
 * Usage:
 *   npx tsx scripts/seed-screening-consent-request.ts \
 *     --employer-email you@employer.com \
 *     --candidate-email driver@example.com
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1 || !process.argv[idx + 1]) return null
  return process.argv[idx + 1]
}

async function main() {
  const employerEmail = arg('employer-email')
  const candidateEmail = arg('candidate-email')
  if (!employerEmail || !candidateEmail) {
    console.error(
      'Usage: npx tsx scripts/seed-screening-consent-request.ts --employer-email E --candidate-email C',
    )
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const resolveUserId = async (email: string) => {
    const { data: user } = await supabase.from('users').select('id, email').ilike('email', email).maybeSingle()
    if (user?.id) return user.id as string
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id, email')
      .ilike('email', email)
      .maybeSingle()
    return (profile?.user_id as string | undefined) ?? null
  }

  const employerUserId = await resolveUserId(employerEmail)
  const candidateUserId = await resolveUserId(candidateEmail)
  if (!employerUserId) {
    console.error(`Employer not found: ${employerEmail}`)
    process.exit(1)
  }
  if (!candidateUserId) {
    console.error(`Candidate not found: ${candidateEmail}`)
    process.exit(1)
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', employerUserId)
    .eq('is_active', true)
    .maybeSingle()

  let companyId = membership?.company_id as string | undefined
  if (!companyId) {
    const { data: legacy } = await supabase
      .from('companies')
      .select('id')
      .eq('employer_user_id', employerUserId)
      .maybeSingle()
    companyId = legacy?.id as string | undefined
  }
  if (!companyId) {
    console.error('Employer has no company — complete employer onboarding first.')
    process.exit(1)
  }

  const { data: existing } = await supabase
    .from('candidate_requests')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('candidate_user_id', candidateUserId)
    .in('status', ['pending', 'viewed'])
    .or(
      'request_type.eq.mvr_order,request_type.eq.psp_order,and(request_type.eq.block_request,target_block_type.eq.driver-screening-consent)',
    )
    .maybeSingle()

  if (existing) {
    console.log(`Pending screening request already exists: ${existing.id} (${existing.status})`)
    console.log('Candidate hub → Screening consent block, or /?onboard=screening-consent')
    return
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 14)

  const { data: req, error: reqErr } = await supabase
    .from('candidate_requests')
    .insert({
      company_id: companyId,
      requested_by_user_id: employerUserId,
      candidate_user_id: candidateUserId,
      request_type: 'block_request',
      target_block_type: 'driver-screening-consent',
      message: 'Seeded for P3.4-C driver-owned screening test',
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (reqErr || !req) {
    console.error('Failed to create request:', reqErr)
    process.exit(1)
  }

  const { data: hubBlock } = await supabase
    .from('hub_blocks')
    .select('id')
    .eq('user_id', candidateUserId)
    .eq('block_type', 'driver-screening-consent')
    .maybeSingle()

  if (!hubBlock) {
    const { data: maxPos } = await supabase
      .from('hub_blocks')
      .select('position')
      .eq('user_id', candidateUserId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    await supabase.from('hub_blocks').insert({
      user_id: candidateUserId,
      block_type: 'driver-screening-consent',
      position: (maxPos?.position ?? -1) + 1,
    })
    console.log('Installed driver-screening-consent block on candidate hub')
  }

  console.log('\n✅ Seeded screening consent request')
  console.log(`   requestId: ${req.id}`)
  console.log(`   companyId: ${companyId}`)
  console.log(`   candidate: ${candidateUserId}`)
  console.log('\nNext: sign in as the candidate → Hub → Screening consent (or ?onboard=screening-consent)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
