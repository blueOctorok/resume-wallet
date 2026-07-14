import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * POST /api/resumes/[id]/verify
 *
 * DEPRECATED (DEC-2026-07-001 / provenance gate DEC-2026-05-014).
 * Self-reported resumes are never issuer- or chain-verified. Midnight proves
 * third-party facts (MVR/PSP/EVR), not a PDF the candidate typed.
 * PDF export lives on builder download / storage paths — not this endpoint.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const userId = await getStormUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.warn('[VERIFY RESUME] Deprecated endpoint called — refusing whole-resume VERIFIED', {
      id,
      userId,
    })

    return NextResponse.json(
      {
        error: 'Resume blockchain verification is retired',
        details:
          'Resumes are self-reported and are not marked Verified. Trust comes from issuer-backed facts on your career card (MVR, PSP, prior-employer confirmations) — DEC-2026-05-014.',
      },
      { status: 410 },
    )
  } catch (error: unknown) {
    console.error('[VERIFY RESUME] Error:', error)
    return NextResponse.json(
      {
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
