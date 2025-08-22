# API Documentation

## Overview

DriverAppChain REST API for resume management and blockchain verification.

## Authentication

All endpoints require wallet authentication via Dynamic.xyz.

## Endpoints

### Users

#### GET /api/users/profile

Get current user profile

```typescript
Response: {
  id: string;
  walletAddress: string;
  name?: string;
  cdlNumber?: string;
  // ... other fields
}
```

#### PUT /api/users/profile

Update user profile

```typescript
Request: {
  name?: string;
  cdlNumber?: string;
  cdlState?: string;
  // ... other fields
}
```

### Resumes

#### POST /api/resumes

Upload new resume

```typescript
Request: FormData {
  file: File;
  title: string;
  isPublic: boolean;
}

Response: {
  id: string;
  ipfsHash: string;
  blockchainTxHash?: string;
}
```

#### GET /api/resumes

Get user's resumes

```typescript
Response: Resume[]
```

#### PUT /api/resumes/[id]/visibility

Toggle resume visibility

```typescript
Request: {
  isPublic: boolean
}
```

### Blockchain

#### POST /api/blockchain/deploy-resume

Deploy resume to blockchain

```typescript
Request: {
  resumeId: string
  ipfsHash: string
}

Response: {
  txHash: string
  contractAddress: string
}
```

## Error Responses

```typescript
{
  error: string
  message: string
  statusCode: number
}
```

## Rate Limits

- 100 requests per minute per user
- File uploads: 10 per hour

---

_Note: Add new endpoints as you build them_
