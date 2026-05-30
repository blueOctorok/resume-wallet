/**
 * T1.9 — Backfill auth.users rows for existing public.users.
 *
 * Preserves users.id as auth.users.id so all block_* / hub data stays attached.
 *
 * Usage:
 *   npm run backfill:auth-users -- --dry-run   # safe — counts only (default)
 *   npm run backfill:auth-users -- --execute   # wet run — creates missing auth rows
 */

import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

type UserRow = { id: string; email: string | null }
type ProfileRow = { user_id: string; email: string | null }

type EffectiveUser = { id: string; effEmail: string }

type CollisionGroup = {
  email: string
  userIds: string[]
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function effectiveEmail(user: UserRow, profileEmail: string | null | undefined): string | null {
  const fromUser = trimOrNull(user.email)
  const fromProfile = trimOrNull(profileEmail)
  return (fromUser ?? fromProfile)?.toLowerCase() ?? null
}

async function loadEffectiveUsers(
  supabase: SupabaseClient,
): Promise<{ withEmail: EffectiveUser[]; noEmailCount: number; totalUsers: number }> {
  const [{ data: users, error: usersError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from('users').select('id, email'),
      supabase.from('user_profiles').select('user_id, email'),
    ])

  if (usersError) throw new Error(`Failed to load users: ${usersError.message}`)
  if (profilesError) throw new Error(`Failed to load user_profiles: ${profilesError.message}`)

  const profileEmailByUserId = new Map<string, string | null>()
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    profileEmailByUserId.set(profile.user_id, profile.email)
  }

  const withEmail: EffectiveUser[] = []
  let noEmailCount = 0

  for (const user of (users ?? []) as UserRow[]) {
    const eff = effectiveEmail(user, profileEmailByUserId.get(user.id))
    if (!eff) {
      noEmailCount += 1
      continue
    }
    withEmail.push({ id: user.id, effEmail: eff })
  }

  return { withEmail, noEmailCount, totalUsers: (users ?? []).length }
}

function partitionByEmail(withEmail: EffectiveUser[]): {
  migratable: EffectiveUser[]
  collisions: CollisionGroup[]
  collisionUserCount: number
} {
  const byEmail = new Map<string, string[]>()

  for (const row of withEmail) {
    const ids = byEmail.get(row.effEmail) ?? []
    ids.push(row.id)
    byEmail.set(row.effEmail, ids)
  }

  const migratable: EffectiveUser[] = []
  const collisions: CollisionGroup[] = []
  let collisionUserCount = 0

  for (const row of withEmail) {
    const ids = byEmail.get(row.effEmail) ?? []
    if (ids.length > 1) {
      collisionUserCount += 1
      continue
    }
    migratable.push(row)
  }

  for (const [email, userIds] of byEmail.entries()) {
    if (userIds.length > 1) {
      collisions.push({ email, userIds })
    }
  }

  collisions.sort((a, b) => a.email.localeCompare(b.email))

  return { migratable, collisions, collisionUserCount }
}

async function authUserExists(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    // Supabase returns an error when the id is not found.
    return false
  }
  return Boolean(data.user)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run') || !args.includes('--execute')

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

  console.log(`[BACKFILL AUTH] mode=${dryRun ? 'DRY RUN' : 'EXECUTE'}`)

  const { withEmail, noEmailCount, totalUsers } = await loadEffectiveUsers(supabase)
  const { migratable, collisions, collisionUserCount } = partitionByEmail(withEmail)

  let wouldCreate = 0
  let alreadyExists = 0
  let created = 0
  let errors = 0

  for (const user of migratable) {
    const exists = await authUserExists(supabase, user.id)

    if (exists) {
      alreadyExists += 1
      console.log(`[SKIP exists] ${user.id} ${user.effEmail}`)
      continue
    }

    if (dryRun) {
      wouldCreate += 1
      console.log(`[DRY RUN would create] ${user.id} ${user.effEmail}`)
      continue
    }

    const { data, error } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.effEmail,
      email_confirm: false,
      user_metadata: { migrated_from: 'wallet' },
    })

    if (error) {
      errors += 1
      console.error(`[ERROR] ${user.id} ${user.effEmail}: ${error.message}`)
      continue
    }

    created += 1
    console.log(`[CREATED] ${data.user?.id ?? user.id} ${user.effEmail}`)
  }

  console.log('\n[BACKFILL AUTH] Summary')
  console.log(`  total public.users:     ${totalUsers}`)
  console.log(`  with effective email:   ${withEmail.length}`)
  console.log(`  skipped no-email:       ${noEmailCount}`)
  console.log(`  collision emails:       ${collisions.length}`)
  console.log(`  skipped collisions:     ${collisionUserCount} users`)
  console.log(`  migratable (unique):    ${migratable.length}`)
  console.log(`  already exists:         ${alreadyExists}`)
  if (dryRun) {
    console.log(`  would create:           ${wouldCreate}`)
  } else {
    console.log(`  created:                ${created}`)
    console.log(`  errors:                 ${errors}`)
  }

  if (collisions.length > 0) {
    console.log('\n[BACKFILL AUTH] Collision list (manual merge required):')
    for (const group of collisions) {
      console.log(`  ${group.email} → ${group.userIds.join(', ')}`)
    }
  }

  if (errors > 0) process.exit(1)
}

main().catch((err) => {
  console.error('[BACKFILL AUTH] Fatal:', err)
  process.exit(1)
})
