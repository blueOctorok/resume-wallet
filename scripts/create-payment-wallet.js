#!/usr/bin/env node

/**
 * Create Payment Wallet
 * 
 * Generates a new wallet specifically for x402 payments.
 * This keeps your deployer wallet separate for better security.
 */

const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts')
const crypto = require('crypto')

function createPaymentWallet() {
  console.log('🔐 Creating new payment wallet...')
  console.log('')

  // Generate a new private key
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)

  console.log('✅ New Payment Wallet Created!')
  console.log('')
  console.log('📋 Add this to your .env.local file:')
  console.log('')
  console.log(`X402_PAYMENT_PRIVATE_KEY="${privateKey}"`)
  console.log('')
  console.log('💰 Wallet Address (fund this with USDC on Base Mainnet):')
  console.log(`   ${account.address}`)
  console.log('')
  console.log('📋 Next Steps:')
  console.log('   1. Copy the X402_PAYMENT_PRIVATE_KEY above')
  console.log('   2. Add it to .env.local')
  console.log('   3. Fund the wallet with USDC on Base Mainnet')
  console.log('   4. Add some Base ETH for gas fees (~$0.01)')
  console.log('   5. View on BaseScan: https://basescan.org/address/' + account.address)
  console.log('')
  console.log('⚠️  SECURITY WARNING:')
  console.log('   - Keep this private key SECRET')
  console.log('   - Never commit it to git')
  console.log('   - Only fund what you need for payments')
  console.log('   - This wallet is separate from your deployer wallet')
}

createPaymentWallet()



