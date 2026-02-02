# Alchemy Google Auth After Domain Change (veree.io → stormchain.ai)

When you change the app domain, Google sign-in via Alchemy Account Kit can fail with:

**`OauthFailedError: Opener origin not allowed: https://...`**

OAuth only allows requests from **whitelisted origins**. After moving to stormchain.ai you must:

## 1. Set the new app URL

- **Local:** In `.env.local` set  
  `NEXT_PUBLIC_APP_URL=https://stormchain.ai`  
  (no trailing slash)
- **Vercel:** In Project → Settings → Environment Variables, set `NEXT_PUBLIC_APP_URL` to `https://stormchain.ai` for Production (and Preview if needed), then **redeploy**.

## 2. Whitelist the new domain in Alchemy

- Go to [Alchemy Dashboard](https://dashboard.alchemy.com/) → your app.
- Open **Account Kit** / **Authentication** (or the section where social/OAuth is configured).
- Find **Allowed origins** or **Authorized JavaScript origins**.
- Add:
  - `https://stormchain.ai`
  - `https://www.stormchain.ai` (if you use www)
- Save. No redeploy needed on your app for this step.

## 3. Google Cloud Console (if you use your own OAuth client)

If you configured a Google OAuth client for this app:

- [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Client ID.
- **Authorized JavaScript origins:** add `https://stormchain.ai` and `https://www.stormchain.ai`.
- **Authorized redirect URIs:** add any callback URLs Alchemy or the docs require.
- Save.

After 1–3, Google sign-in from stormchain.ai should work. If it still fails, check the browser console for the exact origin in the error and add that exact URL to Alchemy (and Google if applicable).
