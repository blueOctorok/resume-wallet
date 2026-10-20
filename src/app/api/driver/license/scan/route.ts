import { NextRequest, NextResponse } from 'next/server'
import { parseAamvaLicense } from '@/lib/aamva-license'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getLicenseScan, saveLicenseScan, type LicenseScanRow } from '@/lib/block-data'
import { deleteDocument } from '@/lib/document-storage'
import { presentLicenseScan } from '@/lib/license-scan-view'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const MAX_RAW_CHARS = 20_000

/**
 * The browser already decoded the PDF417. This stores the parsed fields only.
 * The camera frame never arrives, so there is no license photo to keep.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const raw = body && typeof body === 'object' && typeof (body as { raw?: unknown }).raw === 'string'
      ? (body as { raw: string }).raw.trim()
      : ''
    if (!raw || raw.length > MAX_RAW_CHARS) {
      return NextResponse.json({ error: 'That did not read as a license barcode' }, { status: 400 })
    }

    const fields = parseAamvaLicense(raw)
    if (!fields?.licenseNumber || fields.state.length !== 2) {
      return NextResponse.json(
        { error: 'Hold the barcode on the back of the license steady and try again' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()
    const existing = await getLicenseScan(supabase, userId)
    await forgetStoredPhotos(existing)

    await saveLicenseScan(supabase, userId, {
      parsed_fields: fields,
      barcode_status: 'read',
      confirmed_at: null,
      front_storage_path: null,
      back_storage_path: null,
    })

    const scan = await presentLicenseScan(supabase, userId)
    return NextResponse.json({ scan })
  } catch (error) {
    console.error('[LICENSE] scan failed:', error)
    return NextResponse.json({ error: 'Could not save that barcode read' }, { status: 500 })
  }
}

async function forgetStoredPhotos(row: LicenseScanRow | null) {
  if (!row) return
  for (const path of [row.front_storage_path, row.back_storage_path]) {
    if (!path) continue
    await deleteDocument('license-images', path).catch((error) => {
      console.warn('[LICENSE] photo delete failed:', error)
    })
  }
}
