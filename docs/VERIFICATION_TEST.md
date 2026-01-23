# Employment Verification - Testing Steps

## Setup

**Driver Account:**
1. Log in as a driver
2. Go to Driver Hub → DOT Application
3. Fill Form 3 with at least one previous employer
   - Include supervisor phone/email (important!)
4. Save

**Employer Account:**
1. Log in as an employer
2. Go to Employer Hub
3. Make sure you have a company profile

---

## Test Flow

### Step 1: Check Driver View
1. As driver, go to Driver Hub
2. Scroll to "Employment Verification" section
3. ✅ Should see employment history as "Self-Reported"

### Step 2: Employer Initiates Verification
1. As employer, go to Employer Hub
2. Click on an applicant from "Recent Applicants" list
3. Click **"Verify Employment History"** button
4. Select which employment to verify from the list
5. ✅ Should see "Verification request created successfully!"

### Step 3: Record Contact Attempt
1. Scroll to "Employment Verification" section in Employer Hub
2. Find the verification request you just created
3. Click on it → Click "Record Attempt"
4. Fill: method (email/phone), contact info
5. ✅ Status changes to "In Progress"

### Step 4: Previous Employer Responds
1. Get the verification token:
```sql
SELECT verification_token FROM employment_verification_requests ORDER BY created_at DESC LIMIT 1;
```
2. Go to: `http://localhost:3000/verify/<token>`
3. Fill out the form:
   - Your name, title, email
   - Answer all 6 questions
4. Click Submit
5. ✅ Should see success message

### Step 5: Check Results
- **Driver:** Refresh Driver Hub → employment status = "Verified"
- **Employer:** Refresh Employer Hub → can see verification answers

---

## Checklist

- [ ] Driver sees "Employment Verification" section in Driver Hub
- [ ] Employer can click "Verify Employment History" on an applicant
- [ ] Employment selection modal shows driver's employment history
- [ ] Verification request is created
- [ ] Employer can record contact attempts
- [ ] Previous employer portal (`/verify/<token>`) loads correctly
- [ ] Previous employer can submit verification answers
- [ ] Both Driver and Employer see updated results
