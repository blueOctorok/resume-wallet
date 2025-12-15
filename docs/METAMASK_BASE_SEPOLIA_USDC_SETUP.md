# MetaMask Setup for Base Sepolia USDC

If you sent USDC to MetaMask but don't see it, follow these steps:

## Step 1: Switch MetaMask to Base Sepolia Network

1. Open MetaMask
2. Click the network dropdown (usually shows "Ethereum Mainnet")
3. If "Base Sepolia" is not listed:
   - Click "Add Network" or "Add a network manually"
   - Enter these details:
     - **Network Name:** Base Sepolia
     - **RPC URL:** `https://sepolia.base.org`
     - **Chain ID:** 84532
     - **Currency Symbol:** ETH
     - **Block Explorer:** `https://sepolia.basescan.org`
   - Click "Save"
4. Switch to "Base Sepolia" network

## Step 2: Add USDC Token to MetaMask

1. In MetaMask, click "Import tokens" (usually at the bottom of the assets list)
2. Go to the "Custom Token" tab
3. Enter the **Base Sepolia USDC contract address:**
   ```
   0x036CbD53842c5426634e7929541eC2318f3dCF7e
   ```
4. MetaMask should auto-fill:
   - **Token Symbol:** USDC
   - **Token Decimals:** 6
5. Click "Add Custom Token"
6. Click "Import Tokens"

## Step 3: Verify Transaction

1. Check the transaction on BaseScan:
   - Go to: https://sepolia.basescan.org
   - Search for your MetaMask wallet address
   - Look for the USDC transfer transaction

2. Or use the transaction hash from Veree:
   - When you sent USDC, you should have received a transaction hash
   - Paste it into BaseScan to verify it completed

## Important Notes

- **Base Sepolia USDC address:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Decimals:** 6 (not 18 like ETH)
- **Network:** Base Sepolia (Chain ID: 84532)
- **Testnet:** This is testnet USDC, not real money

## Troubleshooting

**Still don't see USDC?**
1. Double-check you're on Base Sepolia network (not Base Mainnet)
2. Verify the transaction completed on BaseScan
3. Try refreshing MetaMask (sometimes tokens don't appear immediately)
4. Check that you used the correct MetaMask address when sending

**Transaction not showing on BaseScan?**
- Check the transaction hash from Veree's success message
- Verify the recipient address matches your MetaMask address
- Ensure the transaction actually completed (check the Veree transaction history)

