# Smart Contracts Architecture Overview

## Overview

Veree is a blockchain-powered platform for verifying professional credentials and driver applications. The system uses two smart contracts to create immutable, verifiable records on-chain while storing sensitive data off-chain via IPFS (InterPlanetary File System).

---

## Smart Contracts

### 1. **ResumeRegistry.sol** - Professional Resume Verification

A production-ready contract for storing and verifying professional resumes on the blockchain.

**Purpose**: Create tamper-proof resume records with role-based verification system.

**Key Features**:

- **Decentralized Storage**: Resumes stored on IPFS, blockchain stores only the hash reference
- **Role-Based Access**: `ADMIN_ROLE` and `VERIFIER_ROLE` for access control (OpenZeppelin AccessControl)
- **Public/Private Resumes**: Users control visibility to employers
- **Verification System**: Authorized verifiers can validate resume authenticity
- **Security**: Pausable, ReentrancyGuard, and hash deduplication

**Core Functions**:

```solidity
addResume(ipfsHash, title, filename, isPublic) → resumeId
updateResume(resumeId, newIpfsHash, newTitle, isPublic)
verifyResume(resumeId, verified, verificationHash, notes)
getUserResumes(address) → resumeId[]
getPublicResumes() → resumeId[]
```

**How It Works**:

1. User uploads resume → Frontend sends to IPFS
2. IPFS returns content hash (CID)
3. Smart contract stores: `{owner, ipfsHash, title, isPublic, isVerified, timestamp}`
4. Verifiers can validate and mark as verified
5. Anyone can query public resumes or verification status

---

### 2. **ProductionDriverRegistry.sol** - DOT Driver Applications

A production-grade contract for managing Department of Transportation (DOT) driver applications with lifecycle tracking.

**Purpose**: Create verifiable, auditable records of driver employment applications.

**Key Features**:

- **Application Lifecycle**: Submit → Verify/Reject workflow
- **Rate Limiting**: Max 10 applications per user prevents spam
- **Time-Based Expiry**: Applications expire after 90 days
- **Rejection Handling**: Rejected applications include reason, can be resubmitted
- **Pagination Support**: Efficient querying for large datasets
- **Hash Uniqueness**: Prevents duplicate submissions

**Core Functions**:

```solidity
submitApplication(applicationHash) → applicationId
updateApplication(applicationId, newHash)
verifyApplication(applicationId)
rejectApplication(applicationId, reason)
getUserApplications(user, offset, limit) → applicationId[]
getApplicationsByStatus(verified, offset, limit) → applicationId[]
```

**How It Works**:

1. Driver completes multi-step form (personal info, employment history, references)
2. Frontend serializes data → generates hash → stores on IPFS
3. Smart contract stores: `{owner, applicationHash, isVerified, isRejected, timestamp}`
4. Employer/Verifier reviews application
5. Verifier approves or rejects with reason on-chain

---

## Frontend Integration

### File Structure

```
src/
├── lib/
│   ├── contract.ts           # Contract addresses & ABIs
│   ├── ipfs.ts               # Pinata IPFS upload logic
│   ├── supabase-db.ts        # Database operations
│   └── base-auth-middleware.ts # Wallet authentication
├── components/
│   ├── ResumeUpload.tsx      # Resume upload UI
│   └── DriverApplication.tsx # DOT application form
└── app/api/
    ├── resumes/route.ts      # Resume API endpoints
    └── users/profile/route.ts # User profile management
```

### How Frontend Connects to Contracts

#### 1. **Configuration** (`src/lib/contract.ts`)

- Exports contract addresses for multiple networks (Base, Base Sepolia, Hardhat)
- Provides human-readable ABIs using ethers.js format strings
- Helper functions: `getContractAddress(chainId)`, `getContractConfig(chainId)`

#### 2. **IPFS Upload Flow** (`src/lib/ipfs.ts`)

```typescript
uploadToIPFS(file) → {ipfsHash, url}
```

- Uses Pinata SDK for reliable IPFS pinning
- Returns content hash for blockchain storage
- Files remain accessible via IPFS gateways

#### 3. **Resume Upload Flow** (`src/components/ResumeUpload.tsx`)

```
User selects file → Validates (PDF/DOC, <10MB)
       ↓
Upload to IPFS via Pinata → Get IPFS hash
       ↓
POST to /api/resumes → Authenticate wallet
       ↓
Save to Supabase DB → Return success
```

#### 4. **Authentication** (`src/lib/base-auth-middleware.ts`)

- Uses Alchemy Account Kit for smart wallet creation
- Verifies wallet signatures for API requests
- Creates JWT tokens for authenticated sessions
- No passwords needed—wallet signature proves ownership

#### 5. **API Layer** (`src/app/api/resumes/route.ts`)

```typescript
POST /api/resumes
├── Verify wallet signature
├── Upsert user in Supabase
├── Store resume metadata (title, IPFS hash, user_id)
└── Return resume record

GET /api/resumes
├── Verify wallet signature
├── Query user's resumes from Supabase
└── Return resume list
```

#### 6. **Database (Supabase)** (`src/lib/supabase-db.ts`)

- Off-chain storage for:
  - User profiles (wallet address, name, email)
  - Resume metadata (title, filename, IPFS hash)
  - Driver applications (serialized form data)
- Provides fast queries without blockchain gas costs
- Blockchain acts as verification layer

---

## Architecture Benefits

### **Hybrid Approach**

- **On-Chain**: Immutable proof of existence, verification status, ownership
- **Off-Chain (IPFS)**: Actual document storage, content addressable
- **Database (Supabase)**: Fast queries, user profiles, metadata

### **Security**

- **OpenZeppelin**: Battle-tested security contracts (AccessControl, Pausable, ReentrancyGuard)
- **Wallet Authentication**: No passwords to leak, cryptographic signatures
- **Content Integrity**: IPFS content-addressed storage ensures files can't be altered
- **Role-Based Access**: Only authorized verifiers can approve credentials

### **Cost Efficiency**

- Storing full documents on-chain would cost thousands in gas fees
- Storing only hashes costs pennies
- Database handles high-frequency reads without gas costs

### **User Experience**

- **Smart Wallets**: Alchemy Account Kit creates wallets from email/social login
- **Gasless Transactions**: Paymaster sponsors gas fees for users
- **Web2 UX**: Users don't need to understand blockchain to use it

---

## Technology Stack

**Smart Contracts**:

- Solidity 0.8.20
- OpenZeppelin Contracts (AccessControl, Pausable, ReentrancyGuard)
- Hardhat (development & testing)

**Frontend**:

- Next.js 15 (React 19)
- TypeScript
- Alchemy Account Kit (smart wallets)
- Tailwind CSS v4

**Storage**:

- IPFS via Pinata (decentralized file storage)
- Supabase (PostgreSQL database)

**Blockchain**:

- Base Sepolia (testnet)
- Base Mainnet (production)

---

## Real-World Impact

This architecture demonstrates:

1. **Production-ready blockchain integration** in a real-world hiring use case
2. **Hybrid on-chain/off-chain** design for cost-effective, scalable solutions
3. **Enterprise security** with role-based permissions and auditable verification
4. **Web2-like UX** while maintaining Web3 benefits (ownership, immutability, transparency)

The system solves a critical problem: **verifying professional credentials without centralized gatekeepers**, making hiring more transparent and reducing fraud in the trucking/logistics industry.

---

## Developer Notes

**Testing Contracts**:

```bash
npx hardhat test                    # Run contract tests
npx hardhat node                    # Local blockchain
npx hardhat run scripts/deploy.js   # Deploy to local/testnet
```

**Environment Variables Required**:

```
NEXT_PUBLIC_ALCHEMY_API_KEY         # For smart wallet creation
NEXT_PUBLIC_CONTRACT_ADDRESS        # Deployed contract address
NEXT_PUBLIC_PINATA_JWT              # IPFS upload credentials
NEXT_PUBLIC_SUPABASE_URL            # Database connection
NEXT_PUBLIC_SUPABASE_ANON_KEY       # Database auth
```

**Key Learning Outcomes**:

- Smart contract design patterns (factory, registry, role-based access)
- Hybrid architecture (on-chain verification + off-chain storage)
- Production security considerations (reentrancy, access control, pausability)
- Frontend integration with Web3 wallets and blockchain networks
- Cost optimization strategies (IPFS for large data, selective on-chain storage)
