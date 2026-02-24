// app/api/resumes/[id]/visibility/route.ts
// Toggle public/private visibility for a resume

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const walletAddress = req.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { isPublic } = body

    if (typeof isPublic !== 'boolean') {
      return NextResponse.json(
        { error: 'isPublic must be a boolean' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user (case-insensitive)
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify ownership before updating
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id, user_id, is_public')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (resumeError || !resume) {
      return NextResponse.json({ error: 'Resume not found or access denied' }, { status: 404 })
    }

    // Update visibility
    const { data: updated, error: updateError } = await supabase
      .from('resumes')
      .update({ 
        is_public: isPublic
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, is_public')
      .single()

    if (updateError) {
      console.error('❌ Resume API: Error updating visibility', updateError)
      return NextResponse.json(
        { error: 'Failed to update visibility' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      isPublic: updated.is_public,
      message: `Resume is now ${updated.is_public ? 'public' : 'private'}` 
    })
  } catch (error) {
    console.error('❌ Resume API: Error updating visibility', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
