import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const outcome = await processMvrAccioWebhookCompletion(supabaseService, xmlBody)
    return NextResponse.json(outcome.body, { status: outcome.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[MVR WEBHOOK] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 },
    )
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
