import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { processPspAccioWebhookCompletion } from '@/lib/process-psp-accio-webhook'

/**
 * POST /api/psp/webhook — Accio FMCSA / PSP completion (legacy URL for older orders).
 * New PSP orders post back to `/api/mvr/webhook`; FMCSA posts are delegated to the same processor.
 */
export async function POST(request: NextRequest) {
  try {
    const xmlBody = await request.text()
    console.log('[PSP WEBHOOK] received, length:', xmlBody.length)

    if (!xmlBody) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const outcome = await processPspAccioWebhookCompletion(supabaseService, xmlBody)
    return NextResponse.json(outcome.body, { status: outcome.status })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PSP WEBHOOK] Unexpected:', error)
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'PSP webhook endpoint is active',
    method: 'POST',
    description: 'Receives FMCSA PSP / crash-inspection results from Accio',
  })
}
