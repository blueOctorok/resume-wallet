# Base Account SDK Integration

## Overview

Base Account SDK provides native Base ecosystem integration with "Sign in with Base", one-tap USDC payments, gas sponsorship, and batch transactions.

## 🎯 Why Base Account SDK

### Advantages Over Dynamic.xyz

- **Native Base integration** - Official Base way to authenticate
- **Better UX** - "Sign in with Base" is more intuitive
- **One-tap payments** - Built-in USDC payment support
- **Gas sponsorship** - Users don't pay gas fees
- **Future-proof** - Base's recommended approach
- **Cost savings** - Free vs $1,000/month for Dynamic.xyz Enterprise

### Key Features

- **"Sign in with Base"** - Native Base authentication
- **Base Pay** - One-tap USDC payments
- **Gas Sponsorship** - Paymaster integration
- **Batch Transactions** - EIP-5792 support
- **Sub Accounts** - Embedded wallet management
- **Spend Permissions** - Automated payment handling

## 🔧 Implementation

### 1. Installation

```bash
npm install @base-org/account @base-org/account-ui
```

### 2. SDK Configuration

```typescript
// src/lib/base-account-sdk.ts
import { createBaseAccountSDK } from '@base-org/account'
import { base } from 'viem/chains'

let baseAccountSDK: any = null
let baseProvider: any = null

if (typeof window !== 'undefined') {
  baseAccountSDK = createBaseAccountSDK({
    appName: 'Resume Wallet',
    appLogoUrl: '/logo.png',
    appChainIds: [
      base.id, // Base Mainnet: 8453
      84532, // Base Sepolia: 84532
    ],
  })

  baseProvider = baseAccountSDK.getProvider()
}

export { baseAccountSDK, baseProvider }
```

### 3. Authentication Components

#### Base Account Auth Component

```typescript
// src/components/BaseAccountAuth.tsx
'use client'

import React, { useState } from 'react'
import { baseProvider } from '@/lib/base-account-sdk'

export const BaseAccountAuth: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [user, setUser] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const signInWithBase = async () => {
    if (!baseProvider) {
      setError('Base provider not initialized. Please refresh the page.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // 1. Generate a fresh nonce
      const nonce = window.crypto.randomUUID().replace(/-/g, '')

      // 2. Switch to Base Chain (Base Mainnet - 8453)
      await baseProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // Base Mainnet
      })

      // 3. Connect and authenticate using wallet_connect
      const { accounts } = await baseProvider.request({
        method: 'wallet_connect',
        params: [
          {
            version: '1',
            capabilities: {
              signInWithEthereum: {
                nonce,
                chainId: '0x2105', // Base Mainnet - 8453
              },
            },
          },
        ],
      })

      if (accounts && accounts.length > 0) {
        const { address } = accounts[0]
        const { message, signature } = accounts[0].capabilities.signInWithEthereum

        // Send to backend for verification
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, message, signature }),
        })

        if (!response.ok) {
          throw new Error('Authentication verification failed')
        }

        const authResult = await response.json()

        const userInfo = {
          address,
          message,
          signature,
          sessionToken: authResult.sessionToken,
        }

        setUser(userInfo)
        setIsAuthenticated(true)
      }
    } catch (error: any) {
      console.error('Error signing in with Base:', error)
      setError(error.message || 'Failed to sign in with Base')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Sign in with Base
      </h3>

      <button
        onClick={signInWithBase}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Signing in...
          </>
        ) : (
          <>
            <div className="w-5 h-5 bg-white rounded-sm"></div>
            Sign in with Base
          </>
        )}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {isAuthenticated && user && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            ✅ Connected as: {user.address}
          </p>
        </div>
      )}
    </div>
  )
}
```

### 4. Backend Verification

```typescript
// src/app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const client = createPublicClient({
  chain: base,
  transport: http(),
})

const usedNonces = new Set<string>()

export async function POST(request: NextRequest) {
  try {
    const { address, message, signature } = await request.json()

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
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 3. Create session/JWT
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return NextResponse.json({
      success: true,
      sessionToken,
      address,
      message: 'Authentication successful',
    })
  } catch (error) {
    console.error('Auth verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## 💰 Base Pay Integration

### 1. Payment Component

```typescript
// src/components/BasePayButton.tsx
'use client'

import React, { useState } from 'react'
import { pay, getPaymentStatus } from '@base-org/account'

interface BasePayButtonProps {
  amount: string
  to: string
  onSuccess?: (payment: any) => void
  onError?: (error: string) => void
}

export const BasePayButton: React.FC<BasePayButtonProps> = ({
  amount,
  to,
  onSuccess,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [paymentId, setPaymentId] = useState<string>('')

  const handlePayment = async () => {
    setIsLoading(true)

    try {
      const payment = await pay({
        amount,
        to,
        testnet: process.env.NODE_ENV === 'development',
        payerInfo: {
          requests: [
            { type: 'email' },
            { type: 'name' }
          ],
        },
      })

      setPaymentId(payment.id)
      onSuccess?.(payment)
    } catch (error: any) {
      console.error('Payment failed:', error)
      onError?.(error.message || 'Payment failed')
    } finally {
      setIsLoading(false)
    }
  }

  const checkPaymentStatus = async () => {
    if (!paymentId) return

    try {
      const { status } = await getPaymentStatus({
        id: paymentId,
        testnet: process.env.NODE_ENV === 'development',
      })

      console.log('Payment status:', status)
    } catch (error) {
      console.error('Status check failed:', error)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handlePayment}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Processing Payment...
          </>
        ) : (
          <>
            <div className="w-5 h-5 bg-white rounded-sm"></div>
            Pay {amount} USDC
          </>
        )}
      </button>

      {paymentId && (
        <button
          onClick={checkPaymentStatus}
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Check Payment Status
        </button>
      )}
    </div>
  )
}
```

## ⛽ Gas Sponsorship

### 1. Paymaster Configuration

```typescript
// Gas sponsorship for resume operations
const sendSponsoredTransaction = async (calls: any[]) => {
  const paymasterServiceUrl = process.env.NEXT_PUBLIC_PAYMASTER_PROXY_SERVER_URL

  const result = await baseProvider.request({
    method: 'wallet_sendCalls',
    params: [
      {
        version: '2.0.0',
        from: userAddress,
        chainId: numberToHex(base.constants.CHAIN_IDS.base),
        calls: calls,
        capabilities: {
          paymasterService: {
            url: paymasterServiceUrl,
          },
        },
      },
    ],
  })

  return result
}
```

### 2. Sponsored Resume Upload

```typescript
// Resume upload with gas sponsorship
const uploadResumeWithSponsorship = async (resumeData: any) => {
  const calls = [
    {
      to: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
      value: '0x0',
      data: encodeFunctionData({
        abi: ResumeRegistryABI,
        functionName: 'addResume',
        args: [
          resumeData.ipfsHash,
          resumeData.title,
          resumeData.filename,
          true,
        ],
      }),
    },
  ]

  // User sees: "Transaction sponsored by Resume Wallet" ✅
  return await sendSponsoredTransaction(calls)
}
```

## 🔄 Batch Transactions

### 1. Complex Operations

```typescript
// Resume verification + premium activation in one transaction
const handleResumeVerification = async (resumeId: string) => {
  const calls = [
    {
      to: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
      value: '0x0',
      data: encodeFunctionData({
        abi: ResumeRegistryABI,
        functionName: 'verifyResume',
        args: [resumeId],
      }),
    },
    {
      to: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
      value: '0x0',
      data: encodeFunctionData({
        abi: ResumeRegistryABI,
        functionName: 'activatePremium',
        args: [userAddress, 'verification'],
      }),
    },
  ]

  const result = await baseProvider.request({
    method: 'wallet_sendCalls',
    params: [
      {
        version: '2.0.0',
        from: userAddress,
        chainId: numberToHex(base.constants.CHAIN_IDS.base),
        atomicRequired: true, // All calls must succeed or all fail
        calls: calls,
      },
    ],
  })

  return result
}
```

## 🎯 User Experience Benefits

### For Drivers

- **No seed phrases** - Just "Sign in with Base"
- **No gas fees** - We sponsor transactions
- **One-tap payments** - USDC payments for premium features
- **Familiar brand** - Coinbase is trusted
- **Mobile-friendly** - Works on any device

### For Employers

- **Transparent pricing** - No hidden fees
- **Fast settlements** - 2-second USDC payments
- **Verified resumes** - Blockchain verification
- **Professional platform** - Enterprise-grade security

## 🚀 Implementation Timeline

### Phase 1: Core Integration ✅

- [x] Install Base Account SDK packages
- [x] Create SDK configuration
- [x] Implement authentication components
- [x] Add backend verification
- [x] Test wallet connection flow

### Phase 2: Payment Integration

- [ ] Implement Base Pay components
- [ ] Add payment status tracking
- [ ] Create premium feature payments
- [ ] Test USDC payment flow

### Phase 3: Gas Sponsorship

- [ ] Set up Paymaster service
- [ ] Configure contract allowlist
- [ ] Implement sponsored transactions
- [ ] Test gas-free operations

### Phase 4: Advanced Features

- [ ] Batch transaction optimization
- [ ] Sub Account integration (if needed)
- [ ] Spend Permissions (if needed)
- [ ] Advanced error handling

## 🔒 Security Considerations

### Authentication Security

- **Nonce validation** - Prevent replay attacks
- **Signature verification** - Verify message authenticity
- **Session management** - Secure token handling
- **Rate limiting** - Prevent abuse

### Payment Security

- **USDC verification** - Ensure legitimate payments
- **Amount validation** - Prevent overcharging
- **Recipient verification** - Secure payment destinations
- **Transaction monitoring** - Track payment status

## 📊 Performance Metrics

### User Experience

- Authentication success rate
- Payment completion rate
- Transaction confirmation time
- User satisfaction scores

### Technical Performance

- SDK initialization time
- API response times
- Error rates
- Gas sponsorship success rate

---

_Base Account SDK integration provides a native, seamless experience for our resume wallet platform with built-in authentication, payments, and gas sponsorship capabilities._
