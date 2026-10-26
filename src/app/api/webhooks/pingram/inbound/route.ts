import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { processEvrInboundEmail, type PingramInboundEmail } from '@/lib/evr-inbound'
import { isSupportRecipient, saveSupportInbound } from '@/lib/support-inbox'

function inboundSecret(): string | null {
  return (
    process.env.PINGRAM_WEBHOOK_SECRET?.trim() ||
    process.env.INTERNAL_API_SECRET?.trim() ||
    null
  )
}

function authorize(request: NextRequest): boolean {
  const secret = inboundSecret()
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  if (header === `Bearer ${secret}`) return true

  const urlSecret = request.nextUrl.searchParams.get('secret')
  return urlSecret === secret
}

/**
 * POST /api/webhooks/pingram/inbound
 *
 * Pingram EMAIL_INBOUND. Employment-verification replies stay on that request.
 * Mail to a support address is stored for central admin instead.
 */
export async function POST(request: NextRequest) {
  try {
    if (!authorize(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let payload: PingramInboundEmail
    try {
      payload = (await request.json()) as PingramInboundEmail
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const result = await processEvrInboundEmail(supabase, payload)
    if (!result.ok && isSupportRecipient(payload.to)) {
      const saved = await saveSupportInbound(supabase, payload)
      if (!saved.ok) {
        return NextResponse.json({ error: saved.error }, { status: 422 })
      }
      return NextResponse.json({ success: true, supportMessageId: saved.id, duplicate: saved.duplicate })
    }
    if (!result.ok) {
      console.warn('[EVR INBOUND]', result.error)
      return NextResponse.json({ error: result.error }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      requestId: result.requestId,
      dkimValid: result.dkimValid,
    })
  } catch (error) {
    console.error('[EVR INBOUND] unexpected:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
