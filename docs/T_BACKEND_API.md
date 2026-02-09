# T Backend General API Documentation

**Base URL**: `https://api-v3.fluxpointstudios.com` (v3 endpoints)  
**Legacy Base URL**: `https://api.fluxpointstudios.com` (some endpoints)  
**OpenAPI Spec**: `/openapi.json` (fetch for exact request/response schemas)  
**Authentication**: Add `api-key` header to all requests

## 🔐 Authentication

All API requests require authentication using an API key:

- Add an `api-key` header to your requests with the API key value
- Example: `api-key: YOUR_API_KEY_HERE`
- Your API key: `d046586d84af4ce8872305efce307b4c`

## 📖 Getting Exact Schemas

For **exact request/response formats**, fetch the OpenAPI spec:

```javascript
const openApiSpec = await fetch(
  'https://api-v3.fluxpointstudios.com/openapi.json'
)
const schemas = await openApiSpec.json()
// Use schemas to see exact field names, types, and requirements
```

**Interactive Documentation:**

- **Swagger UI**: `https://api-v3.fluxpointstudios.com/docs`
- **ReDoc**: `https://api-v3.fluxpointstudios.com/redoc`

---

## 📚 Complete Endpoint List

### Chat & AI Assistant

- **POST `/chat`** - Chat with the AI assistant (main endpoint)

### File Management

- **POST `/files/upload`** - Upload file directly
- **POST `/files/upload-url`** - Upload file from URL
- **POST `/files/vector-stores`** - Create vector store
- **GET `/files/vector-stores`** - List all vector stores
- **GET `/files/vector-stores/by-name/{name}`** - Get vector store by name
- **DELETE `/files/vector-stores/{vector_store_id}`** - Delete vector store
- **POST `/files/vector-stores/{vector_store_id}/files`** - Add file to vector store
- **GET `/files/vector-stores/{vector_store_id}/files`** - List files in vector store

### Background Tasks

- **POST `/background/create`** - Create background response/task
- **GET `/background/{response_id}`** - Get response status
- **POST `/background/{response_id}/cancel`** - Cancel response
- **GET `/background/{response_id}/stream`** - Stream response events
- **GET `/background/sse/chat`** - Stream chat (SSE)
- **GET `/background/`** - List background responses
- **POST `/background/cleanup`** - Cleanup old responses

### Image Generation & Editing

- **POST `/images/generate`** - Generate new image
- **POST `/images/edit`** - Edit image
- **POST `/images/variations`** - Create image variations
- **POST `/images/upload-and-edit`** - Upload and edit image
- **POST `/images/edit/{session_id}`** - Continue editing session
- **GET `/images/session/{session_id}`** - Get editing session
- **DELETE `/images/session/{session_id}`** - Delete editing session
- **GET `/images/_debug/config`** - Debug images config

### Knowledge Graphs

- **GET `/graph/accessible`** - Get accessible graph list
- **GET `/graph/{graph_id}/facts`** - Get facts from graph
- **POST `/graph/{graph_id}/facts`** - Add facts to graph
- **DELETE `/graph/{graph_id}/facts/{fact_id}`** - Delete fact
- **GET `/graph/{graph_id}/query`** - Query graph
- **GET `/graph/{graph_id}/sessions`** - List graph sessions
- **POST `/graph/{graph_id}/consolidate`** - Consolidate graph
- **POST `/graph/facts/update`** - Update fact
- **DELETE `/graph/facts/{fact_id}`** - Delete fact (alternative endpoint)
- **GET `/graph/facts/{fact_id}`** - Get fact details
- **GET `/graph/data`** - Get graph data
- **GET `/graph/debug`** - Debug memory
- **POST `/graph/sessions/map`** - Map session to graph
- **GET `/graph/search`** - Search graph
- **POST `/graph/reprocess/session/{session_id}`** - Reprocess session
- **POST `/graph/reprocess/graph/{graph_id}`** - Reprocess graph
- **POST `/graph/migrate/session`** - Migrate session copy
- **GET `/graph/memory/{memory_id}`** - Get memory details
- **GET `/graph/{graph_id}/nodes/{node_id}`** - Get node details
- **GET `/graph/{graph_id}/edges/{edge_id}`** - Get edge details

### Token Analysis

- **POST `/token-analysis`** - Token analysis (cryptocurrency risk assessment)

### Masumi (Inference)

- **GET `/availability`** - Masumi availability check
- **POST `/start_job`** - Start new inference job
- **GET `/status`** - Get job status

### Payments

- **POST `/payments/cardano/build`** - Build Cardano payment
- **POST `/payments/cardano/submit`** - Submit Cardano payment
- **GET `/payments/status/{invoice_id}`** - Get payment status
- **POST `/payments/base/notify`** - Base payment notification

### System

- **GET `/health`** - Health check
- **GET `/api`** - API information
- **GET `/v1/protected`** - Protected resource (x402 payments)
- **GET `/v1/protected-python`** - Protected resource (Python x402, Cardano supported)

---

## 📚 Detailed Endpoint Documentation

> **Note**: Request/response formats below are **examples**. For exact schemas, fetch `/openapi.json` or use the interactive docs at `/docs` or `/redoc`.

### 1. Chat & AI Assistant

**POST `/chat`**

Main chat endpoint with advanced AI capabilities, memory, and context awareness.

**Request Schema** (from OpenAPI - verify with `/openapi.json`):

```json
{
  "message": "What is the Cardano blockchain?",
  "session_id": "user123"
}
```

**Response Schema** (from OpenAPI - verify with `/openapi.json`):

```json
{
  "reply": "Cardano is a proof-of-stake blockchain platform...",
  "session_id": "user123"
}
```

> ⚠️ **Important**: The exact field names and structure may differ. Always check `/openapi.json` or use the interactive docs for the current schema.

**Use Cases:**

- Applicant Q&A chatbot
- Application help/guidance
- Compliance questions
- General driver assistance

**Example:**

```javascript
const response = await fetch('https://api-v3.fluxpointstudios.com/chat', {
  method: 'POST',
  headers: {
    'api-key': 'd046586d84af4ce8872305efce307b4c',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'What qualifications do I need for a CDL-A license?',
    session_id: 'user123',
  }),
})
```

---

### 2. File Management

#### Upload File from URL

**POST `/files/upload-url`**

Upload files from a URL for analysis.

**Request Schema** (verify with `/openapi.json`):

```json
{
  "url": "https://example.com/document.pdf"
}
```

**Response Schema** (verify with `/openapi.json`):

```json
{
  "file_id": "ae85daf556367699",
  "filename": "document.pdf",
  "size": 1024000,
  "content_type": "application/pdf"
}
```

> ⚠️ **Note**: Exact field names may differ. Check `FileUploadResponse` schema in OpenAPI spec.

#### Create Vector Store

**POST `/files/vector-stores`**

Create a vector store for document search.

**Request:**

```json
{
  "name": "my_docs",
  "description": "My document collection"
}
```

**Response:**

```json
{
  "id": "vs_123456",
  "name": "my_docs",
  "description": "My document collection"
}
```

#### List Vector Stores

**GET `/files/vector-stores`**

List all vector stores.

**Response:**

```json
{
  "stores": [
    {
      "id": "vs_123456",
      "name": "my_docs",
      "description": "My document collection"
    }
  ]
}
```

#### Add Files to Vector Store

**POST `/files/vector-stores/{id}/files`**

Add files to a vector store for search.

**Request:**

```json
{
  "file_id": "ae85daf556367699"
}
```

**Use Cases:**

- Resume search across multiple documents
- Application review
- Document intelligence
- Knowledge base search

**Example Workflow:**

```javascript
// 1. Upload resume
const uploadRes = await fetch(
  'https://api-v3.fluxpointstudios.com/files/upload-url',
  {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://ipfs.io/ipfs/QmXXXX...' }),
  }
)
const { file_id } = await uploadRes.json()

// 2. Create vector store
const storeRes = await fetch(
  'https://api-v3.fluxpointstudios.com/files/vector-stores',
  {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'resumes', description: 'Driver resumes' }),
  }
)
const { id: storeId } = await storeRes.json()

// 3. Add file to store
await fetch(
  `https://api-v3.fluxpointstudios.com/files/vector-stores/${storeId}/files`,
  {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id }),
  }
)

// 4. Search in chat
const chatRes = await fetch('https://api-v3.fluxpointstudios.com/chat', {
  method: 'POST',
  headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Search my documents for information about CDL licenses',
    session_id: 'user123',
  }),
})
```

---

### 3. Background Tasks

**POST `/background/create`**

Create long-running background tasks without timeouts.

**Request:**

```json
{
  "model": "o3",
  "input": "Write a comprehensive analysis of this driver application..."
}
```

**Response:**

```json
{
  "id": "bg_123456",
  "status": "pending"
}
```

#### Poll Task Status

**GET `/background/{id}`**

Check the status of a background task.

**Response:**

```json
{
  "id": "bg_123456",
  "status": "completed",
  "output_text": "Analysis complete...",
  "progress": 100
}
```

**Task Statuses:**

- `pending` - Task is queued
- `running` - Task is processing
- `completed` - Task finished successfully
- `failed` - Task encountered an error

#### Cancel Task

**POST `/background/{id}/cancel`**

Cancel a running background task.

#### Stream Task Events

**GET `/background/{id}/stream`**

Stream real-time events from a background task.

**Use Cases:**

- Application review (long-running analysis)
- Compliance checks
- Fraud detection
- Document processing
- Batch operations

**Example:**

```javascript
// Create background task
const bgTask = await fetch(
  'https://api-v3.fluxpointstudios.com/background/create',
  {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'o3',
      input:
        'Review this driver application for DOT compliance and flag any issues.',
    }),
  }
)
const { id } = await bgTask.json()

// Poll for results
const pollInterval = setInterval(async () => {
  const status = await fetch(
    `https://api-v3.fluxpointstudios.com/background/${id}`,
    {
      headers: { 'api-key': API_KEY },
    }
  )
  const data = await status.json()

  if (data.status === 'completed') {
    clearInterval(pollInterval)
    console.log('Analysis:', data.output_text)
  } else if (data.status === 'failed') {
    clearInterval(pollInterval)
    console.error('Task failed:', data.error)
  }
}, 5000) // Poll every 5 seconds
```

---

### 4. Image Generation & Editing

**POST `/images/generate`**

Generate new images from text descriptions.

**Request:**

```json
{
  "prompt": "A professional driver's license photo",
  "size": "1024x1024"
}
```

**POST `/images/edit`**

Edit existing images with prompts.

**POST `/images/upload-and-edit`**

Upload and edit images directly.

**Use Cases:**

- Generate profile images
- Document image editing
- Visual content creation

---

### 5. Knowledge Graphs

**GET `/graph/accessible`**

List accessible knowledge graphs.

**GET `/graph/{id}/facts`**

Query graph facts.

**POST `/graph/{id}/facts`**

Add facts to graph.

**POST `/graph/{id}/consolidate`**

Consolidate graph knowledge.

**Use Cases:**

- Employer intelligence
- Industry knowledge
- Relationship mapping
- Data connections

---

## 🔧 Available Tools

T Backend has access to the following capabilities:

- **Token Analysis**: Cryptocurrency risk assessment
- **Image Recognition**: Identify entities and analyze images
- **Web Search**: Real-time information retrieval
- **File Search**: Search through uploaded documents
- **Image Generation**: Create and edit images from text

---

## 📖 Interactive Documentation

- **Swagger Docs**: `/docs` (when available)
- **ReDoc**: `/redoc` (when available)

---

## 💡 Quick Start Examples

### Basic Chat

```javascript
const response = await fetch('https://api-v3.fluxpointstudios.com/chat', {
  method: 'POST',
  headers: {
    'api-key': 'd046586d84af4ce8872305efce307b4c',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'What is the Cardano blockchain?',
    session_id: 'user123',
  }),
})
const data = await response.json()
console.log(data.reply)
```

### File Search Example

```javascript
// 1. Create vector store
const store = await fetch(
  'https://api-v3.fluxpointstudios.com/files/vector-stores',
  {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'my_docs',
      description: 'My document collection',
    }),
  }
)
const { id } = await store.json()

// 2. Upload file
const fileRes = await fetch(
  'https://api-v3.fluxpointstudios.com/files/upload-url',
  {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/document.pdf' }),
  }
)
const { file_id } = await fileRes.json()

// 3. Add to vector store
await fetch(
  `https://api-v3.fluxpointstudios.com/files/vector-stores/${id}/files`,
  {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id }),
  }
)

// 4. Search in chat
const searchRes = await fetch('https://api-v3.fluxpointstudios.com/chat', {
  method: 'POST',
  headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Search my documents for information about AI',
    session_id: 'user123',
  }),
})
```

---

## 🚨 Error Handling

Common HTTP status codes:

- **400 Bad Request**: Invalid input
- **401 Unauthorized**: Missing or invalid API key
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

**Error Response Format:**

```json
{
  "error": "Error message",
  "detail": "Additional error details"
}
```

---

## 📊 Rate Limits

- Check with T Backend team for current rate limits
- Use background tasks for long-running operations
- Implement retry logic with exponential backoff

---

## 🔗 Support

For API access or support, contact Flux Point Studios:

- Email: support@fluxpointstudios.com
- Discord: https://discord.gg/MfYUMnfrJM

---

## 📋 Available Schemas (from OpenAPI)

The following schemas are defined in the OpenAPI spec (`/openapi.json`). Use these to understand exact request/response formats:

- `ChatRequest` - Chat endpoint request
- `ChatResponse` - Chat endpoint response
- `BackgroundResponseCreate` - Background task creation
- `FileUploadResponse` - File upload response
- `VectorStoreCreate` - Vector store creation
- `VectorStoreResponse` - Vector store response
- `FileToVectorStore` - Add file to vector store
- `ImageGenerateRequest` - Image generation request
- `ImageEditRequest` - Image edit request
- `ImageResponse` - Image response
- `ImageVariationRequest` - Image variation request
- `TokenAnalysisRequest` - Token analysis request
- `SessionGraphMap` - Map session to graph
- `ConsolidateRequest` - Graph consolidation
- `FactUpdate` - Update fact in graph
- `StartJobRequest` - Masumi job start
- `StartJobResponse` - Masumi job response
- `StatusResponse` - Status response
- `CardanoBuildBody` - Cardano payment build
- `CardanoSubmitBody` - Cardano payment submit
- `PaymentStatus` - Payment status
- `BaseNotifyBody` - Base payment notification
- `HTTPValidationError` - Validation error response
- `ValidationError` - Validation error details

**To get exact schemas:**

```javascript
const response = await fetch('https://api-v3.fluxpointstudios.com/openapi.json')
const spec = await response.json()
// Access schemas via spec.components.schemas
```

## 📝 Notes

- **All endpoints require the `api-key` header**
- **Base URL**: Most endpoints use `https://api-v3.fluxpointstudios.com`
- **Legacy Base URL**: Some endpoints may use `https://api.fluxpointstudios.com` (check docs)
- **Content-Type**: `application/json` for POST requests
- **Session IDs**: Help maintain conversation context in chat
- **Vector Stores**: Enable document search across multiple files
- **Background Tasks**: Ideal for operations that take > 30 seconds
- **OpenAPI Version**: 3.1 (OAS 3.1)
- **API Version**: 2.0.1

## ⚠️ Important Warnings

1. **Request/Response Formats**: The examples in this doc are **approximations**. Always verify with `/openapi.json` or the interactive docs.
2. **Base URL Variations**: Some endpoints may use different base URLs. Check the actual endpoint documentation.
3. **Schema Changes**: API schemas may change. Always fetch the latest OpenAPI spec before implementing.
4. **Field Names**: Field names in examples may not match actual API. Use schemas for exact names.
