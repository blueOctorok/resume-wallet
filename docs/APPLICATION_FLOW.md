# Application Flow Documentation

## 🎯 Overview

This document defines the **correct application flow** for the Resume Wallet platform. This flow has been carefully designed to maximize cost efficiency, prevent spam, and provide a production-ready user experience.

## 🚀 The Correct Flows: Hybrid Approach

**We use different flows for different use cases:**

### **Flow 1: Hash-First (For File Uploads - Resumes)**

This flow prevents expensive IPFS uploads for spam files:

```
1. 🔢 Calculate SHA-256 hash locally (FREE)
2. 🔍 Database validation (FREE)
   - Rate limiting
   - Payment validation
   - Duplicate hash checking
   - File validation
3. 📁 IPFS upload ($0.10) ← Only for valid files
4. 💾 Database save ($0.001)
5. ⛓️ Blockchain verification ($0.02) ← Async
```

**Used for:** Resume uploads (files that need IPFS storage)

### **Flow 2: DB-First (For Form Submissions - Applications)**

This flow provides instant feedback and better data integrity:

```
1. 🔢 Calculate hash locally
2. 💾 Save to Supabase FIRST (source of truth)
3. ⛓️ Submit to blockchain (server-sponsored gas)
4. 💾 Update DB with blockchain transaction details
```

**Used for:** DOT applications, employment verification forms

### **Why This Order Matters:**

- **FREE operations first** - Spam attempts cost $0
- **Expensive operations last** - Only legitimate files hit IPFS/blockchain
- **Cost efficiency** - Predictable expenses for legitimate uploads
- **Spam prevention** - Database validation stops bad actors early

## 💰 Cost Breakdown

### **Spam Attempts (Cost: $0)**

```
User uploads file
    ↓
Calculate SHA-256 hash locally (FREE)
    ↓
Database checks:
  - Rate limit? ← SPAM STOPPED ($0)
  - Payment valid? ← SPAM STOPPED ($0)
  - Duplicate hash? ← SPAM STOPPED ($0)
  - File valid? ← SPAM STOPPED ($0)
```

### **Legitimate Uploads (Cost: ~$0.121)**

```
✅ All checks passed
    ↓
Upload to IPFS ($0.10) ← Only legitimate files
    ↓
Save to database ($0.001)
    ↓
Blockchain verification (async) ($0.02)
```

## 📁 File Structure

### **Core Files:**

#### **`src/lib/hash-utils.ts`**

- **Purpose**: Local SHA-256 hash calculation
- **Functions**:
  - `calculateFileHash(file: File)` - Calculate hash from file
  - `validateFile(file: File)` - Validate file size/type before hash
- **Cost**: FREE (runs on user's device)

#### **`src/lib/rate-limit.ts`**

- **Purpose**: Simple rate limiting
- **Limits**:
  - 3 uploads per hour per user
  - 5 verifications per day per user
- **Cost**: FREE (in-memory)

#### **`src/lib/pricing.ts`**

- **Purpose**: Pricing logic and eligibility
- **Rules**:
  - 1 free upload per week
  - $1 USDC for additional uploads
- **Cost**: FREE (database queries)

#### **`src/app/api/resumes/upload/route.ts`**

- **Purpose**: Main upload endpoint with hash-first validation
- **Flow**:
  1. Get user from wallet address
  2. Rate limiting check
  3. Pricing eligibility check
  4. File validation
  5. Payment verification (if required)
  6. IPFS upload (only for valid files)
  7. Duplicate hash checking
  8. Database save

#### **`src/app/api/blockchain/verify-resume/route.ts`**

- **Purpose**: Blockchain verification (optional)
- **Flow**:
  1. Validate resume exists in database
  2. Verify user ownership
  3. Mock blockchain verification (TODO: implement real)
  4. Update resume status

#### **`src/components/ResumeUploadWithVerification.tsx`**

- **Purpose**: Main upload component
- **Steps**:
  1. Calculate file hash locally
  2. Upload & database validation
  3. Blockchain verification (optional)

## 🔄 Detailed Flow Explanation

### **Step 1: Local Hash Calculation (FREE)**

```typescript
// User selects file
const file = selectedFile

// Validate file locally
const validation = validateFile(file)
if (!validation.valid) {
  throw new Error(validation.error)
}

// Calculate SHA-256 hash locally
const fileHash = await calculateFileHash(file)
```

**Benefits:**

- ✅ Instant duplicate detection
- ✅ No network cost for spam
- ✅ Fast user feedback

### **Step 2: Database Validation (FREE)**

```typescript
// Check rate limiting
const allowed = uploadRateLimiter.check(userId, 3, 3600000) // 3 per hour

// Check pricing eligibility
const eligibility = await checkUploadEligibility(userId)

// Check for duplicate hash
const existing = await supabase
  .from('resumes')
  .select('id')
  .eq('file_hash', fileHash)
  .single()
```

**Validation Checks:**

- ✅ Duplicate hash detection (primary spam protection)
- ✅ File validation (size, type)
- ✅ Pricing (1 free/week, $1 USDC after)
- ✅ Rate limiting (20 uploads/hour - resource protection)

### **Step 3: IPFS Upload ($0.10)**

```typescript
// Only reached if all validations pass
const ipfsResult = await uploadToIPFS(file)
```

**Why After Validation:**

- ✅ Only legitimate files hit IPFS
- ✅ No wasted IPFS costs on spam
- ✅ Efficient resource usage

### **Step 4: Database Save ($0.001)**

```typescript
const resume = await supabase.from('resumes').insert({
  user_id: user.id,
  file_hash: fileHash, // SHA-256 for duplicate detection
  ipfs_hash: ipfsResult.hash, // IPFS hash for file access
  title: title,
  filename: file.name,
  // ... other fields
})
```

**Storage Strategy:**

- ✅ Store both file hash and IPFS hash
- ✅ File hash for duplicate detection
- ✅ IPFS hash for file access

### **Step 5: Blockchain Verification ($0.02)**

```typescript
// Async blockchain verification
const blockchainResult = await fetch('/api/blockchain/verify-resume', {
  method: 'POST',
  body: JSON.stringify({
    resumeId: resume.id,
    ipfsHash: ipfsResult.hash,
    // ... other data
  }),
})
```

**Benefits:**

- ✅ Async processing (doesn't block user)
- ✅ Optional verification (user gets resume even if fails)
- ✅ Immutable proof of existence

## 🛡️ Security & Protection

### **Spam Prevention:**

1. **Duplicate detection** - File hash checking (primary spam protection)
2. **File validation** - Size and type restrictions
3. **Cost barriers** - $1 USDC after free upload
4. **Rate limiting** - 20 uploads/hour per user (resource protection)

### **Data Integrity:**

1. **File hash** - SHA-256 for duplicate detection
2. **IPFS hash** - Immutable file reference
3. **Blockchain hash** - Immutable verification
4. **User ownership** - Wallet address verification

### **Error Handling:**

- **Graceful degradation** - Resume saved even if blockchain fails
- **User-friendly messages** - Clear error explanations
- **Retry mechanisms** - Rate limit resets automatically

## 🎯 Business Model

### **Revenue Streams:**

1. **Driver uploads** - $1 USDC per additional upload
2. **Employer subscriptions** - $99-499/month (future)
3. **Resume views** - $2.99 per view (future)
4. **Background checks** - $29.99 per driver (future)

### **Cost Structure:**

- **Spam attempts** - $0 (stopped at database)
- **Legitimate uploads** - ~$0.121 total cost
- **Gas sponsorship** - You pay for blockchain transactions
- **IPFS storage** - ~$0.10 per file

## 🚨 Common Mistakes to Avoid

### **❌ Wrong Flow (Don't Do This):**

```
1. Upload to IPFS first
2. Then database validation
3. Then blockchain
```

**Problems:**

- Spam hits expensive IPFS
- Wasted costs on invalid uploads
- Poor user experience

### **✅ Correct Flow (Do This):**

```
1. Calculate hash locally (FREE)
2. Database validation (FREE)
3. IPFS upload (only valid files)
4. Database save
5. Blockchain verification (async)
```

## 🔧 Implementation Notes

### **Database Schema:**

```sql
-- resumes table should have:
file_hash VARCHAR(64)     -- SHA-256 for duplicate detection
ipfs_hash VARCHAR(46)     -- IPFS hash for file access
blockchain_tx_hash VARCHAR(66) -- Blockchain transaction hash
verification_status ENUM('PENDING', 'VERIFIED', 'FAILED')
```

### **Environment Variables:**

```bash
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt
NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS=contract_address
ALCHEMY_BASE_SEPOLIA_URL=your_alchemy_url
```

### **Rate Limiting:**

- **In-memory** for MVP (resets on server restart)
- **Consider Redis** for production scale
- **Per-user limits** using wallet address

## 📊 Monitoring & Analytics

### **Key Metrics to Track:**

1. **Upload success rate** - % of uploads that complete
2. **Spam rejection rate** - % stopped at database validation
3. **Cost per legitimate upload** - Track actual IPFS/blockchain costs
4. **Rate limit hits** - Monitor abuse patterns

### **Cost Monitoring:**

- **IPFS costs** - Track per-file upload costs
- **Blockchain costs** - Monitor gas sponsorship expenses
- **Database costs** - Track query volume and costs

## 🎯 Success Criteria

### **Performance Targets:**

- **Spam attempts cost $0** - All caught at database level
- **Legitimate upload cost ~$0.121** - Predictable per upload
- **Upload success rate >95%** - Reliable for users
- **Rate limit effectiveness** - Prevents abuse

### **User Experience:**

- **Fast validation** - Local hash + database checks
- **Clear pricing** - User knows cost upfront
- **Reliable uploads** - Database-first ensures success
- **Graceful errors** - Helpful error messages

---

## 🚀 Summary

The platform uses a **hybrid approach** with two different flows:

### **For File Uploads (Resumes): Hash-First**
1. **Calculate hash locally** (FREE)
2. **Validate in database** (FREE) - prevents IPFS spam
3. **Upload to IPFS** ($0.10 for valid files)
4. **Save to database** ($0.001)
5. **Verify on blockchain** ($0.02 async)

**Benefits:** Spam costs $0, legitimate uploads cost ~$0.121

### **For Form Submissions (Applications): DB-First**
1. **Calculate hash locally**
2. **Save to database first** (instant success)
3. **Submit to blockchain** (server-sponsored gas)
4. **Update DB with tx details**

**Benefits:** Better UX, instant feedback, data integrity

**Why Different Flows?**
- Files need IPFS storage → hash-first prevents expensive IPFS spam
- Forms don't need IPFS → DB-first provides instant feedback
- Both approaches are correct for their use cases
