# T Backend Setup Guide

## Overview

T Backend supports **vector stores** and **knowledge graphs** to make T more directed and specific for your use case. All operations are **key-scoped** to your API key, meaning:

- ✅ Your vector stores and knowledge graphs are private to your API key
- ✅ Won't affect other clients using T Backend
- ✅ T will automatically prefer your knowledge when answering questions
- ✅ Everything is isolated and secure

## Quick Start

### 1. Navigate to Admin Panel

Visit `/admin` in your application to access the T Backend Setup interface.

### 2. Run Setup

Click "Run Setup" to initialize:
- **Vector Store**: Creates "trucking-knowledge" vector store
- **Knowledge Graph**: Seeds with 15+ trucking facts (CDL requirements, DOT regulations, endorsements, etc.)

### 3. Done!

T will now automatically use your vector stores and knowledge graphs when answering questions via `/chat`.

## Vector Stores

### What is a Vector Store?

A vector store is a searchable database of documents. When you ask T a question, T searches your uploaded documents and uses relevant sections to provide accurate answers.

### Creating a Vector Store

The setup automatically creates a vector store named "trucking-knowledge". You can also create one programmatically:

```typescript
import { createTruckingVectorStore } from '@/lib/t-backend-vector-store'

const vectorStore = await createTruckingVectorStore()
```

### Uploading Documents

Upload DOT regulations, CDL manuals, employer SOPs, etc.:

```typescript
import { uploadFileToVectorStore } from '@/lib/t-backend-vector-store'

// Upload from URL
await uploadFileToVectorStore(
  vectorStoreId,
  'https://example.com/dot-regulations.pdf'
)
```

### Example Documents to Upload

- DOT Regulations (49 CFR 391, 383)
- State-specific CDL manuals
- FMCSA guidance documents
- Employer policies and procedures
- Hours of Service regulations

### Using Vector Stores in Chat

Once documents are uploaded, T automatically searches them when you ask questions. For example:

```
User: "What are the CDL-A requirements?"
T: "According to your DOT regulations document, CDL-A requires..."
```

## Knowledge Graphs

### What is a Knowledge Graph?

A knowledge graph stores structured facts about entities and their relationships. Think of it as a database of facts that T can query for precise answers.

### Seeded Facts

The setup automatically seeds the knowledge graph with facts about:

- **CDL Requirements**: CDL-A/B requirements, age restrictions, medical certification
- **Endorsements**: H (Hazmat), N (Tank), P (Passenger), S (School Bus), X (Tank + Hazmat)
- **DOT Regulations**: Medical certification rules, hours of service, employment verification
- **State-Specific**: Ohio CDL requirements, Pennsylvania CDL requirements (examples)
- **Application Requirements**: DOT application requirements, employment verification needs

### Adding More Facts

You can add more facts programmatically:

```typescript
import { addFactToGraph } from '@/lib/t-backend-knowledge-graph'

await addFactToGraph(
  graphId,
  'CDL-A license requires passing a skills test in a vehicle matching the license class'
)
```

### Mapping Sessions to Graphs

To make a knowledge graph available to a specific chat session:

```typescript
import { mapSessionToGraph } from '@/lib/t-backend-knowledge-graph'

await mapSessionToGraph(sessionId, graphId)
```

## API Routes

### Setup Vector Store

**POST `/api/t-backend/setup-vector-store`**

Create or get the trucking-knowledge vector store.

**Request:**
```json
{
  "action": "create-only",
  "fileUrls": []
}
```

**Response:**
```json
{
  "success": true,
  "vectorStore": {
    "id": "vs_123456",
    "name": "trucking-knowledge",
    "description": "..."
  },
  "files": []
}
```

### Setup Knowledge Graph

**POST `/api/t-backend/setup-knowledge-graph`**

Seed the knowledge graph with trucking facts.

**Request:**
```json
{
  "graphId": "graph_123456",
  "action": "seed"
}
```

**Response:**
```json
{
  "success": true,
  "graphId": "graph_123456",
  "factsCount": 15,
  "facts": [...]
}
```

### Complete Setup (Admin)

**POST `/api/t-backend/admin/setup`**

One-click setup for both vector store and knowledge graph.

**Request:**
```json
{
  "setupVectorStore": true,
  "setupKnowledgeGraph": true,
  "uploadSampleDocs": false,
  "sampleDocUrls": []
}
```

**Response:**
```json
{
  "success": true,
  "vectorStore": {...},
  "knowledgeGraph": {...},
  "uploadedFiles": []
}
```

## How T Uses Your Knowledge

### Automatic Integration

When you use `/chat`, T automatically:
1. Searches your vector stores for relevant documents
2. Queries your knowledge graphs for structured facts
3. Combines both with general knowledge to provide accurate answers

### Precedence

T prefers your knowledge over general knowledge:
- Your vector stores → General knowledge
- Your knowledge graphs → General knowledge

### Example Flow

```
User: "What endorsements do I need for hazmat?"

T Backend Process:
1. Search vector stores for "hazmat" → Find relevant DOT documents
2. Query knowledge graph for "H Endorsement" → Find structured facts
3. Combine both → Provide accurate answer with citations
```

## Best Practices

### 1. Start with Core Documents

Upload the most important documents first:
- DOT Regulations (49 CFR 391, 383)
- CDL requirements by state
- Hours of Service regulations

### 2. Add Facts Incrementally

Start with the seeded facts, then add more as needed:
- Company-specific policies
- State-specific requirements
- Industry best practices

### 3. Keep Documents Updated

When regulations change, upload updated documents to keep T's knowledge current.

### 4. Use Descriptive Names

Name your vector stores and facts descriptively:
- ✅ "trucking-knowledge"
- ✅ "dot-regulations-2024"
- ❌ "store1"
- ❌ "docs"

## Troubleshooting

### Vector Store Not Found

If you get a "vector store not found" error:
1. Check that setup was run successfully
2. Verify your API key is correct
3. Try running setup again

### Knowledge Graph Not Accessible

If you can't access knowledge graphs:
1. Contact T Backend support to create a knowledge graph
2. Check that your API key has graph access
3. Verify graph ID is correct

### T Not Using Your Knowledge

If T doesn't seem to use your knowledge:
1. Verify documents are uploaded to vector store
2. Check that facts are added to knowledge graph
3. Ensure your API key is being used correctly
4. Try asking more specific questions

## Troubleshooting

### "AI failed, using fallback" / Connect Timeout

If you see in logs:

- `[CAREER SCORE] AI failed, using fallback: TypeError: fetch failed` with `ConnectTimeoutError` or `UND_ERR_CONNECT_TIMEOUT`

then the app cannot reach **T Backend** (the external AI service). Career Score and AvA chat both call `T_BACKEND_BASE_URL` (default `https://api-v3.fluxpointstudios.com`).

**What’s happening:** The request to T Backend is timing out (e.g. after 10–25s). The app still returns a result: Career Score uses a **formula-based fallback** (no AI), and chat may return an error to the user.

**What to check:**

1. **T Backend status** – Confirm the service at `T_BACKEND_BASE_URL` is up and accepting connections.
2. **Network/firewall** – If the app runs on Vercel, in Docker, or behind a firewall, ensure outbound HTTPS to that host is allowed (no block on 443).
3. **Env** – If you use a different AI backend, set `T_BACKEND_BASE_URL` in `.env.local` (e.g. `T_BACKEND_BASE_URL=https://your-ai-api.example.com`). No trailing slash.
4. **AvA chat** – Uses the same backend; if Career Score times out, chat will usually fail too until T Backend is reachable.

## Next Steps

1. ✅ Run setup via `/admin` page
2. 📄 Upload DOT regulation PDFs
3. 📚 Add more facts to knowledge graph
4. 🧪 Test T's responses with trucking questions
5. 🔄 Iterate and improve based on user feedback

## Resources

- [T Backend API Documentation](./T_BACKEND_API.md)
- [Vector Store Utilities](../src/lib/t-backend-vector-store.ts)
- [Knowledge Graph Utilities](../src/lib/t-backend-knowledge-graph.ts)
- [Admin Setup Component](../src/components/admin/TBackendSetup.tsx)

