import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/talent/[userId]/dot-app
 *
 * Returns the full DOT application data for a candidate, structured
 * as { form1, form2, form3 } so the employer can preview the complete
 * application — the same data the driver filled out.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { userId } = await params

    // Verify the requester is either an employer OR the driver themselves
    const { data: requester } = await supabase
      .from('users')
      .select('id, role')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!requester) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isEmployer = requester.role === 'employer'
    const isSelf = requester.id === userId

    if (!isEmployer && !isSelf) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const applicationId = request.nextUrl.searchParams.get('applicationId')

    let appQuery = supabase
      .from('driver_applications')
      .select('id, is_complete, current_step, application_data, created_at, updated_at')
      .eq('user_id', userId)

    if (applicationId) {
      appQuery = appQuery.eq('id', applicationId)
    } else {
      appQuery = appQuery.order('created_at', { ascending: false }).limit(1)
    }

    const { data: app, error } = await appQuery.maybeSingle()

    if (error) {
      console.error('[DOT APP PREVIEW] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch DOT application' }, { status: 500 })
    }

    if (!app) {
      return NextResponse.json({ error: 'No DOT application found' }, { status: 404 })
    }

    return NextResponse.json({
      id:          app.id,
      isComplete:  app.is_complete,
      currentStep: app.current_step,
      createdAt:   app.created_at,
      updatedAt:   app.updated_at,
      // Raw form data — typed as DotForm1/2/3 on the client
      form1: (app.application_data as Record<string, unknown>)?.form1 ?? null,
      form2: (app.application_data as Record<string, unknown>)?.form2 ?? null,
      form3: (app.application_data as Record<string, unknown>)?.form3 ?? null,
    })
  } catch (err) {
    console.error('[DOT APP PREVIEW] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
