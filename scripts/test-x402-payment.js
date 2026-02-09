#!/usr/bin/env node

/**
 * Test x402 Payment Flow
 * 
 * Tests the automatic payment integration by making a real AI chat request.
 * This will trigger the 402 payment flow if working correctly.
 */

require('dotenv').config({ path: '.env.local' })

const API_BASE_URL = process.env.T_BACKEND_BASE_URL || 'https://api-v3.fluxpointstudios.com'
const API_KEY = process.env.T_BACKEND_API_KEY

if (!API_KEY) {
  console.error('❌ T_BACKEND_API_KEY not found in .env.local')
  process.exit(1)
}

async function testPaymentFlow() {
  console.log('🧪 Testing x402 Payment Integration')
  console.log('=' .repeat(50))
  console.log('')

  // Test 1: Check wallet balance
  console.log('1️⃣ Checking payment wallet balance...')
  try {
    const { privateKeyToAccount } = require('viem/accounts')
    const { createPublicClient, http } = require('viem')
    const { base } = require('viem/chains')

    const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY
    if (!paymentKey) {
      console.error('❌ No payment wallet configured!')
      process.exit(1)
    }

    const normalizedKey = paymentKey.startsWith('0x') ? paymentKey : `0x${paymentKey}`
    const account = privateKeyToAccount(normalizedKey)

    const publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.ALCHEMY_BASE_MAINNET_URL || process.env.BASE_RPC_URL),
    })

    // Check ETH balance
    const ethBalance = await publicClient.getBalance({ address: account.address })
    const ethFormatted = (Number(ethBalance) / 1e18).toFixed(6)

    // Check USDC balance
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'balanceOf',
      args: [account.address],
    })
    const usdcFormatted = (Number(usdcBalance) / 1e6).toFixed(2)

    console.log(`   Wallet: ${account.address}`)
    console.log(`   ETH Balance: ${ethFormatted} ETH`)
    console.log(`   USDC Balance: ${usdcFormatted} USDC`)
    console.log('')

    if (Number(usdcBalance) === 0) {
      console.error('❌ No USDC in wallet! Please fund it first.')
      process.exit(1)
    }

    if (Number(ethBalance) === 0) {
      console.error('❌ No ETH in wallet! Need ETH for gas fees.')
      process.exit(1)
    }

    console.log('✅ Wallet has sufficient funds')
    console.log('')
  } catch (error) {
    console.error('❌ Error checking wallet balance:', error.message)
    process.exit(1)
  }

  // Test 2: Make AI chat request (this should trigger payment)
  console.log('2️⃣ Making AI chat request (should trigger 402 payment)...')
  console.log('')

  try {
    const response = await fetch('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello, this is a test of the payment system',
        session_id: 'test-payment-' + Date.now(),
      }),
    })

    const data = await response.json()

    if (response.status === 200 && data.success) {
      console.log('✅ Payment flow successful!')
      console.log('')
      console.log('📝 Response:')
      console.log(`   ${data.reply?.substring(0, 100)}...`)
      if (data.paymentTxHash) {
        console.log('')
        console.log('💳 Payment Transaction:')
        console.log(`   ${data.paymentTxHash}`)
        console.log(`   View on BaseScan: https://basescan.org/tx/${data.paymentTxHash}`)
      }
      console.log('')
      console.log('🎉 Everything is working!')
    } else {
      console.error('❌ Request failed:')
      console.error(`   Status: ${response.status}`)
      console.error(`   Error: ${data.error || 'Unknown error'}`)
      if (data.detail) {
        console.error(`   Detail: ${data.detail}`)
      }
      process.exit(1)
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Could not connect to local server!')
      console.error('   Make sure your Next.js dev server is running:')
      console.error('   npm run dev')
      process.exit(1)
    }
    console.error('❌ Error making request:', error.message)
    process.exit(1)
  }
}

testPaymentFlow().catch(console.error)

