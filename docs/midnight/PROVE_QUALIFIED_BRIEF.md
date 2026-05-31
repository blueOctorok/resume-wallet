# Midnight Design Brief — `proveQualified`

**Purpose:** the honest, technical source-of-truth for *why Storm is Midnight-dependent* and *what we'd actually build on it*. This is the seed for (a) the follow-up email to the Midnight team and (b) the eventual Phase 3 design. Engineering register — ZK/Compact/Midnight terms are fine here (they are NOT, per `strategic-direction.mdc`, for user-facing copy).

> Companion docs: trust/moat reasoning → `[MOAT_THESIS.md](./MOAT_THESIS.md)` · interface + phase plan → `[ARCHITECTURE.md](./ARCHITECTURE.md)` · candidate-agent / "not a CRA" posture → `[DECISION_LOG.md](./DECISION_LOG.md)` DEC-2026-05-011.

---

## 1. The problem (one paragraph)

A truck driver's hireability rests on third-party-verified records — MVR (driving record), PSP (crash/inspection history), employment verification — all pulled by a licensed CRA (Accio, today). To get hired, drivers hand carriers the **entire record**: license #, DOB, home address, full violation history. That's a privacy and discrimination liability for the driver, and a data-breach + FCRA liability for whoever holds it. The carrier, meanwhile, usually only needs one boolean: **"is this driver qualifiable?"** Storm's job is to let a driver prove that conclusion **without surrendering the underlying record, and without anyone having to trust Storm's honesty.**

## 2. The load-bearing test (apply to every feature)

> **If I deleted Midnight, what specifically breaks?**
> - "We'd need a different database for the green checkmark" → **decorative. Reject.**
> - "The driver would have to reveal their full record and trust Storm's word, because there'd be no way to prove a conclusion over hidden data" → **load-bearing. Build it.**

Storm stays on the right side of this sentence by using a capability **only ZK provides**: a *predicate proven over private inputs*, verifiable *without trusting Storm*.

## 3. The killer circuit — `proveQualified`

One Compact circuit is the whole thesis. It takes a CRA-signed MVR as **witness (private) data**, verifies provenance, computes the qualification predicate, and `disclose()`s **only the conclusions**.

| | Field | In the proof? |
|---|---|---|
| **Witness (private — never on-chain)** | license #, DOB, home address, full violation list, raw record bytes, CRA signature | ❌ hidden |
| **Disclosed (`disclose()`)** | `licenseValid`, `class` (e.g. `'A'`), `endorsements` (e.g. `['H']`), `disqualifyingViolations === 0` over 36mo, `pulledAt`, `sourcePullCommitment` | ✅ revealed |

Illustrative Compact-flavored pseudocode (**not** compiler-validated — shape only):

```ts
// witnesses are supplied by the off-chain TypeScript driver, never stored on-chain
witness mvrRecord(): MvrRecord;          // raw CRA record (private)
witness craSignature(): Bytes;           // Accio's signature over the record (private)

export circuit proveQualified(now: Timestamp): QualificationProof {
  const record = mvrRecord();

  // (HARD PART — see §4) prove the record was genuinely issued by the CRA
  assert verifyCraSignature(craSignature(), record, ACCIO_PUBKEY);

  // predicate computed over hidden data
  const violations = countDisqualifying(record.violations, now, months(36));

  // disclose() = the deliberate, compiler-enforced privacy decision.
  // Everything NOT wrapped in disclose() stays in the witness layer.
  return QualificationProof {
    licenseValid:           disclose(record.status == Valid),
    class:                  disclose(record.licenseClass),
    endorsements:           disclose(record.endorsements),
    noDisqualifying:        disclose(violations == 0),
    pulledAt:               disclose(record.pulledAt),
    sourcePullCommitment:   disclose(commit(record.pullId)),
  };
}
```

Why each line earns its place:
- **Witness MVR** — Midnight keeps PII off-chain *by construction*; `disclose()` is opt-in, privacy is the compiler default ("witness protection program").
- **`verifyCraSignature` in-circuit** — this is what removes Storm from the trust path. The carrier trusts *Accio + math*, not Storm.
- **`countDisqualifying` over hidden data** — a signed JWT can't do this without either embedding the inputs or having Storm assert the output (→ trust Storm again).
- **`disclose()` wrappers** — the conclusions are revealed *deliberately and auditably*; nothing else can leak.

## 4. The hard part — binding to the CRA (be honest about this)

`verifyCraSignature` inside a ZK circuit is the central engineering question. In-circuit signature verification is expensive and depends on Accio's signature scheme (likely not ZK-friendly). Three honest forks, weakest-but-shippable → purest-but-hardest:

| Fork | How | Trust model | Tradeoff |
|---|---|---|---|
| **A. Commit-at-ingest** | Storm checks Accio's signature **off-circuit once** at ingest, commits the record hash to Midnight. Proofs reference the commitment. | Carrier trusts *Storm's one-time ingest check* + math thereafter. | Shippable now; Storm is still trusted at the ingest moment. Honest "Phase 3a." |
| **B. ZK-friendly re-issuance** | A Storm/Accio gateway re-issues the fact signed with a ZK-friendly scheme (e.g. EdDSA over a SNARK-friendly curve) that's cheap to verify in-circuit. | Carrier trusts *the gateway key* + math. | Requires Accio cooperation or a Storm signing gateway; medium effort. |
| **C. Full in-circuit verification** | Verify Accio's native signature directly inside the circuit. | Carrier trusts *Accio + math only*. Storm fully removed. | Purest moat; hardest/most expensive; may be infeasible depending on Accio's scheme. |

**Recommendation:** target **A** for the first real proof (ships, demonstrates the model, honest about its limit), with **B/C** as the stated north star. *Naming which fork you're on is exactly what keeps the pitch credible.*

## 5. Honest Phase 2 vs Phase 3 split

| Capability | Phase 2 (signed JWT — ships now) | Needs Midnight (Phase 3) |
|---|---|---|
| Show carrier "✓ Clean MVR" instead of a PDF | ✅ fully | — |
| Selective disclosure of *which* facts per carrier | ✅ (issuer chooses fields) | hardened |
| Prove a conclusion **without revealing the inputs** | ❌ | ✅ **load-bearing** |
| Verify **without trusting Storm** | ❌ (trust Storm's signature) | ✅ **load-bearing** |
| Keep PII off any shared ledger while still anchoring proofs | ❌ | ✅ **load-bearing** |
| Portable proof that outlives Storm-the-company | ❌ | ✅ |

**Takeaway for the email:** Phase 2 already beats PDFs and is the moat's *first form* — but the three ✅-load-bearing rows are *only* achievable with ZK. That's the non-decorative core.

## 6. Why Midnight specifically (not just "a chain")

Each Midnight property maps to a concrete trucking need — this is what makes it purpose-fit, not forced:

- **Witness data off-chain + `disclose()`** → driver PII never touches the ledger; revealing the qualification booleans is a deliberate, audited act.
- **zk-SNARK predicate proofs** → "qualifiable" proven over a hidden record (Midnight's own canonical example is proving creditworthiness without revealing the credit report — the MVR is the same shape).
- **Viewing keys / rational privacy** → a regulator (FMCSA, an auditor) can be granted selective visibility without making the data public — directly relevant to a DOT-regulated workflow.
- **Compact (TypeScript-like)** → our stack is TypeScript; the learning curve is realistic for this team.

## 7. Email-ready framing

Lead with the **problem + trust model**, never the chain:

> "Storm turns CRA-verified driver credentials — MVR, PSP, employment — into **selective-disclosure proofs**. A driver should prove *'clean MVR, Class A + hazmat, 5+ yrs verified'* to any carrier — provably derived from the original CRA pull, revealing nothing else, and **without Storm or the carrier holding that PII on a shared ledger.** Today we issue signed attestations behind a stable `attestationService` interface; we're building toward **Midnight** because the endgame is a *trustless, portable* credential — the carrier verifies the proof against the math and the CRA's signature, **not against Storm's honesty.** Storm is the candidate's agent, not a CRA. Midnight's witness model + `disclose()` is what lets the proof be trusted without trusting us, and keeps PII off-chain by construction — a privacy-preserving predicate over third-party-signed data that a transparent chain or a database of signatures structurally can't deliver."

**Be ready for these smart follow-ups** (have the §4 answer loaded):
- *"How do you bind the proof to the original CRA data?"* → §4, fork A now / B-C north star.
- *"What's on-chain vs off-chain?"* → only commitments + the disclosed booleans; the record stays witness data.
- *"Why not just signed credentials (SD-JWT)?"* → §5: signatures can't prove a predicate over hidden inputs *and* remove Storm from the trust path.

## 8. Open questions for the Midnight team (asking these signals competence)

1. Recommended pattern for binding an **external issuer's signature** (a CRA's, not ZK-native) into a Compact proof — is there a blessed approach, or is commit-at-ingest (fork A) the expected interim?
2. In-circuit signature verification cost for common schemes — what's realistic on current mainnet?
3. **Proof-server operations** in production: managed options, latency, scaling for per-disclosure proof generation.
4. Mainnet maturity / SLAs for a regulated B2B workflow (not a DeFi app).
5. Whether the **Midnight MCP server** (per `ARCHITECTURE.md` §references) is the recommended dev path for a TS team starting Compact.

---

## References
- Interface + phase seam: `[ARCHITECTURE.md](./ARCHITECTURE.md)` (`AttestationService`, `FactType`, `ProofArtifact`)
- Moat reasoning (non-eng audience): `[MOAT_THESIS.md](./MOAT_THESIS.md)`
- Candidate-agent / not-a-CRA: `[DECISION_LOG.md](./DECISION_LOG.md)` DEC-2026-05-011
- Compact selective disclosure: https://docs.midnight.network/compact/reference/explicit-disclosure.md
- Compact stdlib (`disclose`, token ops): https://docs.midnight.network/compact/standard-library/exports

**Last updated:** 2026-05-30
