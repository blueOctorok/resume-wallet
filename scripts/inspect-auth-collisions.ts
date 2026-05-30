/**
 * Read-only inspector for T1.9 duplicate-email collision groups.
 * Helps decide which users.id to keep before auth.users backfill.
 *
 * Usage: npm run inspect:collisions
 */

import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const COLLISION_GROUPS: { email: string; userIds: [string, string] }[] = [
  {
    email: 'dallasnash24@gmail.com',
    userIds: [
      '7dac4f73-f26c-4bb2-a595-f88bfe215950',
      '98c880fa-b297-42cd-9b63-0c8c2ef8b861',
    ],
  },
  {
    email: 'metro@pacedrivers.com',
    userIds: [
      '4bf4349b-edee-4640-9a6e-345016c33fe2',
      '707b17c1-e201-4c86-ae48-3b3dfff348ef',
    ],
  },
  {
    email: 'zaebrown444@gmail.com',
    userIds: [
      'fd1ba1f6-201a-4801-acbf-4eaa4c296a30',
      '397b9f1b-e09e-4b78-861e-2f904cd5011e',
    ],
  },
]

type UserRow = {
  id: string
  created_at: string | null
  role: string | null
  wallet_address: string | null
  email: string | null
}

type ProfileRow = {
  first_name: string | null
  last_name: string | null
  email: string | null
}

type ActivityCounts = {
  ownsCompany: number
  teamMembership: number
  applications: number
  driverApps: number
  resumes: number
  mvrOrders: number
  pspOrders: number
  hubBlocks: number
}

type UserSnapshot = {
  userId: string
  user: UserRow | null
  profile: ProfileRow | null
  counts: ActivityCounts
  totalActivity: number
}

async function countWhere(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
  extra?: { column: string; op: 'not.is' | 'is'; value: null },
): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq(column, value)

  if (extra?.op === 'not.is') {
    query = query.not(extra.column, 'is', extra.value)
  } else if (extra?.op === 'is') {
    query = query.is(extra.column, extra.value)
  }

  const { count, error } = await query
  if (error) throw new Error(`${table}.${column} count failed: ${error.message}`)
  return count ?? 0
}

async function loadUserSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSnapshot> {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, created_at, role, wallet_address, email')
    .eq('id', userId)
    .maybeSingle()

  if (userError) throw new Error(`users lookup failed for ${userId}: ${userError.message}`)

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, email')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    throw new Error(`user_profiles lookup failed for ${userId}: ${profileError.message}`)
  }

  const [
    ownsCompany,
    teamMembership,
    applications,
    driverApps,
    resumes,
    mvrOrders,
    pspOrders,
    hubBlocks,
  ] = await Promise.all([
    countWhere(supabase, 'companies', 'employer_user_id', userId),
    countWhere(supabase, 'company_members', 'user_id', userId, {
      column: 'accepted_at',
      op: 'not.is',
      value: null,
    }),
    countWhere(supabase, 'applications', 'applicant_user_id', userId),
    countWhere(supabase, 'driver_applications', 'user_id', userId),
    countWhere(supabase, 'resumes', 'user_id', userId),
    countWhere(supabase, 'mvr_orders', 'driver_user_id', userId),
    countWhere(supabase, 'psp_orders', 'driver_user_id', userId),
    countWhere(supabase, 'hub_blocks', 'user_id', userId),
  ])

  const counts: ActivityCounts = {
    ownsCompany,
    teamMembership,
    applications,
    driverApps,
    resumes,
    mvrOrders,
    pspOrders,
    hubBlocks,
  }

  const totalActivity =
    ownsCompany +
    teamMembership +
    applications +
    driverApps +
    resumes +
    mvrOrders +
    pspOrders +
    hubBlocks

  return {
    userId,
    user: user as UserRow | null,
    profile: profile as ProfileRow | null,
    counts,
    totalActivity,
  }
}

function formatProfile(profile: ProfileRow | null): string {
  if (!profile) return '(none)'
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  const parts = [name || '(no name)', profile.email ?? '(no email)'].filter(Boolean)
  return parts.join(' · ')
}

function printSnapshot(label: string, snapshot: UserSnapshot): void {
  const u = snapshot.user
  console.log(`  ${label}: ${snapshot.userId}`)
  console.log(`    created_at:       ${u?.created_at ?? '(missing user row)'}`)
  console.log(`    role:             ${u?.role ?? '(null)'}`)
  console.log(`    wallet_address:   ${u?.wallet_address ?? '(null)'}`)
  console.log(`    users.email:      ${u?.email ?? '(null)'}`)
  console.log(`    profile:          ${formatProfile(snapshot.profile)}`)
  console.log(`    owns company:     ${snapshot.counts.ownsCompany}`)
  console.log(`    team membership:  ${snapshot.counts.teamMembership}`)
  console.log(`    applications:     ${snapshot.counts.applications}`)
  console.log(`    driver apps:      ${snapshot.counts.driverApps}`)
  console.log(`    resumes:          ${snapshot.counts.resumes}`)
  console.log(`    MVR orders:       ${snapshot.counts.mvrOrders}`)
  console.log(`    PSP orders:       ${snapshot.counts.pspOrders}`)
  console.log(`    hub blocks:       ${snapshot.counts.hubBlocks}`)
  console.log(`    total activity:   ${snapshot.totalActivity}`)
}

function suggestKeep(a: UserSnapshot, b: UserSnapshot): string {
  if (a.totalActivity !== b.totalActivity) {
    return a.totalActivity > b.totalActivity ? a.userId : b.userId
  }

  if (a.counts.ownsCompany !== b.counts.ownsCompany) {
    return a.counts.ownsCompany > b.counts.ownsCompany ? a.userId : b.userId
  }

  const aCreated = a.user?.created_at ? Date.parse(a.user.created_at) : Number.POSITIVE_INFINITY
  const bCreated = b.user?.created_at ? Date.parse(b.user.created_at) : Number.POSITIVE_INFINITY
  return aCreated <= bCreated ? a.userId : b.userId
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
    )
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('[INSPECT COLLISIONS] read-only · no writes\n')

  for (const group of COLLISION_GROUPS) {
    console.log('='.repeat(72))
    console.log(`COLLISION: ${group.email}`)
    console.log('='.repeat(72))

    const [snapA, snapB] = await Promise.all([
      loadUserSnapshot(supabase, group.userIds[0]),
      loadUserSnapshot(supabase, group.userIds[1]),
    ])

    printSnapshot('User A', snapA)
    console.log('')
    printSnapshot('User B', snapB)
    console.log('')
    console.log(`→ suggest keep: ${suggestKeep(snapA, snapB)}`)
    console.log('')
  }
}

main().catch((err) => {
  console.error('[INSPECT COLLISIONS] Fatal:', err)
  process.exit(1)
})
