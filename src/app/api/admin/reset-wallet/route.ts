import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { deleteAuthUser } from '@/lib/delete-auth-user'
const ADMIN_API_KEY = process.env.ADMIN_API_KEY

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 })
}

export async function POST(request: NextRequest) {
  if (!ADMIN_API_KEY) {
    return NextResponse.json(
      { error: 'Admin API key is not configured on the server.' },
      { status: 500 }
    )
  }

  const headerKey = request.headers.get('x-admin-key') || request.headers.get('authorization')
  if (!headerKey || headerKey.replace('Bearer ', '').trim() !== ADMIN_API_KEY) {
    return unauthorized('Missing or invalid admin key.')
  }

  let payload: { sessionUserId?: string } = {}
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const sessionUserId = payload.sessionUserId?.trim()
  if (!sessionUserId) {
    return NextResponse.json(
      { error: 'sessionUserId is required.' },
      { status: 400 }
    )
  }

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', sessionUserId)
      .maybeSingle()
    if (!user) {
      return NextResponse.json({
        success: true,
        sessionUserId,
        message: 'No records found for this wallet. Nothing to delete.',
      })
    }

    const userId = user.id

    const { error: resumeError } = await supabase
      .from('resumes')
      .delete()
      .eq('user_id', userId)

    if (resumeError) {
      console.error('❌ [reset-wallet] Failed to delete resumes:', resumeError)
      return NextResponse.json(
        { error: 'Failed to delete resumes for this wallet.' },
        { status: 500 }
      )
    }

    const { error: appError } = await supabase
      .from('driver_applications')
      .delete()
      .eq('user_id', userId)

    if (appError) {
      console.error('❌ [reset-wallet] Failed to delete driver applications:', appError)
      return NextResponse.json(
        { error: 'Failed to delete driver applications for this wallet.' },
        { status: 500 }
      )
    }

    const { error: userDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (userDeleteError) {
      console.error('❌ [reset-wallet] Failed to delete user:', userDeleteError)
      return NextResponse.json(
        { error: 'Failed to delete user record.' },
        { status: 500 }
      )
    }

    const authDelete = await deleteAuthUser(supabase, userId)
    if (!authDelete.ok) {
      console.error('❌ [reset-wallet] Auth delete failed:', authDelete.error)
    }

    return NextResponse.json({
      success: true,
      sessionUserId,
      deleted: {
        resumes: true,
        driverApplications: true,
        user: true,
        auth: authDelete.ok,
      },
      message: 'All wallet-specific application data removed.',
    })
  } catch (error) {
    console.error('❌ [reset-wallet] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Unexpected server error while resetting wallet.' },
      { status: 500 }
    )
  }
}

