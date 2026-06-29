# Production Test — Driver-Owned MVR + PSP (P3.4-C)

Use this after deploying to **production/staging** with real test accounts (Pace workflow).

---

## Pre-deploy checklist

| Env var | Required |
|---------|----------|
| `ACCIO_*` | ✅ TEST or PROD credentials |
| `SCREENING_CONSENT_ENCRYPTION_KEY` | ✅ 32-byte base64 |
| `NEXT_PUBLIC_APP_URL` | ✅ Public URL (Accio webhooks + reconcile cron) |
| `CRON_SECRET` | ✅ Vercel cron reconcile every 5 min |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ |

Employer company must have **`employer-screening-consent`** block installed.

---

## Test flow (real people)

### 1. Employer → request screening

1. Sign in as employer test account.
2. **Find Talent** → open test driver career card.
3. Click **Request Screening Consent**.
4. Driver gets bell notification + email (if Resend configured).

### 2. Driver → consent + order

1. Sign in as test driver (incognito / different device).
2. Hub → **Screening consent** (or notification deep-link `/?onboard=screening-consent`).
3. Complete FCRA → FMCSA → CDLIS steps.
4. Check **ownership acknowledgment** box.
5. Submit **Submit consent & order MVR + PSP**.
6. Expect success screen; **My Files** shows MVR + PSP pending.

### 3. Verify database

```sql
SELECT id, status, ordered_by_company_id, ordered_by_employer, payment_id
FROM mvr_orders WHERE driver_user_id = '<driver-uuid>' ORDER BY created_at DESC LIMIT 1;

SELECT id, status, ordered_by_company_id, ordered_by_employer, payment_id
FROM psp_orders WHERE driver_user_id = '<driver-uuid>' ORDER BY created_at DESC LIMIT 1;
```

**Pass:**
- `ordered_by_company_id` IS NULL
- `ordered_by_employer` = false
- `payment_id` IS NOT NULL (agency-sponsored waived payment on `payments.company_id`)

### 4. Wait for results

- **Prod:** Accio webhooks hit `NEXT_PUBLIC_APP_URL/api/mvr/webhook` automatically.
- **Fallback:** Cron `GET /api/cron/reconcile-screenings` every 5 min (orders >10 min old).

### 5. Employer verification

1. Re-open driver career card.
2. See **MVR — candidate-owned (shared via consent)** panel with **View full report**.
3. **Order MVR / Order PSP** buttons show **Driver-ordered** badge (not duplicate order).
4. Move application to **Hired** → hire-time employer order still available (`purpose=hire`).

---

## Pass / fail criteria

| Check | Pass |
|-------|------|
| Driver submits without API error | ✅ |
| Both orders NULL `ordered_by_company_id` | ✅ |
| Payment row linked, `payments.company_id` = employer | ✅ |
| Employer notified once ("Candidate ordered portable MVR + PSP") | ✅ |
| Employer can open full MVR/PSP PDF | ✅ |
| Other employers do NOT see driver MVR on talent search | ✅ |
| Consenting employer sees results | ✅ |

---

## Local dev

See seed script: `npm run seed:screening-request -- --employer-email E --candidate-email C`

Webhooks need public URL — use reconcile cron on localhost after 10 min.
