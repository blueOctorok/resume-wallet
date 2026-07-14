import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * POST /api/driver-applications/[id]/verify
 *
 * DEPRECATED (DEC-2026-07-001). Base-era whole-app "VERIFIED" / blockchain seal is
 * not issuer verification. Field-level Accio MVR/PSP + EVR provenance + the live
 * verified-% meter are the honest signals. Callers should not use this endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.warn(
      '[DOT VERIFY] Deprecated endpoint called — refusing whole-app VERIFIED flag',
      { id, userId },
    )

    return NextResponse.json(
      {
        error: 'DOT whole-app verification is retired',
        details:
          'Self-reported DOT applications are not marked Verified as a whole. Raise verified coverage via MVR, PSP, or prior-employer confirmations (DEC-2026-07-001).',
      },
      { status: 410 },
    )
  } catch (error: unknown) {
    console.error('[DOT VERIFY] Error:', error)
    return NextResponse.json(
      {
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 },
    )
  }
}
