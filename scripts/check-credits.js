#!/usr/bin/env node

/**
 * Check Credit Balance
 * 
 * Queries the T Backend to check current credit balance for the payment wallet.
 */

require('dotenv').config({ path: '.env.local' })

async function checkCredits() {
  const { privateKeyToAccount } = require('viem/accounts')

  const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY
  if (!paymentKey) {
    console.error('❌ No payment wallet configured!')
    process.exit(1)
  }

  const normalizedKey = paymentKey.startsWith('0x') ? paymentKey : `0x${paymentKey}`
  const account = privateKeyToAccount(normalizedKey)

  console.log('💳 Checking Credit Balance')
  console.log('=' .repeat(60))
  console.log('')
  console.log(`Payment Wallet: ${account.address}`)
  console.log(`Partner: pace_drivers`)
  console.log('')

  const url = `https://api-v3.fluxpointstudios.com/payments/credits?partner=pace_drivers&wallet=${account.address}`
  
  try {
    console.log('🔍 Fetching credits from T Backend...')
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error(`❌ Error: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.error(text)
      process.exit(1)
    }

    const data = await response.json()
    console.log('')
    console.log('✅ Credit Balance Retrieved:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')
    
    if (data.remaining !== undefined) {
      const credits = data.remaining
      const total = data.total || credits
      const perRequest = 0.00052 // USDC per request (0.026 / 50)
      const perBatch = 0.026 // USDC per 50 credit batch
      console.log(`📊 Credits Available: ${credits} / ${total}`)
      console.log(`📊 Value: $${(credits * perRequest).toFixed(4)} USDC`)
      console.log(`📊 Cost per request: $${perRequest.toFixed(4)} USDC`)
      console.log(`📊 Cost per batch: $${perBatch.toFixed(3)} USDC (50 credits)`)
      console.log(`📊 Requests Remaining: ${credits}`)
      if (data.expires_at) {
        console.log(`📊 Expires: ${new Date(data.expires_at).toLocaleDateString()}`)
      }
      console.log('')
    }
    
  } catch (error) {
    console.error('❌ Failed to fetch credits:', error.message)
    process.exit(1)
  }
}

checkCredits().catch(console.error)

