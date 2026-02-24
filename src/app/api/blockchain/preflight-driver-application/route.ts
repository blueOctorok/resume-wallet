import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createClient } from '@/utils/supabase/server'
import { getUserByWallet } from '@/lib/user-by-wallet'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS!
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY!
const RPC_URL = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

// Minimal ABI for preflight checks
const CONTRACT_ABI = [
  'function isHashUsed(string _hash) external view returns (bool)',
]

export async function POST(request: NextRequest) {
  try {
    const { applicationHash, userAddress } = await request.json()

    if (!CONTRACT_ADDRESS) {
      return NextResponse.json(
        { error: 'Contract address not configured' },
        { status: 500 }
      )
    }
    if (!ALCHEMY_API_KEY) {
      return NextResponse.json(
        { error: 'RPC not configured' },
        { status: 500 }
      )
    }
    if (!applicationHash) {
      return NextResponse.json(
        { error: 'Missing applicationHash' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check DB duplicate by user (case-insensitive)
    if (userAddress) {
      const userRow = await getUserByWallet(supabase, userAddress)

      if (userRow) {
        const { data: existing } = await supabase
          .from('driver_applications')
          .select('id, created_at, blockchain_tx_hash')
          .eq('user_id', userRow.id)
          .eq('application_hash', applicationHash)
          .maybeSingle()

        if (existing) {
          return NextResponse.json(
            {
              error: 'Duplicate application detected',
              details:
                'This application hash is already recorded for this user in the database.',
              existingApplication: existing,
            },
            { status: 409 }
          )
        }
      }
    }

    // On-chain preflight: check if hash already used
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
    const used = await contract.isHashUsed(applicationHash)
    if (used) {
      return NextResponse.json(
        {
          error: 'Duplicate on-chain',
          details:
            'This application hash has already been recorded on-chain. Please modify and try again.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      ok: true,
      contractAddress: CONTRACT_ADDRESS,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Preflight failed', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}


