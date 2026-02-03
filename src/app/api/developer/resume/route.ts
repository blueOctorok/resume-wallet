import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/developer/resume
 * Create a new developer resume
 *
 * PUT /api/developer/resume
 * Update an existing developer resume
 */

export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { structuredData, title } = body

    if (!structuredData) {
      return NextResponse.json(
        { error: 'Structured data is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create new resume
    const { data: resume, error: createError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        title: title || 'Developer Resume',
        filename: `${structuredData.personalInfo?.firstName || 'Developer'}_${structuredData.personalInfo?.lastName || 'Resume'}.pdf`,
        resume_type: 'developer_built',
        structured_data: structuredData,
        ipfs_hash: 'pending', // Will be set during verification
        verification_status: 'PENDING',
      })
      .select('id')
      .single()

    if (createError) {
      console.error('[DEVELOPER RESUME] Create error:', createError)
      return NextResponse.json(
        { error: 'Failed to create resume' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      resumeId: resume.id,
      message: 'Resume created successfully',
    })
  } catch (error) {
    console.error('[DEVELOPER RESUME] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { resumeId, structuredData, title } = body

    if (!resumeId || !structuredData) {
      return NextResponse.json(
        { error: 'Resume ID and structured data are required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify ownership
    const { data: existing, error: checkError } = await supabase
      .from('resumes')
      .select('id, user_id')
      .eq('id', resumeId)
      .single()

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update resume
    const updateData: Record<string, unknown> = {
      structured_data: structuredData,
      filename: `${structuredData.personalInfo?.firstName || 'Developer'}_${structuredData.personalInfo?.lastName || 'Resume'}.pdf`,
    }

    if (title) {
      updateData.title = title
    }

    const { error: updateError } = await supabase
      .from('resumes')
      .update(updateData)
      .eq('id', resumeId)

    if (updateError) {
      console.error('[DEVELOPER RESUME] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update resume' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      resumeId,
      message: 'Resume updated successfully',
    })
  } catch (error) {
    console.error('[DEVELOPER RESUME] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/developer/resume
 * Get all developer resumes for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get developer resumes
    const { data: resumes, error: resumesError } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .eq('resume_type', 'developer_built')
      .order('created_at', { ascending: false })

    if (resumesError) {
      console.error('[DEVELOPER RESUME] Fetch error:', resumesError)
      return NextResponse.json(
        { error: 'Failed to fetch resumes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      resumes: resumes || [],
    })
  } catch (error) {
    console.error('[DEVELOPER RESUME] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
