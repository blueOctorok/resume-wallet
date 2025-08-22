# DriverAppChain - Setup Instructions

## Prerequisites

- Node.js 18+ and npm
- Git
- MetaMask or compatible Web3 wallet

## Environment Setup

### 1. Clone and Install

```bash
git clone [your-repo-url]
cd resume-wallet
npm install
```

### 2. Environment Variables

Create `.env.local` with:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/driverappchain"

# Dynamic.xyz Wallet
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID="your_dynamic_env_id"

# Pinata IPFS
PINATA_JWT="your_pinata_jwt"
PINATA_GATEWAY="your_pinata_gateway"

# Blockchain
NEXT_PUBLIC_CONTRACT_ADDRESS="0x..."
PRIVATE_KEY="your_deployer_private_key"
POLYGON_RPC_URL="https://polygon-rpc.com/"
MUMBAI_RPC_URL="https://rpc-mumbai.maticvigil.com/"
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (when you have a database)
npx prisma db push
```

### 4. Smart Contract Setup

```bash
# Compile contracts
npx hardhat compile

# Deploy to testnet
npx hardhat run scripts/deploy.js --network mumbai
```

### 5. Start Development

```bash
npm run dev
```

## Getting API Keys

### Dynamic.xyz

1. Go to [dynamic.xyz](https://dynamic.xyz)
2. Create account and new project
3. Copy Environment ID to `.env.local`

### Pinata (IPFS)

1. Go to [pinata.cloud](https://pinata.cloud)
2. Create account
3. Generate API Key and Gateway URL
4. Add to `.env.local`

### Supabase (Database)

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy database URL to `.env.local`

## Testing

```bash
# Test smart contracts
npx hardhat test

# Test frontend components
npm run test
```

## Deployment

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel deploy
```

## Troubleshooting

### Common Issues

1. **Wallet not connecting:** Check Dynamic.xyz environment ID
2. **File upload failing:** Verify Pinata credentials
3. **Database errors:** Ensure PostgreSQL is running
4. **Contract deployment failing:** Check private key and RPC URL

### Useful Commands

```bash
# Reset database
npx prisma db push --force-reset

# View database
npx prisma studio

# Check contract on explorer
# https://mumbai.polygonscan.com/address/[contract-address]
```
