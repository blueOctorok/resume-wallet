import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/career-card/connect
 *
 * Creates a connection lead when someone views a public career card
 * and wants to reach out. Looks up the candidate by their unified
 * share token on the users table.
 *
 * Body: { token, name, email, phone, company, notes, source }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, name, email, phone, company, notes, source = 'career_card' } = body

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Look up candidate by share token
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('share_token', token)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Create a lead in driver_leads (table works for all candidates, not just drivers)
    const { error: insertError } = await supabase
      .from('driver_leads')
      .insert({
        driver_user_id: user.id,
        employer_name: name ?? null,
        employer_email: email ?? null,
        employer_phone: phone ?? null,
        employer_company_name: company ?? null,
        notes: notes ?? null,
        event_name: null,
        source,
      })

    if (insertError) {
      console.error('[CAREER CARD CONNECT] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CAREER CARD CONNECT] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
