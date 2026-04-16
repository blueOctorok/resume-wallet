# Career card — platform injection (Phase 4)

Phase 4 in the composable career card plan is a **Chrome extension** (or Chromium MV3) that injects Storm context into LinkedIn, Indeed, and similar sites.

## Why it is separate from the web app

- **Distribution:** Chrome Web Store review and install friction.
- **Codebase:** Extension is typically a separate package (Vite + Plasmo or bare MV3) with its own build and release cadence.
- **Maintenance:** Host sites change DOM frequently; the extension needs dedicated QA.

## Product directions (when you pick this up)

1. **Candidate mode:** Quick access to your share link / QR while on job sites; optional “attach my Career Card” helper for outbound messages (still human-sent).
2. **Employer mode (later):** Only with clear consent and privacy rules — e.g. overlay when a known Storm profile is matched; never scrape private LinkedIn data into Storm without permission.

## Prerequisites before building the extension

Ship and measure **Phase 1–3** in the main app (OG images, embed, PDF, social image, signature, badge) so the extension can deep-link to stable URLs: `/card/[token]`, `/card/[token]/embed`, `/card/[token]/social-image`, etc.
