import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { transactionData, entrypoint, chainId, context } =
      await request.json()

    // For now, we'll simulate paymaster data
    // In production, this would call the actual Coinbase Developer Platform paymaster
    const response = {
      id: 1,
      jsonrpc: '2.0',
      result: {
        paymasterAndData:
          '0x2faeb0760d4230ef2ac21496bb4f0b47d634fd4c0000670fdc98000000000000494b3b6e1d074fbca920212019837860000100833589fcd6edb6e08f4c7c32d4f71b54bdA029137746371e8df1d7099a84c20ed72e3335fb016b23000000000000000000000000000000000000000000000000000000009b75458400000000697841102cd520d4e0171a58dadc3e6086111a49a90826cb0ad25579f25f1652081f68c17d8652387a33bf8880dc44ecf95be4213e786566d755baa6299f477b0bb21c',
        tokenPayment: {
          name: 'USDC',
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          maxFee: '0xa7c8', // ~$0.01 in USDC
          decimals: 6,
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting paymaster data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
