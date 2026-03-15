import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * POST /api/user/avatar
 *
 * Role-agnostic avatar upload. Writes to user_profiles.avatar_url.
 * Accepts multipart/form-data with a 'file' field.
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be under 5 MB' }, { status: 400 })
    }

    const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
    const storagePath = `user/${user.id}.${ext}`
    const bytes = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('[USER AVATAR] Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(storagePath)

    const avatarUrl = `${publicUrl}?t=${Date.now()}`

    // Upsert into user_profiles so avatars work even if the row doesn't exist yet
    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('[USER AVATAR] Profile upsert error:', upsertError)
      return NextResponse.json({ error: 'Failed to save avatar URL' }, { status: 500 })
    }

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    console.error('[USER AVATAR] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
