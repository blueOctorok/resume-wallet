import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { role, walletAddress } = await request.json();

    // Validate role
    if (!role || !['driver', 'employer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "driver" or "employer".' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if user already has a role (case-insensitive wallet comparison)
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, role')
      .ilike('wallet_address', walletAddress)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Allow role changes (user can switch between driver/employer)
    console.log(`[SET ROLE] User ${existingUser.id} changing role from "${existingUser.role}" to "${role}"`);

    // Update user role
    const { error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', existingUser.id);

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return NextResponse.json(
        { error: 'Failed to update role' },
        { status: 500 }
      );
    }

    // If switching to employer, create a company record if it doesn't exist
    if (role === 'employer') {
      // Check if company already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', existingUser.id)
        .single();

      if (!existingCompany) {
        const { error: companyError } = await supabase
          .from('companies')
          .insert({
            employer_user_id: existingUser.id,
            company_name: 'My Company', // Placeholder, will be updated in profile
          });

        if (companyError) {
          console.error('Error creating company record:', companyError);
          // Don't fail the request, just log the error
          // The employer can still set up their company later
        }
      }
    }

    return NextResponse.json({
      success: true,
      role,
      message: `Role set to ${role} successfully`
    });

  } catch (error) {
    console.error('Error in set-role API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

