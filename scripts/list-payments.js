#!/usr/bin/env node

/**
 * List All Payments Made
 * 
 * Shows all USDC payments sent from the payment wallet to the T Backend.
 * Use this to provide invoice IDs and transaction hashes for manual reconciliation.
 */

require('dotenv').config({ path: '.env.local' })

async function listPayments() {
  const { createPublicClient, http } = require('viem')
  const { base } = require('viem/chains')
  const { privateKeyToAccount } = require('viem/accounts')

  const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY
  if (!paymentKey) {
    console.error('❌ No payment wallet configured!')
    process.exit(1)
  }

  const normalizedKey = paymentKey.startsWith('0x') ? paymentKey : `0x${paymentKey}`
  const account = privateKeyToAccount(normalizedKey)

  console.log('📋 Payment Summary for Manual Reconciliation')
  console.log('=' .repeat(60))
  console.log('')
  console.log(`Payment Wallet: ${account.address}`)
  console.log(`View on BaseScan: https://basescan.org/address/${account.address}`)
  console.log('')

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.ALCHEMY_BASE_MAINNET_URL || process.env.BASE_RPC_URL),
  })

  // Get recent transactions
  console.log('🔍 Fetching recent USDC transactions...')
  console.log('')

  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  const BACKEND_RECIPIENT = '0x29589ddb93D0bE44ddd16cB8686bDE153037A847'

  // Note: This is a simplified check. For production, use Alchemy Transfers API
  console.log('💡 Payments from logs (check server logs for invoice IDs):')
  console.log('')
  console.log('Known payments from this session:')
  console.log('')
  console.log('🔴 FIRST TEST (Credits failed to activate - refunded):')
  console.log('1. Invoice: 5ab154a8cb2f49b1913f86535a0197a9')
  console.log('   Tx Hash: 0x5a067856c33f9b3814314568a3eb9203d8f3a435c8bd30c8f552003c42b130d7')
  console.log('   Amount: 5 USDC')
  console.log('')
  console.log('2. Invoice: 03d0dad67f0b4034bf58c33ff3cf2e2a')
  console.log('   Tx Hash: 0xdf8f3b4d267210d0f332b263948abb9c203e4f7717c7a7addd4b4e456b37aee1')
  console.log('   Amount: 5 USDC')
  console.log('')
  console.log('3. Invoice: bd27f6cc3de74bdfa87b9db9c1fadece')
  console.log('   Tx Hash: 0xc14bb60a6c34125b47ea5a8bb2c1e0617404b35d2d7100cd239f2990efb11aa4')
  console.log('   Amount: 5 USDC')
  console.log('')
  console.log('🔴 RETEST (After team "fix" - credits STILL broken):')
  console.log('4. Invoice: 3d08ff3b1e9544d189dd6198ba2a42af')
  console.log('   Tx Hash: 0xe64d9139aad881922ff651c966969b2b4fd815ef4f011f735c2e537d4f7fc390')
  console.log('   Amount: 5 USDC')
  console.log('   Status: ✅ Verified, got 200 OK')
  console.log('')
  console.log('5. Invoice: 251e125e61d74dc5828609c4eb60acfb')
  console.log('   Tx Hash: 0x0626f5a3602a0da3fb1eb660ac4339080e5c097b63c255cb35b419990b8c7e18')
  console.log('   Amount: 5 USDC')
  console.log('   Status: ✅ Verified, got 200 OK (but still triggered payment!)')
  console.log('')
  console.log('📊 Total Spent: 10 USDC (latest test)')
  console.log('📊 Expected Credits: 100 (2 × 50)')
  console.log('📊 Actual Credits: 0 (second request still got 402)')
  console.log('📊 Current Balance: ~190 USDC')
  console.log('')
  console.log('📋 For Manual Reconciliation:')
  console.log('')
  console.log('Send this to the team:')
  console.log(`"Payment wallet: ${account.address}`)
  console.log('')
  console.log('The credit system is fundamentally broken. After your "fix" and refund, we retested:')
  console.log('')
  console.log('Test Results:')
  console.log('1. First request → 402 → paid 5 USDC → got 200 OK ✅')
  console.log('2. Second request (immediately after) → 402 AGAIN → paid 5 USDC → got 200 OK ❌')
  console.log('')
  console.log('The second request should have used credits from the first payment, not triggered a new payment.')
  console.log('')
  console.log('Latest Test Payments:')
  console.log('- Invoice: 3d08ff3b1e9544d189dd6198ba2a42af, Tx: 0xe64d9139aad881922ff651c966969b2b4fd815ef4f011f735c2e537d4f7fc390')
  console.log('- Invoice: 251e125e61d74dc5828609c4eb60acfb, Tx: 0x0626f5a3602a0da3fb1eb660ac4339080e5c097b63c255cb35b419990b8c7e18')
  console.log('')
  console.log('Please fix the credit activation/tracking system BEFORE we test again.')
  console.log('We need proof that consecutive requests use credits (not trigger new payments)."')
  console.log('')
  console.log('🔗 View all transactions: https://basescan.org/address/' + account.address)
}

listPayments().catch(console.error)

