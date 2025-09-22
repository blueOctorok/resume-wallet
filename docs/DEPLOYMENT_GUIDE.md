# 🚀 Smart Contract Deployment Guide

## Overview

This guide walks you through deploying the ResumeRegistry smart contract to Base Sepolia testnet for blockchain verification.

## Prerequisites

- ✅ Smart contract compiled (`ResumeRegistry.sol`)
- ✅ Hardhat configuration set up for Base Sepolia
- ✅ Demo private key configured
- ✅ Base Sepolia ETH for gas fees

## Deployment Steps

### 1. Get Base Sepolia ETH

The demo address `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` needs Base Sepolia ETH for gas fees.

**Working Faucets:**

- 🔗 **Alchemy**: https://faucet.quicknode.com/base/sepolia
- 🔗 **Coinbase**: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- 🔗 **Base Bridge**: https://bridge.base.org/deposit

**Manual Steps:**

1. Visit one of the faucet URLs above
2. Connect your wallet or enter the address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
3. Request testnet ETH (usually 0.1-0.5 ETH)
4. Wait 2-5 minutes for confirmation

### 2. Deploy the Contract

Once funded, run the deployment:

```bash
npx hardhat run scripts/deploy-simple.js --network baseSepolia
```

**Expected Output:**

```
🚀 Starting ResumeRegistry deployment to Base Sepolia...
📍 Using demo address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
📝 Deploying ResumeRegistry contract...
✅ ResumeRegistry deployed successfully!
📍 Contract Address: 0x...
👤 Deployer Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
🌐 Network: Base Sepolia
🔗 Explorer: https://sepolia-explorer.base.org/address/0x...
```

### 3. Verify Deployment

- ✅ Contract address updated in `.env.local`
- ✅ Test resume added to verify functionality
- ✅ Contract verified on BaseScan (if API key provided)

## Contract Functions

### Core Functions

- `addResume(ipfsHash, title, filename, isPublic)` - Add new resume
- `getResume(resumeId)` - Get resume details
- `verifyResume(resumeId, verified, verificationHash, notes)` - Verify resume
- `getUserResumes(userAddress)` - Get user's resumes

### Admin Functions

- `addVerifier(verifierAddress)` - Add verification role
- `removeVerifier(verifierAddress)` - Remove verification role
- `pause()` / `unpause()` - Emergency controls

## Integration

### Frontend Integration

1. Update `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env.local`
2. Import contract ABI from `artifacts/contracts/ResumeRegistry.sol/ResumeRegistry.json`
3. Use ethers.js to interact with deployed contract

### Example Usage

```typescript
import { ethers } from 'ethers'
import ResumeRegistryABI from '../artifacts/contracts/ResumeRegistry.sol/ResumeRegistry.json'

const contract = new ethers.Contract(
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
  ResumeRegistryABI.abi,
  provider
)

// Add resume
const tx = await contract.addResume(
  'QmTestHash123456789',
  'Test Resume',
  'test-resume.pdf',
  true
)
```

## Data Flow

```
File Upload → IPFS → Database → Blockchain Verification
```

1. **File Upload**: User uploads resume file
2. **IPFS Storage**: File stored on IPFS, get hash
3. **Database**: Store metadata in Supabase for fast queries
4. **Blockchain**: Store IPFS hash on-chain for immutable verification

## Verification Process

1. **Upload**: Resume uploaded to IPFS
2. **Store**: IPFS hash stored in database + blockchain
3. **Verify**: Verifier checks resume and updates blockchain
4. **Query**: Anyone can verify resume authenticity via blockchain

## Troubleshooting

### Insufficient Funds

```
❌ Insufficient funds for deployment!
💰 Need Base Sepolia ETH for gas fees
```

**Solution**: Get ETH from faucet and wait for confirmation

### Network Issues

```
❌ Network connection failed
```

**Solution**: Check RPC URL in `hardhat.config.js`

### Contract Verification Failed

```
❌ Contract verification failed
```

**Solution**: Ensure BaseScan API key is set in environment

## Next Steps

1. ✅ Deploy contract to Base Sepolia
2. ✅ Test contract functions
3. ✅ Integrate with frontend
4. ✅ Add verification workflow
5. ✅ Deploy to Base Mainnet (production)

## Security Notes

- 🔒 Demo private key is for testing only
- 🔒 Never use demo keys in production
- 🔒 Use hardware wallets for mainnet deployment
- 🔒 Verify all contract interactions

## Resources

- 📖 [Base Documentation](https://docs.base.org)
- 🔗 [Base Sepolia Explorer](https://sepolia-explorer.base.org)
- 🔗 [BaseScan](https://sepolia.basescan.org)
- 🔗 [IPFS Documentation](https://docs.ipfs.io)
