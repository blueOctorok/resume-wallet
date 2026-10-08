import { NextRequest, NextResponse } from 'next/server'
import { parseAamvaLicense } from '@/lib/aamva-license'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getLicenseScan, saveLicenseScan } from '@/lib/block-data'
import { decodePdf417 } from '@/lib/decode-pdf417'
import { deleteDocument, uploadDocument } from '@/lib/document-storage'
import { presentLicenseScan } from '@/lib/license-scan-view'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const MAX_BYTES = 8 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const supabase = await getAdminSupabaseClient()
    const scan = await presentLicenseScan(supabase, userId)
    return NextResponse.json({ scan })
  } catch (error) {
    console.error('[LICENSE] GET failed:', error)
    return NextResponse.json({ error: 'Could not load the license on file' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const form = await request.formData()
    const side = form.get('side')
    const file = form.get('file')
    if (side !== 'front' && side !== 'back') {
      return NextResponse.json({ error: 'Choose the front or the back of the license' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A photo of the license is required' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'That photo is over 8 MB. Take it again a little farther back.' }, { status: 400 })
    }

    const mime = normalizeMime(file)
    if (!mime) {
      return NextResponse.json({ error: 'Use a JPEG, PNG, WebP, or HEIC photo.' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const existing = await getLicenseScan(supabase, userId)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const uploaded = await uploadDocument(userId, 'license-images', bytes, `${side}.jpg`, mime)

    const patch: Parameters<typeof saveLicenseScan>[2] = side === 'front'
      ? { front_storage_path: uploaded.storagePath }
      : { back_storage_path: uploaded.storagePath }

    if (side === 'back') {
      // A new back photo has to be reviewed again. The previous confirmation
      // described the previous image.
      patch.confirmed_at = null
      try {
        const text = await decodePdf417(bytes, mime)
        const fields = text ? parseAamvaLicense(text) : null
        patch.barcode_status = fields ? 'read' : 'failed'
        patch.parsed_fields = fields
      } catch (error) {
        console.warn('[LICENSE] barcode decode failed:', error)
        patch.barcode_status = 'failed'
        patch.parsed_fields = null
      }
    }

    await saveLicenseScan(supabase, userId, patch)

    const previousPath = side === 'front' ? existing?.front_storage_path : existing?.back_storage_path
    if (previousPath && previousPath !== uploaded.storagePath) {
      await deleteDocument('license-images', previousPath).catch((error) => {
        console.warn('[LICENSE] old photo delete failed:', error)
      })
    }

    const scan = await presentLicenseScan(supabase, userId)
    return NextResponse.json({ scan })
  } catch (error) {
    console.error('[LICENSE] POST failed:', error)
    return NextResponse.json({ error: 'Could not save that photo' }, { status: 500 })
  }
}

function normalizeMime(file: File): string | null {
  const fromType = file.type.toLowerCase()
  if (fromType === 'image/jpg') return 'image/jpeg'
  if (fromType in MIME_BY_EXT || Object.values(MIME_BY_EXT).includes(fromType)) return fromType
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? null
}
