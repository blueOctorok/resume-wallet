import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { processEvrInboundEmail, type PingramInboundEmail } from '@/lib/evr-inbound'

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
 * Pingram EMAIL_INBOUND (and optional raw RFC822) for employment-verification replies.
 * DKIM is verified only when raw MIME is present.
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
