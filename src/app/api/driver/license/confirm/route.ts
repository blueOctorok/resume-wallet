import { NextRequest, NextResponse } from 'next/server'
import { emptyLicenseFields, type LicenseScanFields } from '@/lib/aamva-license'
import { applyConfirmedLicenseScan } from '@/lib/apply-license-scan'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getLicenseScan, saveLicenseScan } from '@/lib/block-data'
import { presentLicenseScan } from '@/lib/license-scan-view'
import { checkDlNumberIsNotName } from '@/lib/screening-validation'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * The driver accepts the fields read from the card (or typed after a missed barcode).
 * This writes empty CDL, profile, and DOT fields. It does not create a proof.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const fields = normalizeFields(body)
    if (!fields) {
      return NextResponse.json({ error: 'License number and state are required' }, { status: 400 })
    }

    const nameError = checkDlNumberIsNotName({
      dlNumber: fields.licenseNumber,
      firstName: fields.firstName,
      lastName: fields.lastName,
    })
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 })

    const supabase = await getAdminSupabaseClient()
    const existing = await getLicenseScan(supabase, userId)
    if (!existing?.front_storage_path || !existing.back_storage_path) {
      return NextResponse.json({ error: 'Photograph the front and the back before confirming' }, { status: 400 })
    }

    await saveLicenseScan(supabase, userId, {
      parsed_fields: fields,
      confirmed_at: new Date().toISOString(),
    })

    const { filled } = await applyConfirmedLicenseScan(supabase, userId, fields)
    const scan = await presentLicenseScan(supabase, userId)
    return NextResponse.json({ scan, filled })
  } catch (error) {
    console.error('[LICENSE] confirm failed:', error)
    return NextResponse.json({ error: 'Could not save the license on file' }, { status: 500 })
  }
}

function normalizeFields(body: unknown): LicenseScanFields | null {
  if (!body || typeof body !== 'object') return null
  const row = body as Record<string, unknown>
  const base = emptyLicenseFields()
  const text = (key: keyof LicenseScanFields) => {
    const value = row[key]
    return typeof value === 'string' ? value.trim() : ''
  }
  const list = (key: 'endorsements' | 'restrictions') => {
    const value = row[key]
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
    }
    if (typeof value === 'string') {
      return value.split(/[^A-Za-z0-9]+/).map((item) => item.trim().toUpperCase()).filter(Boolean)
    }
    return []
  }

  const fields: LicenseScanFields = {
    ...base,
    firstName: text('firstName'),
    middleName: text('middleName'),
    lastName: text('lastName'),
    dateOfBirth: text('dateOfBirth'),
    licenseNumber: text('licenseNumber'),
    state: text('state').toUpperCase().slice(0, 2),
    licenseClass: text('licenseClass').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10),
    endorsements: list('endorsements'),
    restrictions: list('restrictions'),
    expirationDate: text('expirationDate'),
    street: text('street'),
    city: text('city'),
    postalCode: text('postalCode'),
  }

  if (!fields.licenseNumber || fields.state.length !== 2) return null
  return fields
}
