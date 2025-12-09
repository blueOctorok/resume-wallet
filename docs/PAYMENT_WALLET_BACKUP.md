# Payment Wallet Backup Guide

## ⚠️ Important: Backup Your Payment Wallet

Your payment wallet private key is stored in `.env.local`, but you should have additional backups in case that file is lost.

## What You Need to Backup

**Private Key:** `0x3aadf4c61ed1a87e3565fa27fc4bcdda173a6be5d386df04dc73e6ccef7a8265`

**Wallet Address:** `0x18d60e6064BC398E4cf42e8355f094F0dc193337`

## Backup Methods

### 1. Password Manager (Recommended)
- Add as a secure note in 1Password, LastPass, Bitwarden, etc.
- Label it: "ResumeWallet Payment Wallet Private Key"
- Include both the address and private key

### 2. Physical Backup
- Write down the private key on paper
- Store in a secure location (safe, safety deposit box)
- Keep multiple copies in different locations

### 3. Encrypted File
- Create an encrypted file (use VeraCrypt, 7-Zip with password, etc.)
- Store the private key in the encrypted file
- Keep the file in a secure location (NOT in your git repo!)

### 4. MetaMask Import (Easy Recovery)
- Import the wallet into MetaMask
- This gives you a visual way to manage and recover it
- Steps: MetaMask → Import Account → Paste Private Key

## How to Recover

### If You Lose `.env.local`:

**Option 1: Import into MetaMask**
1. Open MetaMask
2. Click "Import Account"
3. Paste your private key
4. Wallet is recovered!

**Option 2: Add to New `.env.local`**
1. Create new `.env.local` file
2. Add: `X402_PAYMENT_PRIVATE_KEY="0x3aadf4c61ed1a87e3565fa27fc4bcdda173a6be5d386df04dc73e6ccef7a8265"`
3. Done!

## Current Backup Status

✅ **Primary Backup:** `.env.local` file (already exists)
❓ **Secondary Backup:** You need to create this (choose one method above)

## Security Reminders

- ⚠️ **Never share your private key** with anyone
- ⚠️ **Never commit it to git** (it's in `.gitignore`)
- ⚠️ **Store backups securely** (password manager, encrypted file, physical safe)
- ⚠️ **Keep multiple backups** in different locations

## Quick Backup Command

Run this to see your backup information:
```bash
npm run payment:backup
```

Or manually view:
```bash
node scripts/backup-payment-wallet.js
```

## Recovery Test

To verify your backup works:
1. Import the private key into MetaMask
2. Check that the address matches: `0x18d60e6064BC398E4cf42e8355f094F0dc193337`
3. If it matches, your backup is good!

