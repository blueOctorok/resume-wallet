# AI Resume Prefill - Testing Guide

## Overview

The AI Resume Prefill feature allows users to upload their resume and automatically populate the driver application forms using T Backend AI.

## How to Test

### 1. Navigate to DOT Application Page

1. Start your development server: `npm run dev`
2. Open the app in your browser
3. Sign in with your Alchemy Smart Wallet
4. Click on "DOT Application" in the navigation

### 2. Upload a Resume

You'll see the **AI Resume Prefill** component with:
- File upload area (drag & drop or click)
- "Upload & Prefill with AI" button
- "Skip AI prefill and fill manually" link

**Supported Formats:**
- PDF (text-based, not scanned images)
- DOCX (Microsoft Word)
- TXT (plain text)
- Max size: 10MB

### 3. What Happens After Upload

**Step 1: IPFS Upload**
- Status: "Uploading to IPFS..."
- Your resume is uploaded to Pinata IPFS
- An IPFS CID is generated (e.g., `QmXXXX...`)

**Step 2: AI Extraction**
- Status: "🤖 AI is reading your resume..."
- T Backend downloads the file from IPFS
- AI parses and extracts structured data
- Returns JSON with driver application fields

**Step 3: Form Population**
- Status: "✓ Found X fields from your resume!"
- Shows which fields were extracted (e.g., "Name, Email, Phone, License Number...")
- All 3 forms are instantly populated with extracted data

### 4. Review and Complete Forms

After AI prefill:
- ✨ Green banner: "Forms prefilled with AI! Review and complete any missing fields."
- Navigate through Form 1, 2, 3 using the form navigation buttons
- **Review all fields** - AI may miss some or make errors
- **Fill in missing fields** (SSN, years at address, etc.)
- **Correct any errors** if AI misinterpreted something

### 5. Submit Application

Once all required fields are complete:
- Click "Complete & Submit" on Form 3
- Application is hashed and submitted to Base Sepolia blockchain
- View your driver dashboard after submission

---

## What Gets Extracted

### Form 1: Personal Information & License

**Personal Info:**
- ✅ Full Name (split into first/middle/last)
- ✅ Email
- ✅ Phone
- ✅ Date of Birth
- ✅ Address (parsed into street, city, state, ZIP)

**License Info:**
- ✅ License Number
- ✅ License State
- ✅ Endorsements (e.g., Hazmat, Tanker)

**What's NOT extracted (you must fill in):**
- ❌ SSN (for privacy)
- ❌ Position applied for (defaults to "Commercial Driver")
- ❌ Date available for work (defaults to today)
- ❌ Legal right to work (must select Yes/No)
- ❌ Years at address (must specify)
- ❌ License type/class (must specify)
- ❌ Expiration date

### Form 2: Employment History

**Work History:**
- ✅ Employer name
- ✅ Job role/position
- ✅ Start date
- ✅ End date (or "Present")
- ✅ City and state

**What's NOT extracted:**
- ❌ Reason for leaving
- ❌ Salary
- ❌ Contact person
- ❌ Contact phone
- ❌ Subject to FMCSR (must select Yes/No)
- ❌ Subject to drug test (must select Yes/No)

### Form 3: Accident/Traffic Record

- ❌ Nothing extracted (user must fill manually)
- AI doesn't extract accident or traffic violation history

---

## Testing with Different Resume Formats

### Best Format: Text-Based PDF
```
Upload: driver-resume.pdf (text)
Expected: High accuracy, most fields extracted
```

### Good Format: DOCX
```
Upload: resume.docx
Expected: Good accuracy, most fields extracted
```

### Basic Format: TXT
```
Upload: resume.txt
Expected: Works, but may have lower accuracy due to lack of formatting
```

### NOT Supported: Scanned PDF
```
Upload: scanned-resume.pdf (image)
Expected: Error - "Scanned PDFs not supported yet"
```

---

## Error Scenarios

### Missing File
**Action:** Click "Upload & Prefill" without selecting a file
**Result:** Button is disabled, can't proceed

### Unsupported Format
**Action:** Upload a JPG or PNG file
**Result:** "Please select a PDF, DOC, DOCX, or TXT file"

### File Too Large
**Action:** Upload a 15MB PDF
**Result:** "File size must be less than 10MB"

### Empty Text
**Action:** Upload a blank PDF or corrupted file
**Result:** "Could not extract text from resume. Please ensure it's not a scanned image."

### Scanned PDF (No OCR)
**Action:** Upload a scanned resume (image-based PDF)
**Result:** "Scanned PDFs are not supported yet. Please upload a text-based PDF."

### Network Error
**Action:** Upload while offline
**Result:** "An unexpected error occurred while processing the resume"

---

## Console Debugging

Open browser DevTools Console to see detailed logs:

### Successful Flow
```
📤 [PREFILL] Step 1: Uploading to IPFS...
✅ [PREFILL] IPFS upload successful: QmXXXXXXXXXXXXXXXXX
   Gateway URL: https://peach-actual-caterpillar-797.mypinata.cloud/ipfs/QmXXXX...

🤖 [PREFILL] Step 2: Extracting data with AI...
🤖 [AI PREFILL] Starting resume extraction...
   Input: CID=QmXXXXXXXXXXXXXXXXX
   Calling: https://api-v2.fluxpointstudios.com/applications/driver/prefill

✅ [AI PREFILL] T Backend response received
   Vector Store ID: local:resumes
   File ID: ae85daf556367699

✅ [AI PREFILL] Extracted 8/9 fields:
   Fields: Name, Email, Phone, Date of Birth, Address, License Number, License State, Work History

✅ [HOME] Prefill successful, populating forms
   Fields extracted: 8/9
```

### Error Flow
```
❌ [PREFILL] Error: Unsupported file format. Please upload a text-based PDF, DOCX, or TXT file.
❌ [HOME] Prefill error: Unsupported file format
```

---

## API Testing (Manual)

### Test API Endpoint Directly

```bash
# Test with IPFS CID
curl -X POST http://localhost:3000/api/ai/prefill-resume \
  -H "Content-Type: application/json" \
  -d '{"cid":"QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}'

# Test with direct URL
curl -X POST http://localhost:3000/api/ai/prefill-resume \
  -H "Content-Type: application/json" \
  -d '{"resumeUrl":"https://ipfs.io/ipfs/QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}'
```

### Expected Response

```json
{
  "success": true,
  "form1Data": {
    "firstName": "John",
    "middleName": "Michael",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "(415) 555-0123",
    "dateOfBirth": "1990-05-14",
    "currentMailing": {
      "street": "1234 Market St",
      "city": "San Francisco",
      "state": "CA",
      "zipCode": "94103"
    },
    "currentLicenses": [{
      "licenseNumber": "D1234567",
      "state": "CA",
      "endorsements": "HazMat, Tanker"
    }]
  },
  "form2Data": {
    "employmentHistory": [{
      "employer": "ACME Logistics",
      "position": "Driver",
      "startDate": "2018-01",
      "endDate": "2022-03",
      "address": "San Francisco, CA"
    }]
  },
  "form3Data": {
    "accidentHistory": [],
    "trafficConvictions": []
  },
  "stats": {
    "total": 9,
    "extracted": 8,
    "fieldNames": ["Name", "Email", "Phone", "Date of Birth", "Address", "License Number", "License State", "Work History"]
  }
}
```

---

## Known Limitations

1. **No OCR Support**: Scanned PDFs (images) are not supported yet
2. **Accident History**: AI doesn't extract accident or traffic violation records
3. **Contact Information**: Previous employer contact details are not extracted
4. **Dates Precision**: Some dates may be partial (YYYY-MM instead of YYYY-MM-DD)
5. **Name Parsing**: Middle names may be incorrectly split if unusual formatting
6. **Address Parsing**: Complex addresses may not parse perfectly into street/city/state/zip

---

## Troubleshooting

### Forms Don't Populate After Upload

**Check:**
1. Console for errors
2. Network tab for API response
3. Verify T Backend API key is set in `.env.local`

**Fix:**
- Ensure `T_BACKEND_API_KEY` and `T_BACKEND_BASE_URL` are in `.env.local`
- Restart dev server after adding env vars

### "API not configured" Error

**Cause:** Missing environment variables

**Fix:**
```bash
# Add to .env.local
T_BACKEND_API_KEY="d046586d84af4ce8872305efce307b4c"
T_BACKEND_BASE_URL="https://api-v2.fluxpointstudios.com"
```

### Fields Are Null/Empty

**Cause:** AI couldn't find the information in the resume

**Fix:**
- Ensure resume has clear formatting
- Check if information is actually in the resume
- Fill in missing fields manually

### Wrong Data Extracted

**Cause:** AI misinterpreted resume content

**Fix:**
- Review all extracted fields
- Correct any errors manually
- Consider reformatting resume for better parsing

---

## Next Steps After Testing

Once you've verified the AI prefill works:

1. ✅ Test with multiple resume formats
2. ✅ Verify all extracted fields are accurate
3. ✅ Test error handling (invalid files, network errors)
4. ✅ Complete a full application flow (prefill → review → submit → blockchain)
5. ✅ Test "Upload different resume" functionality
6. ✅ Test "Skip AI prefill" workflow
7. ✅ Verify console logs for debugging

---

## Future Enhancements

- [ ] OCR support for scanned PDFs (requires Tesseract integration)
- [ ] Confidence scores for extracted fields
- [ ] Highlight fields that need review
- [ ] Save extracted data to database for analytics
- [ ] Support for more file formats (RTF, ODT)
- [ ] Multi-language resume support
- [ ] Resume quality scoring
- [ ] Suggested improvements for resume

