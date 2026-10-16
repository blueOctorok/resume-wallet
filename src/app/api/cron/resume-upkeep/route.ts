import { NextRequest, NextResponse } from 'next/server'
import { runDriverKeepCurrent } from '@/lib/driver-keep-current'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorizeCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if (!secret) {
    console.error('[CRON RESUME UPKEEP] Set CRON_SECRET or INTERNAL_API_SECRET')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  const headerSecret = request.headers.get('x-internal-secret')
  if (bearer === secret || headerSecret === secret) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Daily. Tells a driver their resume is on the career card, and tells them
 * when a CDL date on that resume has passed. Each notice is sent once.
 */
async function run(request: NextRequest) {
  const denied = authorizeCron(request)
  if (denied) return denied

  try {
    const supabase = await getAdminSupabaseClient()
    const result = await runDriverKeepCurrent(supabase)
    return NextResponse.json({ ok: true, ...result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CRON RESUME UPKEEP]', error)
    return NextResponse.json({ error: 'Resume upkeep failed', details: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return run(request)
}

export async function POST(request: NextRequest) {
  return run(request)
}
