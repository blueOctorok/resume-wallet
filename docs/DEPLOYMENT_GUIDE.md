# Deployment Guide

## Overview

This guide covers deploying our resume wallet platform to Base network, including smart contract deployment, environment configuration, and production setup.

## 🎯 Deployment Strategy

### Network Selection

- **Base Sepolia** - Testing and development
- **Base Mainnet** - Production deployment
- **Local Hardhat** - Development and testing

### Deployment Phases

1. **Development** - Local testing with Hardhat
2. **Testnet** - Base Sepolia deployment and testing
3. **Production** - Base Mainnet deployment
4. **Verification** - Contract verification on BaseScan

## 🔧 Environment Setup

### 1. Required Environment Variables

```bash
# .env.local
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Pinata IPFS
NEXT_PUBLIC_PINATA_GATEWAY=your_pinata_gateway
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt

# Blockchain Configuration - Base Networks Only
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...deployed_contract_address
PRIVATE_KEY=your_deployer_private_key_here
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_api_key_here

# Base Account SDK
NEXT_PUBLIC_PAYMASTER_PROXY_SERVER_URL=your_paymaster_proxy_url

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

### 2. Private Key Configuration

**⚠️ Security Warning**: Never commit private keys to version control!

```bash
# Get Base Sepolia ETH from faucet
# https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

# Add your private key to .env.local
PRIVATE_KEY="0x...your_private_key_here"
```

### 3. BaseScan API Key

```bash
# Get API key from BaseScan
# https://basescan.org/apis

# Add to .env.local
BASESCAN_API_KEY="your_api_key_here"
```

## 🚀 Smart Contract Deployment

### 1. Hardhat Configuration

```javascript
// hardhat.config.js
require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config({ path: '.env.local' })

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    base: {
      url: process.env.BASE_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 84532,
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY,
      baseSepolia: process.env.BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
      {
        network: 'baseSepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
    ],
  },
}
```

### 2. Deployment Script

```javascript
// scripts/deploy.js
const hre = require('hardhat')

async function main() {
  console.log('🚀 Starting ResumeRegistry deployment...')

  // Get the contract factory
  const ResumeRegistry = await hre.ethers.getContractFactory('ResumeRegistry')

  // Deploy the contract
  console.log('📝 Deploying ResumeRegistry...')
  const resumeRegistry = await ResumeRegistry.deploy()
  await resumeRegistry.waitForDeployment()

  const contractAddress = await resumeRegistry.getAddress()
  console.log('✅ ResumeRegistry deployed successfully!')
  console.log('📍 Contract Address:', contractAddress)
  console.log('🌐 Network:', hre.network.name)

  // Wait for confirmations
  console.log('⏳ Waiting for confirmations...')
  await resumeRegistry.deploymentTransaction().wait(6)

  // Verify contract on BaseScan
  if (hre.network.name !== 'hardhat') {
    console.log('🔍 Verifying contract on BaseScan...')
    try {
      await hre.run('verify:verify', {
        address: contractAddress,
        constructorArguments: [],
      })
      console.log('✅ Contract verified on BaseScan!')
    } catch (error) {
      console.log('❌ Verification failed:', error.message)
    }
  }

  console.log('\n🎉 Deployment Summary:')
  console.log(`Contract Address: ${contractAddress}`)
  console.log(`Network: ${hre.network.name}`)
  console.log(
    `Explorer: https://${hre.network.name === 'base' ? 'basescan.org' : 'sepolia.basescan.org'}/address/${contractAddress}`
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  })
```

### 3. Deployment Commands

```bash
# Compile contracts
npm run compile

# Deploy to Base Sepolia (testnet)
npm run deploy:base-sepolia

# Deploy to Base Mainnet (production)
npm run deploy:base

# Verify contract
npm run verify:base-sepolia
npm run verify:base
```

## 🧪 Testing Deployment

### 1. Driver Experience Test

```bash
# Test the complete user experience
npm run test:user-experience
```

This will:

- Simulate driver authentication with Base Account SDK
- Test resume upload and blockchain interaction
- Verify the complete user journey
- Show exactly how drivers will use the app

### 2. Contract Interaction Test

```bash
# Test contract functions
npm run interact
```

This will:

- Test basic contract functions
- Verify resume storage and retrieval
- Check event emission
- Validate contract functionality

## 🌐 Frontend Deployment

### 1. Environment Configuration

```bash
# Production environment variables
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...deployed_contract_address
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_PAYMASTER_PROXY_SERVER_URL=your_production_paymaster_url
```

### 2. Build and Deploy

```bash
# Build for production
npm run build

# Deploy to Vercel/Netlify
npm run deploy
```

### 3. Domain Configuration

```bash
# Update NEXTAUTH_URL for production
NEXTAUTH_URL=https://your-domain.com
```

## 🔒 Security Checklist

### Pre-Deployment

- [ ] Private keys secured and not in version control
- [ ] Environment variables properly configured
- [ ] Contract code reviewed and tested
- [ ] Gas limits and costs calculated
- [ ] BaseScan API key configured

### Post-Deployment

- [ ] Contract verified on BaseScan
- [ ] Frontend deployed and accessible
- [ ] Database connections working
- [ ] IPFS uploads functioning
- [ ] Base Account SDK integration tested
- [ ] Payment flows working
- [ ] Gas sponsorship operational

## 📊 Monitoring & Maintenance

### 1. Contract Monitoring

```javascript
// Monitor contract events
const contract = new ethers.Contract(contractAddress, abi, provider)

contract.on('ResumeAdded', (resumeId, owner, ipfsHash, event) => {
  console.log('New resume added:', {
    resumeId: resumeId.toString(),
    owner,
    ipfsHash,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash,
  })
})
```

### 2. Performance Metrics

- Transaction success rates
- Gas usage optimization
- User engagement metrics
- Payment completion rates
- Error rates and debugging

### 3. Regular Maintenance

- Monitor gas prices and optimize
- Update dependencies regularly
- Review and update security measures
- Backup critical data
- Monitor Base network updates

## 🚨 Troubleshooting

### Common Issues

#### 1. Deployment Failures

```bash
# Check network connection
npx hardhat console --network baseSepolia

# Verify private key
echo $PRIVATE_KEY | wc -c  # Should be 66 characters (0x + 64 hex)

# Check gas prices
npx hardhat run scripts/check-gas.js --network baseSepolia
```

#### 2. Contract Verification Issues

```bash
# Manual verification
npx hardhat verify --network baseSepolia 0x...contract_address

# Check constructor arguments
npx hardhat verify --network baseSepolia 0x...contract_address "arg1" "arg2"
```

#### 3. Frontend Connection Issues

```bash
# Check RPC endpoints
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://sepolia.base.org

# Verify contract address
npx hardhat run scripts/check-contract.js --network baseSepolia
```

## 📈 Scaling Considerations

### 1. Gas Optimization

- Batch multiple operations
- Use gas sponsorship for users
- Optimize contract functions
- Monitor gas prices

### 2. Database Scaling

- Implement connection pooling
- Add database indexes
- Consider read replicas
- Monitor query performance

### 3. IPFS Scaling

- Use multiple pinning services
- Implement caching strategies
- Monitor storage usage
- Plan for data growth

## 🎯 Production Checklist

### Smart Contract

- [ ] Contract deployed to Base Mainnet
- [ ] Contract verified on BaseScan
- [ ] All functions tested and working
- [ ] Gas costs optimized
- [ ] Security audit completed

### Frontend

- [ ] Production build successful
- [ ] Environment variables configured
- [ ] Domain and SSL configured
- [ ] Performance optimized
- [ ] Error handling implemented

### Backend

- [ ] Database production ready
- [ ] API endpoints secured
- [ ] Authentication working
- [ ] File uploads functional
- [ ] Monitoring implemented

### Integration

- [ ] Base Account SDK working
- [ ] Base Pay integration tested
- [ ] Gas sponsorship operational
- [ ] Payment flows verified
- [ ] User experience validated

---

_This deployment guide ensures a smooth transition from development to production with proper security, monitoring, and maintenance procedures._
