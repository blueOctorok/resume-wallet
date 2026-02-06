# Employment Verification – 400 Errors & Email Setup

## Env vars for verification email (Resend)

In `.env.local` (and production env):

- **`RESEND_API_KEY`** – Your Resend API key (required for sending). Name must be exactly `RESEND_API_KEY`.
- **`RESEND_FROM_EMAIL`** (optional) – From address, e.g. `verification@mail.stormchain.ai`. Defaults to `onboarding@resend.dev` for testing. Resend recommends verifying a **subdomain** (e.g. `mail.stormchain.ai`) rather than the root domain to avoid DNS conflicts; then use an address on that subdomain here.

The verification email is sent automatically when an applicant (driver or developer) clicks “Verify” and the previous employer has an email address. If the email fails (e.g. invalid key), the request is still created and we only log a warning.

---

## How to use it

1. **Set env:** In `.env.local` add `RESEND_API_KEY=re_xxxx` (your key from resend.com). Restart the dev server after changing env.
2. **Trigger a verification:** As a developer (or driver), open your Hub → Employment Verification → add an employment with a **previous employer email** (or use “Verify” and enter it in the modal) → click **Verify**.
3. **Check the terminal** where `npm run dev` is running. You should see either:
   - `[VERIFICATION EMAIL] Sending to: s.blaha@pacedrivers.com from: onboarding@resend.dev` then `[VERIFICATION EMAIL] Sent successfully. Resend id: …`, or
   - `[VERIFICATION EMAIL] RESEND_API_KEY not set` (key missing/wrong name), or
   - `[DEVELOPER VERIFICATION] No contact email – skipping send` (no email was provided for that employment), or
   - `[VERIFICATION EMAIL] Resend error: …` (Resend rejected the send).
4. **Check Resend dashboard:** Go to [resend.com](https://resend.com) → Logs (or Emails). You’ll see each send attempt and status (delivered, bounced, etc.).
5. **Check spam:** Work inboxes (e.g. pacedrivers.com) often filter external mail; check spam/junk and “quarantine” if your org has it.
6. **Resend free tier / testing:** With `onboarding@resend.dev` you can only send to the account’s signup email. To send to anyone else (e.g. work addresses), verify a domain in Resend. Resend recommends adding a **subdomain** (e.g. `mail.stormchain.ai`) at [resend.com/domains](https://resend.com/domains) rather than the root domain, then set `RESEND_FROM_EMAIL=verification@mail.stormchain.ai` (or whatever address you create on that subdomain).

---

## Email going to junk (Outlook, etc.)

It’s a mix of **our side** and **the recipient’s side**.

**What we control:** SPF, DKIM, and DMARC (you set these up for verify.stormchain.ai) are the main levers. A consistent, professional From address and clear, non-spammy content help. Resend’s docs and dashboard have deliverability tips. Over time, consistent sending to the same domain can improve reputation.

**What the recipient controls:** Outlook (and other clients) often put mail from new or external senders in Junk until the user trains it. The recipient can:
- Open the message in Junk → click **“Not junk”** (or “Report as not junk”) and, if offered, **“Always trust email from …”** or add the sender to Safe senders.
- Add `verification@verify.stormchain.ai` (or your From address) to Outlook **Safe senders** so future verification emails go to Inbox.

So we can’t force Outlook to stop filtering, but with DNS set correctly and a stable From address, recipients can mark us as safe and future emails should land in Inbox.

---

## 400 on initiate-self (not because of localhost)

The **400 Bad Request** from `POST /api/developer/verification/initiate-self` (or driver equivalent) is **validation**, not localhost. The API returns 400 when:

1. **Missing `employmentId`** – Request body must include the employment entry id.
2. **No contact info** – Response has `needsContactInfo: true`. The previous employer needs at least an email or phone. If the employment has none, the UI should show the contact modal so you can enter it.
3. **Invalid or missing start date** – Resume employment must have a start date the API can parse (e.g. `2020`, `2020-06`, `2020-06-15`). Empty or unparseable start date returns: *"Start date for this employment is missing or invalid. Please add a valid start date in your resume."*

**How to see the exact reason:** In the browser console you should see `[Verification] Initiate failed: 400 { error: "…" }`. The alert also shows `data.error`. Fix the payload or data (add contact, fix start date) and retry.

---

## Verification emails (Resend – implemented)

The app **sends** the verification email when an applicant (driver or developer) clicks “Verify” and the previous employer has an email:

- **Developer:** `POST /api/developer/verification/initiate-self` creates the request, then calls `sendVerificationEmail()` with the link.
- **Driver:** `POST /api/driver/verification/initiate-self` does the same.

Implementation: `src/lib/send-verification-email.ts` uses the Resend SDK. If `RESEND_API_KEY` is missing, we skip sending and log a warning; the verification request is still created.

**Employer “Send Email”:** The `/api/verification/attempt` route still only records the attempt and returns `verificationLink`; it does not send email. Resend is only used on initiate-self for applicant-initiated flows.
