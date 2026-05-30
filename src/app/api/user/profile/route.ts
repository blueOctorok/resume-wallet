import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { isSupabaseNetworkError } from '@/lib/supabase-errors'

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const supabase = await getAdminSupabaseClient();
    console.log('[PROFILE API] Fetching user with wallet:', walletAddress);

    let profile: { id: string; wallet_address?: string; email?: string | null; role?: string | null; created_at?: string } | null = null;
    try {
      profile = await getUserByWallet(supabase, walletAddress);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isSupabaseNetworkError(message)) {
        console.warn('[PROFILE API] Supabase unreachable:', message);
        return NextResponse.json(
          {
            error: 'Could not reach database',
            hint: 'Check NEXT_PUBLIC_SUPABASE_URL, network/VPN, and that Supabase is up. On Windows, IPv6/DNS issues sometimes cause fetch failed.',
          },
          { status: 503 },
        );
      }
      if (message.includes('column') && message.includes('role')) {
        return NextResponse.json(
          {
            error: 'Database migration required',
            details: 'The "role" column does not exist. Please run the migration: database_migrations/002_add_role_and_companies.sql',
          },
          { status: 500 }
        );
      }
      console.error('[PROFILE API] Error fetching user profile:', err);
      return NextResponse.json(
        { error: 'Failed to fetch profile', details: message },
        { status: 500 }
      );
    }

    if (!profile) {
      console.error('[PROFILE API] User not found for wallet:', walletAddress);
      return NextResponse.json(
        {
          error: 'User not found',
          details: `No user record found for wallet address: ${walletAddress}. User may need to sign in first.`,
        },
        { status: 404 }
      );
    }

    console.log('[PROFILE API] User found:', profile.id, 'Role:', profile.role);

    // If employer, fetch company data (via ownership or team membership)
    let company = null;
    if (profile?.role === 'employer') {
      // Check direct ownership first
      const { data: ownedCompany, error: ownerError } = await supabase
        .from('companies')
        .select('*')
        .eq('employer_user_id', profile.id)
        .maybeSingle();

      if (!ownerError && ownedCompany) {
        company = ownedCompany;
        console.log('[PROFILE API] Found owned company:', ownedCompany.company_name);
      } else {
        // Fall back to team membership (invited members)
        const { data: membership } = await supabase
          .from('company_members')
          .select('company_id, companies(*)')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .maybeSingle();

        if (membership?.companies) {
          company = membership.companies;
          console.log('[PROFILE API] Found company via membership:', (membership.companies as { company_name?: string }).company_name);
        } else {
          // No company found — hub will show "complete setup" state
          console.log('[PROFILE API] No company found for employer:', profile.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        company
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (isNetworkError(message)) {
      console.warn('[PROFILE API] Network error:', message);
      return NextResponse.json({ error: 'Could not reach database' }, { status: 503 });
    }
    console.error('[PROFILE API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile
 *
 * Partial updates on `users` for the authenticated caller.
 * Auth: Supabase session cookie (falls back to x-wallet-address until T1.12).
 * Body (any combination):
 *   - `walkthrough_dismissed: boolean` → `stormi_walkthrough_dismissed_at`
 *   - `ui_mode_preference: 'simple' | 'hub'` → `ui_mode_preference`
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as {
      walkthrough_dismissed?: unknown
      ui_mode_preference?: unknown
    }

    const updates: Record<string, unknown> = {}

    if (body.walkthrough_dismissed !== undefined) {
      if (typeof body.walkthrough_dismissed !== 'boolean') {
        return NextResponse.json(
          { error: 'walkthrough_dismissed must be a boolean' },
          { status: 400 },
        )
      }
      updates.stormi_walkthrough_dismissed_at = body.walkthrough_dismissed
        ? new Date().toISOString()
        : null
    }

    if (body.ui_mode_preference !== undefined) {
      if (body.ui_mode_preference !== 'simple' && body.ui_mode_preference !== 'hub') {
        return NextResponse.json(
          { error: "ui_mode_preference must be 'simple' or 'hub'" },
          { status: 400 },
        )
      }
      updates.ui_mode_preference = body.ui_mode_preference
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'At least one supported field is required' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()
    const { error } = await supabase.from('users').update(updates).eq('id', userId)

    if (error) {
      console.error('[PROFILE PATCH] Update error:', error)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ...(body.walkthrough_dismissed !== undefined && {
        walkthroughDismissed: body.walkthrough_dismissed,
      }),
      ...(body.ui_mode_preference !== undefined && {
        uiModePreference: body.ui_mode_preference,
      }),
    })
  } catch (error) {
    console.error('[PROFILE PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function isNetworkError(message: string): boolean {
  return /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|network/i.test(message)
}
