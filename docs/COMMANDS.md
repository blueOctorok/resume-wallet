# Commands Reference

Quick reference for all development commands and tools in DriverAppChain.

## Next.js Commands

### Development

```bash
# Start development server
npm run dev

# Start with Turbopack (faster)
npm run dev --turbo

# Build for production
npm run build

# Start production server
npm start

# Type checking
npx tsc --noEmit

# Lint code
npm run lint
```

### Deployment

```bash
# Deploy to Vercel
vercel

# Deploy production
vercel --prod

# Check deployment status
vercel ls
```

## Prisma Commands

### Database Setup

```bash
# Initialize Prisma (already done)
npx prisma init

# Generate Prisma client (run after schema changes)
npx prisma generate

# Push schema to database (development)
npx prisma db push

# Create and run migrations (production)
npx prisma migrate dev
npx prisma migrate deploy

# Reset database (⚠️ deletes all data)
npx prisma db push --force-reset
```

### Database Management

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Validate schema
npx prisma validate

# Format schema file
npx prisma format

# View database
npx prisma db pull

# Seed database (when you create seed file)
npx prisma db seed
```

### Troubleshooting

```bash
# Fix client generation issues
rm -rf node_modules/.prisma
npx prisma generate

# Fix connection issues
npx prisma db push --force-reset
npx prisma generate
```

## Hardhat Commands

### Basic Operations

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Clean artifacts
npx hardhat clean

# Check contract size
npx hardhat size-contracts

# Get help
npx hardhat help
```

### Local Development

```bash
# Start local blockchain
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost

# Run tasks on local network
npx hardhat --network localhost [task]
```

### Testnet Deployment

```bash
# Deploy to Mumbai testnet
npx hardhat run scripts/deploy.js --network mumbai

# Verify contract on testnet
npx hardhat verify --network mumbai [CONTRACT_ADDRESS]

# Run script on testnet
npx hardhat run scripts/[script-name].js --network mumbai
```

### Production Deployment

```bash
# Deploy to Polygon mainnet
npx hardhat run scripts/deploy.js --network polygon

# Verify on mainnet
npx hardhat verify --network polygon [CONTRACT_ADDRESS]
```

### Console & Debugging

```bash
# Open Hardhat console
npx hardhat console --network [network]

# Gas usage report
npm install hardhat-gas-reporter
# Add to hardhat.config.js and run tests

# Coverage report
npm install solidity-coverage
npx hardhat coverage
```

## Testing Commands

### Frontend Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- Resume.test.tsx

# Run tests matching pattern
npm test -- --grep "upload"
```

### Smart Contract Testing

```bash
# Run all contract tests
npx hardhat test

# Run specific test file
npx hardhat test test/ResumeRegistry.test.js

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Run tests on specific network
npx hardhat test --network mumbai
```

## IPFS/Pinata Commands

### Via Code (using our lib/ipfs.ts)

```javascript
// In your components or API routes
import { uploadToIPFS } from '@/lib/ipfs'

const result = await uploadToIPFS(file)
console.log(result.ipfsHash)
```

### Direct Pinata API (if needed)

```bash
# Upload file via curl
curl -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@resume.pdf"

# List pinned files
curl -X GET "https://api.pinata.cloud/data/pinList" \
  -H "Authorization: Bearer YOUR_JWT"
```

## Dynamic.xyz Commands

### Testing Wallet Connection

```javascript
// In browser console
window.dynamic.isAuthenticated()
window.dynamic.getAuthToken()
window.dynamic.user
```

### Environment Management

```bash
# Check Dynamic.xyz environment
echo $NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID

# Test environment variables
npm run env:check
```

## Git Commands (for project)

### Daily Workflow

```bash
# Check status
git status

# Add changes
git add .

# Commit with message
git commit -m "Add resume upload functionality"

# Push to remote
git push origin main

# Pull latest changes
git pull origin main
```

### Branch Management

```bash
# Create new feature branch
git checkout -b feature/ai-scoring

# Switch branches
git checkout main
git checkout feature/ai-scoring

# Merge feature to main
git checkout main
git merge feature/ai-scoring

# Delete merged branch
git branch -d feature/ai-scoring
```

## Environment Management

### Environment Variables

```bash
# Copy environment template
cp .env.example .env.local

# Check if all env vars are set
npm run env:check

# Load environment in terminal
source .env.local
```

### API Keys Setup

```bash
# Test Dynamic.xyz connection
curl -X GET "https://app.dynamic.xyz/api/v0/environments/$NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID"

# Test Pinata connection
curl -X GET "https://api.pinata.cloud/data/testAuthentication" \
  -H "Authorization: Bearer $PINATA_JWT"
```

## Package Management

### Dependencies

```bash
# Install new package
npm install package-name

# Install dev dependency
npm install -D package-name

# Update all packages
npm update

# Check for outdated packages
npm outdated

# Audit for security issues
npm audit
npm audit fix
```

### Clean Installation

```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force
```

## Database Connection Testing

### PostgreSQL (if using local)

```bash
# Connect to database
psql postgresql://username:password@localhost:5432/driverappchain

# Check tables
\dt

# Quit
\q
```

### Supabase (if using hosted)

```bash
# Test connection via Prisma
npx prisma db pull

# View in Supabase dashboard
# https://app.supabase.com/project/[project-id]
```

## Useful Development Commands

### Quick Setup (new machine)

```bash
# Full project setup
npm install
npx prisma generate
npx hardhat compile
npm run dev
```

### Daily Development Routine

```bash
# Morning startup
git pull origin main
npm install  # if package.json changed
npx prisma generate  # if schema changed
npm run dev

# Pre-commit checks
npm run lint
npm test
npx hardhat test
git add . && git commit -m "Your message"
```

### Troubleshooting

```bash
# Nuclear option - reset everything
rm -rf node_modules .next .cache
npm install
npx prisma generate
npx hardhat clean && npx hardhat compile
npm run dev
```

## Production Deployment

### Pre-deployment Checklist

```bash
# 1. Test everything
npm run build
npm test
npx hardhat test

# 2. Deploy contracts
npx hardhat run scripts/deploy.js --network polygon

# 3. Update environment variables
# Update NEXT_PUBLIC_CONTRACT_ADDRESS in production

# 4. Deploy frontend
vercel --prod
```

### Post-deployment Verification

```bash
# Verify contract on Polygonscan
npx hardhat verify --network polygon [CONTRACT_ADDRESS]

# Test production app
curl https://your-app.vercel.app/api/health

# Monitor logs
vercel logs your-app.vercel.app
```

---

## Quick Reference Cards

### Most Used Commands

```bash
npm run dev          # Start development
npx prisma studio    # Database GUI
npx hardhat test     # Test contracts
git add . && git commit -m "message" && git push
```

### Emergency Commands

```bash
# If something is completely broken:
rm -rf node_modules .next
npm install
npx prisma generate
npx hardhat clean && npx hardhat compile
```

### Environment Quick Check

```bash
# Check if everything is working:
npm run dev          # Should start on localhost:3000
npx hardhat compile  # Should compile contracts
npx prisma generate  # Should generate client
```
