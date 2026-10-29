import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { accioPostAckErrorText, accioPostAckResponse } from '@/lib/accio-post-ack'
import { processMvrAccioWebhookCompletion } from '@/lib/process-mvr-accio-webhook'

/**
 * API Route: Accio Webhook Handler
 *
 * POST /api/mvr/webhook
 *
 * Receives MVR (and bundled FMCSA) results from Accio via webhook.
 */
export async function POST(request: NextRequest) {
  try {
    const xmlBody = await request.text()

    console.log('[MVR WEBHOOK] ========== INCOMING WEBHOOK ==========')
    console.log('[MVR WEBHOOK] Body length:', xmlBody.length)
    console.log('[MVR WEBHOOK] Full XML body:', xmlBody)
    console.log('[MVR WEBHOOK] FMCSA detection:', {
      hasPostResults: xmlBody.includes('<postResults'),
      hasFmcsaType: /type=["']fmcsa_crash_inspection["']/i.test(xmlBody),
      hasMvrType: /<subOrder[^>]*type=["']MVR["']/i.test(xmlBody),
    })
    console.log('[MVR WEBHOOK] ========================================')

    if (!xmlBody) {
      console.error('[MVR WEBHOOK] Empty body received')
      return accioPostAckResponse(400, 'Empty body')
    }

    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const outcome = await processMvrAccioWebhookCompletion(supabaseService, xmlBody)
    return accioPostAckResponse(
      outcome.status,
      outcome.status >= 400 ? accioPostAckErrorText(outcome.body) : undefined,
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[MVR WEBHOOK] Unexpected error:', error)
    return accioPostAckResponse(500, `Internal server error: ${message}`)
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'MVR webhook endpoint is active',
      method: 'POST',
      description: 'This endpoint receives MVR results from Accio via POST requests',
    },
    { status: 200 },
  )
}
