#!/usr/bin/env node

/**
 * Backup Payment Wallet
 * 
 * Shows your payment wallet information for secure backup.
 * IMPORTANT: Keep this information safe - it's your only way to recover the wallet!
 */

require('dotenv').config({ path: '.env.local' })
const { privateKeyToAccount } = require('viem/accounts')
const fs = require('fs')
const path = require('path')

function backupPaymentWallet() {
  const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY || process.env.PRIVATE_KEY

  if (!paymentKey) {
    console.error('❌ No payment wallet configured!')
    process.exit(1)
  }

  const normalizedKey = paymentKey.startsWith('0x') ? paymentKey : `0x${paymentKey}`
  const account = privateKeyToAccount(normalizedKey)

  console.log('🔐 Payment Wallet Backup Information')
  console.log('=' .repeat(50))
  console.log('')
  console.log('⚠️  KEEP THIS INFORMATION SECURE!')
  console.log('   This is your ONLY way to recover this wallet.')
  console.log('')
  console.log('📋 Wallet Details:')
  console.log('')
  console.log(`   Address: ${account.address}`)
  console.log(`   Private Key: ${paymentKey}`)
  console.log('')
  console.log('💾 Backup Options:')
  console.log('')
  console.log('   1. Save in password manager (1Password, LastPass, etc.)')
  console.log('   2. Write down and store in secure physical location')
  console.log('   3. Store in encrypted file (not in git!)')
  console.log('   4. Import into MetaMask as backup')
  console.log('')
  console.log('🔄 How to Recover:')
  console.log('')
  console.log('   Option 1: Import into MetaMask')
  console.log('   - Open MetaMask → Import Account')
  console.log('   - Paste the private key above')
  console.log('')
  console.log('   Option 2: Use in code')
  console.log('   - Add to .env.local: X402_PAYMENT_PRIVATE_KEY="..."')
  console.log('')
  console.log('📝 Current Backup Location:')
  console.log(`   ${path.resolve('.env.local')}`)
  console.log('')
  console.log('⚠️  SECURITY REMINDERS:')
  console.log('   - Never share your private key')
  console.log('   - Never commit it to git')
  console.log('   - Store backups in multiple secure locations')
  console.log('   - Consider using a password manager')
  console.log('')

  // Optionally create a backup file (user must confirm)
  const backupFile = path.join(process.cwd(), 'payment-wallet-backup.txt')
  const backupContent = `Payment Wallet Backup
Generated: ${new Date().toISOString()}

WALLET ADDRESS:
${account.address}

PRIVATE KEY (KEEP SECRET!):
${paymentKey}

RECOVERY INSTRUCTIONS:
1. Import into MetaMask: MetaMask → Import Account → Paste Private Key
2. Use in code: Add to .env.local as X402_PAYMENT_PRIVATE_KEY

⚠️  KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT!
`

  console.log(`💾 Would you like to create a backup file? (${backupFile})`)
  console.log('   This file will contain your private key - keep it secure!')
  console.log('   (File will NOT be created automatically - you must do it manually)')
  console.log('')
  console.log('   To create backup file manually, run:')
  console.log(`   node -e "require('./scripts/backup-payment-wallet.js'); fs.writeFileSync('payment-wallet-backup.txt', backupContent)"`)
}

backupPaymentWallet()

