# Base Deployment Guide

This guide follows the official Base deployment documentation to deploy our ResumeRegistry smart contract to Base networks.

## Prerequisites

1. **Base Sepolia ETH** - Get testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
2. **BaseScan API Key** - Get from [BaseScan API](https://basescan.org/apis) (optional but recommended)
3. **Private Key** - A wallet with Base Sepolia ETH

## Environment Setup

### 1. Configure Environment Variables

Update your `.env.local` file with the following:

```bash
# Base Network Configuration
BASE_RPC_URL="https://mainnet.base.org"
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"

# Deployer Configuration
PRIVATE_KEY="0x...your_private_key_here"
BASESCAN_API_KEY="your_basescan_api_key_here"

# Contract Address (will be updated after deployment)
NEXT_PUBLIC_CONTRACT_ADDRESS="0x..."
```

### 2. Test Deployment Setup

Run the setup script to verify your configuration:

```bash
npm run setup:deployment
```

This will:

- ✅ Check if private key is configured
- ✅ Test connection to Base Sepolia
- ✅ Verify deployer account has ETH
- ✅ Display deployer address and balance

## Deployment Process

### Step 1: Compile Contracts

```bash
npm run compile
```

### Step 2: Deploy Using Base Account SDK (Recommended)

This simulates the exact user experience drivers will have:

```bash
npm run deploy:base-account
```

This will:

- Use Base Account SDK (no seed phrase needed)
- Authenticate with Base Account
- Deploy ResumeRegistry contract to Base Sepolia
- Test contract interactions using Base Account
- Simulate the driver experience

### Step 3: Deploy with Traditional Method (Alternative)

```bash
npm run deploy:base-sepolia
```

This will:

- Deploy ResumeRegistry contract to Base Sepolia
- Wait for 6 block confirmations
- Verify contract on BaseScan
- Display deployment summary

### Step 3: Update Frontend Configuration

After successful deployment, update your `.env.local`:

```bash
NEXT_PUBLIC_CONTRACT_ADDRESS="0x...deployed_contract_address"
```

### Step 4: Test User Experience

Test the exact flow drivers will use:

```bash
npm run test:user-experience
```

This will:

- Simulate driver authentication with Base Account SDK
- Test resume upload and blockchain interaction
- Verify the complete user journey
- Show exactly how drivers will use the app

### Step 5: Test Contract Interaction (Alternative)

```bash
npm run interact
```

This will test basic contract functions on Base Sepolia.

## Production Deployment

### Deploy to Base Mainnet

⚠️ **Only deploy to mainnet after thorough testing on testnet!**

```bash
npm run deploy:base
```

## Contract Verification

### Manual Verification

If automatic verification fails, you can manually verify:

```bash
# Base Sepolia
npm run verify:base-sepolia

# Base Mainnet
npm run verify:base
```

### Verification Parameters

- **Contract Address**: The deployed contract address
- **Constructor Arguments**: `[]` (empty array for ResumeRegistry)
- **Compiler Version**: `0.8.20`
- **Optimization**: Enabled (200 runs)

## Contract Addresses

### Base Sepolia (Testnet)

- **Contract**: `0x...` (update after deployment)
- **Explorer**: [Base Sepolia Explorer](https://sepolia-explorer.base.org)
- **Faucet**: [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

### Base Mainnet (Production)

- **Contract**: `0x...` (update after deployment)
- **Explorer**: [Base Explorer](https://base.blockscout.com)

## Troubleshooting

### Common Issues

1. **"Insufficient funds"**
   - Get Base Sepolia ETH from faucet
   - Check deployer address has enough ETH

2. **"Contract verification failed"**
   - Wait a few minutes and try again
   - Check constructor arguments are correct
   - Verify compiler version matches

3. **"Network connection failed"**
   - Check RPC URL is correct
   - Verify network is accessible
   - Try alternative RPC endpoints

### Getting Help

- [Base Documentation](https://docs.base.org)
- [Base Discord](https://discord.gg/buildonbase)
- [BaseScan Support](https://basescan.org/support)

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use environment variables** for sensitive data
3. **Test thoroughly** on testnet before mainnet
4. **Verify contracts** on BaseScan for transparency
5. **Keep private keys secure** and backed up safely

## Next Steps

After successful deployment:

1. **Update frontend** with new contract address
2. **Test all functions** using the interaction script
3. **Integrate with Base Account SDK** for wallet connections
4. **Deploy to production** when ready
5. **Monitor contract** on BaseScan for activity

## Deployment Commands Summary

```bash
# Setup and verification
npm run setup:deployment

# Compile contracts
npm run compile

# Deploy to testnet
npm run deploy:base-sepolia

# Deploy to mainnet
npm run deploy:base

# Test interactions
npm run interact

# Manual verification
npm run verify:base-sepolia
npm run verify:base
```
