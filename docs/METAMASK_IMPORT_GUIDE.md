# Import Payment Wallet into MetaMask

## Quick Steps

1. **Open MetaMask** (browser extension or mobile app)

2. **Click your account icon** (top right) → **"Import Account"**

3. **Select "Private Key"** as the import method

4. **Paste your private key:**
   ```
   0x3aadf4c61ed1a87e3565fa27fc4bcdda173a6be5d386df04dc73e6ccef7a8265
   ```

5. **Click "Import"**

6. **Verify the address matches:**
   - Should show: `0x18d60e6064BC398E4cf42e8355f094F0dc193337`
   - If it matches, you're good! ✅

## Detailed Steps with Screenshots

### Step 1: Open MetaMask
- Click the MetaMask extension icon in your browser
- Or open the MetaMask mobile app

### Step 2: Access Import Menu
- Click your account icon (circle with profile picture) in the top right
- Select **"Import Account"** from the dropdown

### Step 3: Choose Import Method
- You'll see options: "JSON File", "Private Key", etc.
- Select **"Private Key"**

### Step 4: Enter Private Key
- Paste or type your private key:
  ```
  0x3aadf4c61ed1a87e3565fa27fc4bcdda173a6be5d386df04dc73e6ccef7a8265
  ```
- ⚠️ **Warning**: MetaMask will warn you about security - this is normal for importing
- Click **"Import"**

### Step 5: Verify
- The wallet should appear in your account list
- Click on it to see the address
- **Verify it matches:** `0x18d60e6064BC398E4cf42e8355f094F0dc193337`

### Step 6: Add Base Network (if not already added)
- Click the network dropdown (top center)
- Select "Add Network" or "Add a network manually"
- Base Mainnet details:
  - **Network Name:** Base
  - **RPC URL:** https://mainnet.base.org
  - **Chain ID:** 8453
  - **Currency Symbol:** ETH
  - **Block Explorer:** https://basescan.org

## After Import

✅ **You can now:**
- View the wallet balance in MetaMask
- Send USDC to it from another wallet
- See transaction history
- Use it as a backup/recovery method

✅ **The wallet will still work in your code:**
- Your `.env.local` file still has the private key
- The payment system will use it automatically
- MetaMask import is just for backup/management

## Security Notes

- ⚠️ **Never share your private key** with anyone
- ⚠️ **This wallet is now in MetaMask** - be careful with permissions
- ⚠️ **Keep MetaMask secure** - use a strong password
- ✅ **You can rename it** in MetaMask to "Payment Wallet" for clarity

## Troubleshooting

**"Invalid private key" error:**
- Make sure you copied the entire key including `0x` prefix
- Check for extra spaces before/after

**Address doesn't match:**
- Double-check you pasted the correct private key
- The address should be: `0x18d60e6064BC398E4cf42e8355f094F0dc193337`

**Can't see Base network:**
- Add Base Mainnet manually (see Step 6 above)
- Or use the Base network selector in MetaMask

## Next Steps

After importing:
1. ✅ Verify the address matches
2. 💰 Fund it with USDC on Base Mainnet
3. ⛽ Add some Base ETH for gas fees
4. 🔒 Keep the private key backed up securely

