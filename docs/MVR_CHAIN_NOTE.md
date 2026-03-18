# MVR and blockchain

**You are not legally “banned” from using the chain with MVR-related data.** The constraints are product and privacy design:

1. **Full MVR text on a public chain** — A bad idea: driver history is sensitive; FCRA and state laws tightly control who can see an MVR and why. Publishing the full report on-chain would not be appropriate.

2. **Hash / attestation only** — It is technically and often legally reasonable to anchor a **cryptographic hash** (or a commitment) on-chain so a third party can verify “this file hasn’t changed since date X” without putting the MVR content on-chain. That is **not** implemented in the app today; it could be a future feature.

3. **Current product** — MVRs are treated as **provider-certified** (Accio/DMV pipeline), similar to many background products, separate from resume/DOT on-chain verification flows.
