import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/verification/initiate-self
 *
 * Deprecated: Use role-specific endpoints so driver and developer data are not mixed.
 * - Drivers: POST /api/driver/verification/initiate-self (uses driver_profiles / DOT only)
 * - Developers: POST /api/developer/verification/initiate-self (uses developer_profiles only)
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error:
        'Use POST /api/driver/verification/initiate-self for drivers or POST /api/developer/verification/initiate-self for developers. Do not mix driver and developer flows.',
    },
    { status: 400 }
  )
}
