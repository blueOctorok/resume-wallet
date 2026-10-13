import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { researchEmployerContact } from '@/lib/evr-contact-research'

/**
 * POST /api/candidate/verification/[id]/research-contact
 *
 * Look up the previous employer's contact via FMCSA + web search and store
 * the candidates on the packet. Proposes only — the driver confirms a
 * contact through /set-contact before anything is sent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { id } = await params
    const supabase = await getAdminSupabaseClient()

    const { data: row } = await supabase
      .from('employment_verification_requests')
      .select('id, status')
      .eq('id', id)
      .eq('driver_id', userId)
      .maybeSingle()
    if (!row) {
      return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
    }
    if (!['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'].includes(String(row.status))) {
      return NextResponse.json({ error: 'This packet is closed.' }, { status: 409 })
    }

    const research = await researchEmployerContact(supabase, id)
    return NextResponse.json({ success: true, research })
  } catch (error) {
    console.error('[EVR RESEARCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
