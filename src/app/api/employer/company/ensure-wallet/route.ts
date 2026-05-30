import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  persistCompanyWalletIfMissing,
  syncCoOwnersAfterWalletCreation,
} from '@/lib/persist-company-wallet'

/**
 * POST /api/employer/company/ensure-wallet
 *
 * Idempotent: creates the company's MultiOwnerLightAccount address if missing.
 * Caller must be owner or admin. Uses the caller's smart wallet as an initial co-owner
 * (alongside the service signer); on-chain add/remove for other members is handled elsewhere.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id
    let role = membership?.role

    if (!companyId) {
      const { data: legacy } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .maybeSingle()
      companyId = legacy?.id
      role = 'owner'
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    if (!['owner', 'admin'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: company, error: coErr } = await supabase
      .from('companies')
      .select('id, wallet_address, employer_user_id')
      .eq('id', companyId)
      .single()

    if (coErr || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (company.wallet_address) {
      return NextResponse.json({
        success: true,
        walletAddress: company.wallet_address,
        alreadyExisted: true,
      })
    }

    const { data: ownerUser } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', company.employer_user_id)
      .maybeSingle()

    if (!ownerUser?.wallet_address) {
      return NextResponse.json(
        { error: 'Company owner wallet not found; cannot derive shared wallet' },
        { status: 400 }
      )
    }

    const result = await persistCompanyWalletIfMissing(
      supabase,
      company.id,
      ownerUser.wallet_address
    )

    if (!result) {
      return NextResponse.json(
        {
          error: 'Company wallet could not be created',
          details:
            'Check COMPANY_WALLET_SERVICE_PRIVATE_KEY and Alchemy API key in server env.',
        },
        { status: 503 }
      )
    }

    if (result.created) {
      await syncCoOwnersAfterWalletCreation(
        supabase,
        company.id,
        result.walletAddress,
        company.employer_user_id
      )
    }

    return NextResponse.json({
      success: true,
      walletAddress: result.walletAddress,
      alreadyExisted: !result.created,
    })
  } catch (error) {
    console.error('[ENSURE COMPANY WALLET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
