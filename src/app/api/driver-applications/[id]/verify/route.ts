import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * POST /api/driver-applications/[id]/verify
 * Mark a complete DOT application as verified (DB flag until Phase 2 attestation).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.log('[DOT VERIFY] Verifying application:', id, 'for user:', userId)

    const supabase = await getAdminSupabaseClient()

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: application, error: appError } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userData.id)
      .single()

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (
      application.verification_status === 'VERIFIED' ||
      application.blockchain_tx_hash
    ) {
      return NextResponse.json(
        {
          error: 'Application already verified',
          details: 'This application has already been marked verified.',
          transactionHash: application.blockchain_tx_hash,
          applicationId: application.blockchain_application_id,
        },
        { status: 409 },
      )
    }

    if (!application.is_complete) {
      return NextResponse.json(
        {
          error: 'Application not complete',
          details: 'Please complete the application before verifying.',
        },
        { status: 400 },
      )
    }

    if (!application.application_hash) {
      return NextResponse.json(
        {
          error: 'Missing application hash',
          details: 'Application hash is required for verification.',
        },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase
      .from('driver_applications')
      .update({
        verification_status: 'VERIFIED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[DOT VERIFY] Failed to update database:', updateError)
      return NextResponse.json(
        { error: 'Failed to update verification status' },
        { status: 500 },
      )
    }

    console.log('[DOT VERIFY] Verification complete (DB flag, no on-chain registry)')

    return NextResponse.json({
      success: true,
      verified: true,
      applicationId: id,
    })
  } catch (error: unknown) {
    console.error('[DOT VERIFY] Error:', error)
    return NextResponse.json(
      {
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 },
    )
  }
}
