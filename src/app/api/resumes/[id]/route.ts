// app/api/resumes/[id]/route.ts
// Get, update, or delete a single resume by ID

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const walletAddress = req.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get resume and verify ownership
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (resumeError || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    return NextResponse.json(resume)
  } catch (error) {
    console.error('❌ Resume API: Error fetching resume', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const walletAddress = req.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify ownership before deleting
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id, user_id, title')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (resumeError || !resume) {
      return NextResponse.json({ error: 'Resume not found or access denied' }, { status: 404 })
    }

    // Delete the resume
    const { error: deleteError } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('❌ Resume API: Error deleting resume', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete resume' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Resume deleted successfully' })
  } catch (error) {
    console.error('❌ Resume API: Error deleting resume', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
