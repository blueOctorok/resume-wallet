# Driver Profile – Verification & Test Plan

The **unified driver profile** is the single source of truth for DOT application data, resume data, and AI prefill. Both the app and AI read from / write to it.

---

## 1. Verified Data Flow

### Writing to profile (PUT `/api/driver/profile`)

| Source | When | Mapper | `source` |
|--------|------|--------|----------|
| **DOT Application – Save Progress** | User clicks "Save Progress" or navigates between forms | `form1ToProfile` + `form2ToProfile` + `form3ToProfile` (dot-form-mapper) | `dot_application` |
| **DOT Application – Completion** | User submits final form | Same form mappers | `dot_application` |
| **Resume Builder** | User clicks "Save" | `resumeBuilderToProfile` (profile-mapper) | `resume_builder` |
| **AI prefill (uploaded resume)** | User uploads resume in Form 1, AI extracts | Same form mappers on `prefillData.form1/2/3Data` | `uploaded_resume` |

### Reading from profile (GET `/api/driver/profile`)

| Consumer | When | Mapper | Notes |
|----------|------|--------|-------|
| **DOT Application** | User opens DOT app, forms empty (no localStorage) | `profileToDotApplication` → manual mapping to form1/form2/form3 state | Form 3 = employment, Form 2 = driving |
| **Resume Builder** | User opens Resume Builder | `profileToResumeBuilder` | Prefills personal, CDL, employments, etc. |

### Form ↔ profile mapping (dot-form-mapper)

- **Form 1**: Personal info, residency, CDL → `form1ToProfile` / `profileToForm1`
- **Form 2**: Driving experience, accidents, convictions → `form2ToProfile` / `profileToForm2`
- **Form 3**: Employment history, education, references → `form3ToProfile` / `profileToForm3`

---

## 2. Bug Fixes Applied (Verification Pass)

1. **Completion handler Form 2/3 swap**  
   - **Before**: Completion sync used `employmentHistory` from Form 2 and `drivingRecord` from Form 3.  
   - **After**: Completion uses the same form mappers as Save Progress (`form1ToProfile`, `form2ToProfile`, `form3ToProfile`). Employment comes from Form 3, driving from Form 2.

2. **Prefill → profile sync Form 2/3 swap**  
   - **Before**: AI prefill sync used `form2Data` for employment and `form3Data` for driving.  
   - **After**: Prefill sync uses the same form mappers on `prefillData.form1Data`, `form2Data`, `form3Data`.

---

## 3. Test Plan

### 3.1 DOT first → Resume prefill

1. Sign in as driver.
2. **Reset** (or use a fresh account): clear profile, clear localStorage for forms if needed.
3. Go to **DOT Application** (no resume upload).
4. Fill **Form 1** (name, email, phone, DOB, address, CDL).
5. Fill **Form 2** (e.g. driving experience, optional accidents/convictions).
6. Fill **Form 3** (e.g. 1–2 employers, dates, reason for leaving).
7. Click **Save Progress** (and/or navigate between forms to trigger auto-save).
8. Open **Resume** tab → **Create** (Resume Builder).
9. **Expected**: Resume Builder is prefilled with name, contact, CDL, employments (and anything else we map from profile).
10. **Verify**: Change nothing, click **Save** in Resume Builder, then reopen Resume Builder. Data should persist from profile.

### 3.2 Resume first → DOT prefill

1. Sign in as driver.
2. **Reset** (or use a fresh account).
3. Go to **Resume** → **Create** (Resume Builder).
4. Fill personal info, CDL, 1–2 employments.
5. Click **Save** in Resume Builder.
6. Go to **DOT Application**.
7. **Expected**: Form 1 prefilled (name, contact, CDL). Form 3 employers prefilled from profile. Form 2 driving-related fields prefilled if we have them in profile.
8. **Verify**: Click **Save Progress**, then leave and return to DOT app. Data should persist (from profile + localStorage).

### 3.3 AI prefill (uploaded resume) → profile → Resume Builder

1. Sign in as driver.
2. **Reset** (or use a fresh account).
3. Go to **DOT Application** → **Form 1**.
4. Use **AI Resume Prefill**: upload a resume (PDF/DOC), run prefill.
5. **Expected**: Form 1 (and Form 2/3 if AI extracts them) prefilled. Profile updated with `source: uploaded_resume`.
6. Go to **Resume** → **Create**.
7. **Expected**: Resume Builder prefilled from profile (which was updated by AI prefill).

### 3.4 Profile API (optional)

- **GET** ` /api/driver/profile` with `x-wallet-address: <wallet>`  
  - Expect `200` and `profile` (or `profile: null` if none).
- **PUT** ` /api/driver/profile` with `profileData` + `source`  
  - Expect `200` and updated `profile`.  
- Use a test wallet that has run through 3.1 or 3.2 and confirm stored fields match what you entered.

---

## 4. Files Touched

- `src/app/page.tsx`: completion sync and prefill sync now use form mappers (Form 1/2/3 → profile).
- `src/lib/dot-form-mapper.ts`: form ↔ profile mappers (unchanged logic; used consistently).
- `src/lib/profile-mapper.ts`: profile ↔ DOT app, profile ↔ Resume Builder.
- `src/app/api/driver/profile/route.ts`: GET (read) and PUT (write) profile.

---

## 5. Quick Checklist

- [ ] DOT **Save Progress** writes to profile (`dot_application`).
- [ ] DOT **completion** writes to profile using same form mappers.
- [ ] **Resume Builder** save writes to profile (`resume_builder`).
- [ ] **AI prefill** writes to profile (`uploaded_resume`) via form mappers.
- [ ] **DOT app** prefill on load reads from profile when forms are empty.
- [ ] **Resume Builder** prefill on load reads from profile.
- [ ] **DOT first → Resume** prefills resume from profile.
- [ ] **Resume first → DOT** prefills forms from profile.
