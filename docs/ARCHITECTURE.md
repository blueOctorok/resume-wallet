# DriverAppChain - Technical Architecture

## Overview

Blockchain-powered resume and credential verification platform for CDL drivers and employers.

## Technology Stack

### Frontend

- **Next.js 15** with App Router - Full-stack React framework
- **Tailwind CSS 4** - Styling and responsive design
- **TypeScript** - Type safety and developer experience

### Blockchain

- **Polygon** - Low-cost Ethereum-compatible blockchain
- **Solidity 0.8.19** - Smart contract development
- **Dynamic.xyz** - Seedless wallet integration for user-friendly onboarding

### Database & Storage

- **PostgreSQL** - Relational database for user-friendly data
- **Prisma** - Type-safe database ORM
- **IPFS (Pinata)** - Decentralized file storage for resumes

### Development Tools

- **Hardhat** - Smart contract development and testing
- **Vitest** - Modern testing framework

## Architecture Decisions

### Hybrid Storage Model

**Decision:** Store hashes on-chain, files on IPFS, metadata in PostgreSQL
**Reasoning:**

- Users get normal web app experience (see "resume.pdf" not "QmXd7...")
- Blockchain provides verification and immutability
- PostgreSQL enables fast search and complex queries
- Cost-effective compared to pure on-chain storage

### Why Polygon Over Ethereum

**Decision:** Use Polygon for all transactions
**Reasoning:**

- Gas costs: $0.001 vs $20-100 on Ethereum
- Same development experience (Solidity, MetaMask)
- 2-3 second confirmation times
- Enterprise adoption (Disney, Starbucks)

### Why Dynamic.xyz Over Manual Wallet Integration

**Decision:** Use Dynamic.xyz for wallet connection
**Reasoning:**

- Seedless wallets (email/SMS login) for CDL drivers unfamiliar with crypto
- Handles complex wallet connection edge cases
- Social login options (Google, Apple)
- Professional appearance

## System Components

### Smart Contracts

1. **ResumeRegistry.sol** - Core resume storage and verification
2. **Future:** VerificationManager.sol for employer attestations

### Database Schema

- **Users** - Driver/employer profiles with CDL-specific fields
- **Resumes** - File metadata and blockchain references
- **Future:** Job postings, applications, verifications

### Key Integrations

- **IPFS** - Decentralized file storage via Pinata
- **Blockchain** - Polygon for verification and ownership
- **Wallet** - Dynamic.xyz for user authentication

## Security Considerations

- Personal data stored off-chain only
- IPFS hashes on-chain for verification
- Wallet-based authentication
- File type and size validation

## Scalability Plan

1. **Phase 1:** CDL drivers (current)
2. **Phase 2:** Other transportation roles
3. **Phase 3:** Multi-industry expansion
4. **Phase 4:** AI-powered matching and feedback

## Development Environment

- **Local:** Hardhat local blockchain + local PostgreSQL
- **Testing:** Mumbai testnet + Supabase staging
- **Production:** Polygon mainnet + Supabase production
