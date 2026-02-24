import { NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/utils/supabase/admin';
import { getUserByWallet } from '@/lib/user-by-wallet';

function isNetworkError(msg: string | undefined): boolean {
  const m = (msg ?? '').toLowerCase();
  return msg === 'fetch failed' || m.includes('econnrefused') || m.includes('enotfound') || m.includes('etimedout') || m.includes('network');
}

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
      if (isNetworkError(message)) {
        console.warn('[PROFILE API] Network error:', message);
        return NextResponse.json({ error: 'Could not reach database' }, { status: 503 });
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

