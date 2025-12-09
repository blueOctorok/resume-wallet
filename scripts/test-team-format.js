#!/usr/bin/env node

/**
 * Test with Team's Exact Format
 * 
 * Tests the payment flow using the exact format the team provided.
 */

require('dotenv').config({ path: '.env.local' })

const API_BASE_URL = process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'

async function testTeamFormat() {
  console.log('🧪 Testing with Team\'s Exact Format')
  console.log('=' .repeat(50))
  console.log('')

  const walletAddress = '0x9499cd25c6737a8195e74262f3c5eae6da607df3'
  const sessionId = `user-${walletAddress}`

  const payload = {
    session_id: sessionId,
    system: 'You are AvA, a friendly AI assistant guiding users through the driver employment application process...',
    message: 'What documents do I need to apply?',
  }

  console.log('📤 Making request to your Next.js API...')
  console.log(`   Endpoint: http://localhost:3000/api/ai/chat`)
  console.log(`   Wallet: ${walletAddress}`)
  console.log(`   Message: ${payload.message}`)
  console.log('')

  try {
    const response = await fetch('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Wallet-Address': walletAddress,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    console.log(`📥 Response Status: ${response.status}`)
    console.log('')

    if (response.status === 200 && data.success) {
      console.log('✅ SUCCESS! Payment flow worked!')
      console.log('')
      console.log('📝 AI Response:')
      console.log(`   ${data.reply?.substring(0, 200)}...`)
      console.log('')
      
      if (data.paymentTxHash) {
        console.log('💳 Payment Transaction:')
        console.log(`   Hash: ${data.paymentTxHash}`)
        console.log(`   View: https://basescan.org/tx/${data.paymentTxHash}`)
        console.log('')
      }

      console.log('🎉 Everything is working perfectly!')
    } else {
      console.error('❌ Request failed:')
      console.error(`   Status: ${response.status}`)
      console.error(`   Error: ${data.error || 'Unknown error'}`)
      if (data.detail) {
        console.error(`   Detail: ${data.detail}`)
      }
      
      if (response.status === 402) {
        console.log('')
        console.log('💡 Got 402 - payment is required but not handled yet')
        console.log('   Check server logs for payment processing')
      }
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Could not connect to local server!')
      console.error('   Make sure your Next.js dev server is running:')
      console.error('   npm run dev')
    } else {
      console.error('❌ Error:', error.message)
    }
    process.exit(1)
  }
}

testTeamFormat().catch(console.error)

