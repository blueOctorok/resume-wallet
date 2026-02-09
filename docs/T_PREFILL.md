### Client-specific API: Driver Application Prefill

- Hidden from Swagger (private client endpoint)
- Authentication: send your API key in header `api-key: d046586d84af4ce8872305efce307b4c`

### Endpoint

- POST `/applications/driver/prefill`

### Purpose

Given a resume at an IPFS CID or URL, extract structured driver application fields in a single JSON object. Unknown fields are returned as null; the model does not guess.

### Request

- Headers:
  - `api-key`: d046586d84af4ce8872305efce307b4c
  - `Content-Type: application/json`
- Body (one of):
  - cid: IPFS hex CID
  - resume_url: absolute URL or local server path for smoke-tests
- Examples:

```json
{
  "cid": "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

```json
{
  "resume_url": "https://ipfs.io/ipfs/QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

```json
{
  "resume_url": "/static/resume-sample.txt"
}
```

### Response

- 200 OK
- Body

```json
{
  "application": {
    "fullName": "John Doe",
    "email": "john.doe@example.com",
    "phone": "(415) 555-0123",
    "address": "1234 Market St, San Francisco, CA 94103",
    "dateOfBirth": "1990-05-14",
    "licenseNumber": "D1234567",
    "licenseState": "CA",
    "endorsements": ["HazMat", "Tanker"],
    "workHistory": [
      {
        "employer": "ACME Logistics",
        "role": "Driver",
        "startDate": "2018-01",
        "endDate": "2022-03",
        "city": "San Francisco",
        "state": "CA"
      }
    ]
  },
  "raw": "Model reply (human-readable or empty if strict JSON-only)",
  "vector_store_id": "local:resumes",
  "file_id": "ae85daf556367699"
}
```

- Notes:
  - `vector_store_id` reflects the local vector store namespace.
  - `file_id` is a short document hash for traceability (format may vary).

### Field schema (what we return)

- application.fullName: string|null
- application.email: string|null
- application.phone: string|null
- application.address: string|null
- application.dateOfBirth: string|null (prefer ISO-8601: YYYY-MM-DD)
- application.licenseNumber: string|null
- application.licenseState: string|null (2-letter US state if applicable)
- application.endorsements: string[]|null (e.g., HazMat, Tanker)
- application.workHistory: array|null of objects:
  - employer: string|null
  - role: string|null
  - startDate: string|null (YYYY-MM or YYYY-MM-DD when available)
  - endDate: string|null (YYYY-MM or YYYY-MM-DD when available)
  - city: string|null
  - state: string|null

Note: All fields default to null if not explicitly found. No guessing.

### Operating mode

- Runs entirely locally:
  - Resume is parsed on-box (no third‑party upload).
  - Text is chunked and embedded into a local vector store to retrieve the most relevant sections before extraction.
  - Response includes `"vector_store_id": "local:resumes"` and a short hash `"file_id"`.

### Supported resume formats

- Supported:
  - text/plain.
  - PDF (text extraction via pypdf)
  - DOCX (Word) via python-docx
- Scanned PDFs (images) supported when OCR is enabled
- Tip: text-based PDFs generally produce the best extraction quality.

### Examples

- cURL (IPFS CID)

```bash
curl -X POST "$BASE_URL/applications/driver/prefill" \
  -H "api-key: <YOUR_CLIENT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"cid":"QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}'
```

- cURL (direct URL)

```bash
curl -X POST "$BASE_URL/applications/driver/prefill" \
  -H "api-key: <YOUR_CLIENT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"resume_url":"https://ipfs.io/ipfs/QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}'
```

- JavaScript (fetch)

```javascript
const res = await fetch(`${BASE_URL}/applications/driver/prefill`, {
  method: 'POST',
  headers: {
    'api-key': CLIENT_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    resume_url: 'https://ipfs.io/ipfs/QmXXXXXXXXXXXXXXXXXXXXXXXXX',
  }),
})
const data = await res.json()
// data.application contains prefill fields
```

- Python (requests)

```python
import requests

r = requests.post(
    f"{BASE_URL}/applications/driver/prefill",
    headers={"api-key": CLIENT_API_KEY, "Content-Type": "application/json"},
    json={"resume_url": "https://ipfs.io/ipfs/QmXXXXXXXXXXXXXXXXXXXXXXXXX"},
    timeout=60,
)
r.raise_for_status()
payload = r.json()
app_fields = payload["application"]
```

### Error handling

- 400 Bad Request: missing input
  - detail: "Provide cid or resume_url"
- 404 Not Found (local file path)
  - detail: "local_file_not_found: <path>"
- 415 Unsupported Media Type:
  - detail: "unsupported_content_type: <type>"
- 422 Unprocessable Entity:
  - detail: "pdf_parse_required: install pypdf to parse PDFs locally (...)"
  - detail: "docx_parse_required: install python-docx to parse DOCX locally (...)"
  - detail: "ocr_unavailable: enable Tesseract & install PyMuPDF+pytesseract (...)"
  - detail: "empty_text_after_extraction"
- 500 Internal Server Error:
  - detail: "prefill_failed: <reason>"

Your integration should:

- Treat unknown/absent fields as null.
- Handle 4xx with a user-visible message (e.g., “couldn’t read that file, please upload a text-based PDF”).
- Re-try with a different resume format if needed.

### Quick validation checklist (client side)

- Send the `api-key` header on every call.
- Prefer text-based PDFs or DOCX; scanned PDFs work when OCR is enabled.
- Expect null for unknown fields; the model does not guess.
- Handle and log HTTP 4xx/5xx with the returned `detail`.
