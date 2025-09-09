import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

// Create a Viem client for Base network
const client = createPublicClient({
  chain: base,
  transport: http(),
})

// Simple in-memory nonce store (in production, use Redis or database)
const usedNonces = new Set<string>()

export async function POST(request: NextRequest) {
  try {
    const { address, message, signature, typedData } = await request.json()

    // Handle both legacy message signing and new EIP-712 typed data
    if (typedData) {
      // EIP-712 typed data verification
      if (!address || !typedData || !signature) {
        return NextResponse.json(
          { error: 'Missing required fields: address, typedData, signature' },
          { status: 400 }
        )
      }

      // 1. Check nonce hasn't been reused
      const nonceKey = `${address}-${typedData.message.nonce}`
      if (usedNonces.has(nonceKey)) {
        return NextResponse.json(
          { error: 'Invalid or reused nonce' },
          { status: 400 }
        )
      }

      // 2. Check expiry
      const now = Math.floor(Date.now() / 1000)
      if (typedData.message.expiry < now) {
        return NextResponse.json(
          { error: 'Signature expired' },
          { status: 400 }
        )
      }

      // 3. Verify typed data signature using Viem
      const isValid = await client.verifyTypedData({
        address: address as `0x${string}`,
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
        signature: signature as `0x${string}`,
      })

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }

      // 4. Mark nonce as used
      usedNonces.add(nonceKey)

      // 5. Create session/JWT
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      return NextResponse.json({
        success: true,
        sessionToken,
        address,
        message: 'Authentication successful',
        typedData: {
          nonce: typedData.message.nonce,
          expiry: typedData.message.expiry,
          action: typedData.message.action,
        },
      })
    } else {
      // Legacy message signing (fallback)
      if (!address || !message || !signature) {
        return NextResponse.json(
          { error: 'Missing required fields: address, message, signature' },
          { status: 400 }
        )
      }

      // 1. Check nonce hasn't been reused
      const nonceMatch = message.match(/at (\w{32})$/)?.[1]
      if (!nonceMatch || usedNonces.has(nonceMatch)) {
        return NextResponse.json(
          { error: 'Invalid or reused nonce' },
          { status: 400 }
        )
      }

      // Mark nonce as used
      usedNonces.add(nonceMatch)

      // 2. Verify signature using Viem
      const isValid = await client.verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      })

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }

      // 3. Create session/JWT
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      return NextResponse.json({
        success: true,
        sessionToken,
        address,
        message: 'Authentication successful',
      })
    }
  } catch (error) {
    console.error('Auth verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
