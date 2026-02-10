import { NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/utils/supabase/admin';

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

    // Use admin client to bypass RLS (we validate wallet address server-side)
    const supabase = await getAdminSupabaseClient();

    // Fetch user profile by wallet address (case-insensitive)
    console.log('[PROFILE API] Fetching user with wallet:', walletAddress);
    
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, wallet_address, email, role, created_at')
      .ilike('wallet_address', walletAddress)
      .single();

    if (profileError) {
      if (isNetworkError(profileError.message)) {
        console.warn('[PROFILE API] Network error:', profileError.message);
        return NextResponse.json({ error: 'Could not reach database' }, { status: 503 });
      }
      console.error('[PROFILE API] Error fetching user profile:', profileError);
      
      // Check if it's a "column does not exist" error (migration not run)
      if (profileError.message?.includes('column') && profileError.message?.includes('role')) {
        return NextResponse.json(
          { 
            error: 'Database migration required',
            details: 'The "role" column does not exist. Please run the migration: database_migrations/002_add_role_and_companies.sql'
          },
          { status: 500 }
        );
      }
      
      // Check if user not found
      if (profileError.code === 'PGRST116') {
        console.error('[PROFILE API] User not found for wallet:', walletAddress);
        return NextResponse.json(
          { 
            error: 'User not found',
            details: `No user record found for wallet address: ${walletAddress}. User may need to sign in first.`
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch profile',
          details: profileError.message,
          code: profileError.code
        },
        { status: 500 }
      );
    }

    console.log('[PROFILE API] User found:', profile.id, 'Role:', profile.role);

    // If employer, fetch or create company data
    let company = null;
    if (profile?.role === 'employer') {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('employer_user_id', profile.id)
        .single();

      if (companyError && companyError.code === 'PGRST116') {
        // No company record exists - create one
        console.log('[PROFILE API] No company record found for employer - creating one');
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert({
            employer_user_id: profile.id,
            company_name: 'My Company', // Placeholder
          })
          .select()
          .single();

        if (!createError && newCompany) {
          company = newCompany;
          console.log('[PROFILE API] Created company record:', newCompany.id);
        } else {
          console.error('[PROFILE API] Failed to create company record:', createError);
        }
      } else if (!companyError && companyData) {
        company = companyData;
        console.log('[PROFILE API] Found existing company:', companyData.company_name);
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

