import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get application ID from token
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('share_token', token)
      .single()

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Get viewer info from request
    const viewerIp = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown'
    const viewerUserAgent = request.headers.get('user-agent') || 'unknown'

    // Create view record (this will auto-increment view count via trigger)
    const { error: viewError } = await supabase
      .from('application_views')
      .insert({
        application_id: application.id,
        viewer_ip: viewerIp,
        viewer_user_agent: viewerUserAgent
      })

    if (viewError) {
      console.error('[TRACK VIEW] Error creating view record:', viewError)
      // Don't fail the request if view tracking fails
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[TRACK VIEW] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

