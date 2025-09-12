import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { entrypoint, chainId, context } = await request.json()

    // For now, we'll return USDC as the accepted token
    // In production, this would call the actual paymaster service
    const response = {
      id: 1,
      jsonrpc: '2.0',
      result: {
        acceptedTokens: [
          {
            name: 'USDC',
            address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          },
        ],
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting accepted payment tokens:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
