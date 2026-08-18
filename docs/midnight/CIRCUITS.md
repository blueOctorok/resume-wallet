# Storm Circuits — a living primer + per-circuit log

**Purpose.** Two jobs in one doc:
1. A plain-English primer on zero-knowledge proofs and Compact circuits, so anyone on the team can read a circuit and explain the product.
2. An honest, annotated entry for **every circuit Storm ships** — what it proves, its private witness, its constraints, and exactly what it discloses.

Keep this current. When you add or change a circuit, add/update its entry here in the same PR. When the honesty status of a fact changes (anchor → real proof), update its entry **and** the per-fact claim rules in `strategic-direction.mdc`.

Related docs: `ARCHITECTURE.md` (full strategy), `MOAT_THESIS.md` (why selective disclosure is the moat), `DECISION_LOG.md` (DEC-2026-05-004 honesty gate, DEC-2026-05-014 provenance gate), `EXECUTION_CHECKLIST.md` (P3.x steps).

---

## Part 1 — The primer

### 1.1 What a ZK proof is

Every zero-knowledge proof proves one shape of statement:

> "I know a secret **w** such that **P(public, w)** is true — and I can prove it to you without revealing **w**."

- **w** — the *witness*: private data the prover holds (the raw MVR record, an issuer's signature).
- **P** — the *predicate*: the rule being proven ("no disqualifying violations in 36 months").
- **public** — inputs/outputs both sides can see (the trusted issuer's public key, the date window, the boolean result).

A verifier checks the proof and learns **only** that P holds plus whatever you explicitly disclosed. They learn nothing else about **w**.

Two properties make it trustworthy:
- **Soundness** — you cannot produce a valid proof for a false statement. (You can't fake a clean MVR.)
- **Completeness** — an honest prover with a true statement can always produce a proof.

### 1.2 Constraints *are* the statement

The "rules" inside a circuit are **constraints** (`assert`s). The proof system guarantees a proof exists **only if every constraint holds**. So:

- A circuit with **no constraints** proves a trivially-true statement → worthless.
- A circuit's constraints **are** the predicate P. Writing the circuit *is* writing the math you're claiming is true.

This is why a "good" circuit is judged by whether its constraints actually pin down the fact you claim — not by how much code it has.

### 1.3 The four Compact building blocks

Knowing these four lets you read any Compact circuit:

| Keyword | Meaning | Storm example |
|---|---|---|
| `ledger` | **public** on-chain state | the published commitment / nullifier |
| `witness` | **private** input the prover knows, never revealed | the raw MVR record + the CRA's signature |
| `assert` | a **constraint** — a valid proof requires it to hold | "violation count in window == 0" |
| `disclose()` | explicitly move a private value into the public output | the boolean result + the date window |

**The load-bearing idea:** Compact makes you call `disclose()` for *anything* that leaks. Whatever you don't `disclose()` stays private by construction. That compiler-enforced default **is** selective disclosure — it's not something we bolt on, it's a language guarantee.

### 1.4 How a Storm proof flows end-to-end

```
issuer (Accio/DMV) signs a record
        │
        ▼
candidate's data + signature  ──►  WITNESS (private, off-chain)
        │
        ▼
Compact circuit:  assert(issuer signed it)  +  assert(predicate holds)
        │                                  └── disclose(boolean + metadata only)
        ▼
proof server generates the ZK proof  ──►  tx submitted to Midnight
        │
        ▼
carrier verifies proof against issuer pubkey + circuit verifier key
        (trusts the math + the issuer — NOT Storm's database)
```

### 1.5 The proof "shapes" (your circuit library)

You don't write one circuit per fact. You write one per *predicate shape* and parameterize it. Most facts fall into a handful of shapes:

| Shape | What it proves | Storm facts |
|---|---|---|
| Boolean predicate | a condition is true/false over private data | clean MVR, clean PSP crash history |
| Range / threshold | a value is above/below a bound | age ≥ 21, experience ≥ 2 years |
| Set membership | an element is in a set | holds endorsement ∈ {H, N, T, …} |
| Signature check | data was signed by a trusted issuer | "issued by Accio / the DMV" (provenance) |
| Non-revocation | a credential is not in a revoked set | license not suspended since pull |

A real fact circuit usually **composes** shapes: e.g. clean-MVR = *signature check* (provenance) + *boolean predicate* (no disqualifying violations).

### 1.6 What makes a circuit *good*

1. **Sound predicate** — the constraints actually pin down the claimed fact (no false positives).
2. **Provenance built in** — verifies the issuer's signature in-circuit, so the inputs are trustworthy, not self-asserted (DEC-2026-05-014).
3. **Minimal disclosure** — `disclose()`s only the conclusion + metadata, never the underlying record/PII.
4. **Independently verifiable** — a third party can verify without trusting Storm's DB.
5. **Efficient** — fewer constraints = faster proving + lower fees. (Loops/signature checks are expensive; keep witnesses tight.)

---

## Part 2 — Circuit log

Status legend: 🟢 shipping bar — predicate enforced in-circuit + CRA cited (DEC-2026-08-004) · 🟡 anchor / dummy reuse (predicate off-chain) · ⬜ designed, not built · ❌ dropped

### `mvr-clean-36` — status 🟢 (P3.4-A predicate; Key sig dropped)

- **Fact:** `mvr_clean_36_months` — no moving violations in the last 36 months.
- **Source / provenance:** Accio MVR (`source_cra='accio'`, `source_pull_id`=Accio order number). Metadata citation — Key will not sign report bytes (DEC-2026-08-004).
- **Deployed (P3.4-A predicate):** Preprod `2b7032a622c339a1494265812064df28a9e708da330be3e0a4e50856eea54cdb` (`proveCleanMvr`).
- **First predicate proof:** tx `009847a5…3ea2cc`, attestation `167040f7…83bc` (2026-06-22).
- **P3.3 anchor (superseded):** contract `6c3f0ea8…fea49cf` (`registerCleanMvr` only); tx `0024edbc…0e265a`, row `6bc932c7…7d4ad4` (2026-06-17).

**P3.3 anchor (historical — do not redeploy this shape):**

```compact
export circuit registerCleanMvr(commitment: Opaque<"string">): [] {
  factCommitment = disclose(commitment);
}
```

No witness, no constraints — commitment only.

**P3.4-A predicate (current `.compact` — deployed + proven on Preprod):**

```compact
witness violationAt(index: Uint<8>): ViolationEntry;

export circuit proveCleanMvr(
  windowStart: Uint<32>,
  windowEnd: Uint<32>,
  asOfDate: Uint<32>,
  pullNullifier: Opaque<"string">,
  commitment: Opaque<"string">
): Boolean {
  for (const i of 0..32) {
    const v = violationAt(i);
    assert(
      !v.active || v.dateYmd < windowStart || v.dateYmd > windowEnd,
      "violation in verification window"
    );
  }
  assert(asOfDate > 0, "asOfDate required");
  assert(!usedPullNullifiers.member(disclose(pullNullifier)), "pull already proven");
  usedPullNullifiers.insert(disclose(pullNullifier), true);
  factCommitment = disclose(commitment);
  return disclose(true);
}
```

- **Witness (private):** 32 fixed `ViolationEntry` slots (`dateYmd` + `active`), built off-chain from `block_driver_mvr.violations` via `src/lib/mvr-clean-predicate.ts`.
- **Constraints:** every active violation must fall **outside** the public 36-month window (`windowStart`/`windowEnd` as YYYYMMDD ints).
- **Freshness (P3.4-A step 4, 2026-07-29):** public `asOfDate` (YYYYMMDD from MVR `completed_at`); commitment includes `asOfDateYmd`; ledger `usedPullNullifiers` blocks replay of the same Accio order; off-chain mirror in `midnight-prove-guards.ts`.
- **Discloses:** boolean `true` + fact commitment (SHA-256 over attestation metadata — `midnight/runtime/src/fact-commitment.ts`). Never violations or PII.
- **Taxonomy v1:** any parseable violation date inside the window fails (mirrors `fact-registry.ts`). Full ACD disqualifying-code list is a future version bump.
- **Not in-circuit (dropped):** issuer signature. Out of plan (DEC-2026-08-004).

**Honesty status:** predicate math is real; provenance is Storm’s Accio parse + order cite. Copy: **Proven on Midnight · derived from Accio**. Do **not** say "trust the math, not Storm."

---

### `cdl-class-a` — status 🟡 (P3.5 — dummy boolean reuse; not a billboard claim)

- **Fact:** `cdl_class_a` — holds Class A CDL per driver-owned Accio MVR.
- **Witness (private):** `holdsClassA(): Boolean` — built from `normalizeAccioCdlClass(mvrCtx.licenseClass) === 'A'`.
- **Public inputs:** `asOfDate`, `pullNullifier`, `commitment`.
- **Constraints:** assert Class A; nullifier ledger prevents double-prove of same pull.
- **Deployed:** Preprod `39feba2727e8d24766b411f6ff4ede3ce7d440b384a92255090796753e1be960`.
- **Smoke:** tx `00e825b3…080ce8`, attestation `ad25ec1b-…` (2026-08-06).

---

### Billboard MVR fields — status 🟢 (dedicated circuits; shipping bar)

Active career-card facts. Each has its **own Compact contract**. The circuit asserts the disclosed value equals the witness — you cannot prove Class B with a Class A witness (or an endorsement mask the MVR does not have).

| Fact | Circuit | Predicate |
|---|---|---|
| `cdl_class` | `cdl-class` / `proveCdlClass` | witness ASCII class code == public `disclosedClass` (A–Z) |
| `cdl_endorsements` | `cdl-endorsements` / `proveCdlEndorsements` | witness bitmask == public mask, mask > 0 |
| `cdl_restrictions` | `cdl-restrictions` / `proveCdlRestrictions` | witness bitmask == public mask (0 = none) |
| `med_cert_valid` | `med-cert-valid` / `proveMedCertValid` | witness YYYYMMDD == public expiration, expiration ≥ asOfDate |

- **Public inputs:** disclosed value + `asOfDate` + pull nullifier + commitment.
- **Honesty:** predicate is real on Midnight. Provenance is Storm’s Accio parse (`provenanceTier: metadata`). Copy is **Proven on Midnight · derived from Accio pull …** when `predicateEnforced: true`. Do **not** say “trust the math, not Storm.”
- **Deployed Preprod 2026-08-18** (smoke user `f6d55342-…`, all four `predicateEnforced`):

| Fact | Address | Smoke tx |
|---|---|---|
| `cdl_class` | `48450d4bd0d9…91393385` | `00e19add…821129` |
| `cdl_endorsements` | `47b8d0f99e96…24d4e8d5` | `00d01709…3c3c81` |
| `cdl_restrictions` | `fc2ce5777313…064fb2a1` | `00725341…7b0f42` |
| `med_cert_valid` | `3a57cc27cdb2…81dff0b8` | `00af8c62…90da0a` |

- **Env:** `MIDNIGHT_CONTRACT_ADDRESS_CDL_CLASS`, `_CDL_ENDORSEMENTS`, `_CDL_RESTRICTIONS`, `_MED_CERT` (local set; paste onto Vercel for in-app prove).
- **Legacy:** `cdl_class_a` / `mvr_clean_36_months` stay on their original contracts for old rows.

---

### `previous-employer-verified` — status 🟡 (P3.5 — Preprod proven 2026-08-06; DKIM gate 2026-08-13)

- **Fact:** `previous_employer_verified` — prior employer confirmed employment (in-house EV outreach, not Accio EV).
- **Witness (private):** `employerVerified(): Boolean` — true when EVR row has `verified_at`.
- **Public inputs:** `asOfDate` (from `verified_at`), `pullNullifier` (EVR request id), `commitment`.
- **Constraints:** assert verified; nullifier ledger prevents double-prove.
- **DKIM (Midnight only):** inbound Pingram `EMAIL_INBOUND` with raw RFC822 → `mailauth` DKIM pass + domain aligned with the invited mailbox. Form/token replies stay **Verified by Provven**. Midnight `proveFact` throws without `dkim_valid`.
- **Deployed:** Preprod `4ef51b672f29b80ee5c39c53c176e3a1de63040722a392ddd03a6a53fc049859`.
- **Smoke:** tx `002f59e5…4f302b`, attestation `6237e4c6-…` (2026-08-06).

---

### `mvr-clean-36` in-circuit issuer-sig — status ❌ dropped (DEC-2026-08-004)

Historical design only. Key will not sign. Do not build this.

Full cold-trustless version adds provenance to the predicate above:

```compact
// Private inputs — known to the prover, never revealed.
witness mvrRecord(): MvrData;          // full driving record
witness craSignature(): Signature;     // Accio's signature over that record

export ledger factCommitment: Bytes<32>;

export circuit proveCleanMvr(
  craPublicKey: Bytes<32>,   // public: who we trust as issuer
  windowStart: Uint<64>,     // public: 36-month window bounds
  windowEnd: Uint<64>
): Boolean {
  const record = mvrRecord();

  // CONSTRAINT 1 — provenance: the record is genuinely from Accio.
  assert verifySignature(craPublicKey, record.bytes, craSignature())
    "MVR not signed by trusted CRA";

  // CONSTRAINT 2 — the predicate, checked over PRIVATE data.
  for (const v of record.violations) {
    assert !(v.date >= windowStart && v.date <= windowEnd && v.isDisqualifying)
      "disqualifying violation inside window";
  }

  // Disclose ONLY the conclusion + a binding commitment — never the violations.
  factCommitment = disclose(hash(record.driverId, windowStart, windowEnd));
  return disclose(true);
}
```

(Illustrative — exact Compact stdlib for `verifySignature`/`hash`/struct decoding will be finalized when built.)

**Open design questions to resolve before building:**
- **Issuer signing:** does Accio expose a signature over the MVR payload we can verify in-circuit? If not, who is the trusted issuer and over what bytes? (Without this, "trustless" collapses — provenance is the whole point.)
- **Record encoding:** how do we get the MVR into a circuit-friendly fixed shape (`MvrData`) deterministically? (Witness size drives proving cost.)
- **Violation taxonomy:** which ACD/state codes count as "disqualifying"? This list is itself a product/compliance decision and must be versioned.
- **Replay / freshness:** bind the proof to the pull date / a nullifier so an old clean MVR can't be reused after a new violation.
- **Verifier UX:** the carrier-facing "cold-verifiable link" (ties into DEC-2026-06-003 Proof Request rail).

**This is the work that makes Storm foundation-worthy** — and is the real scope of P3.4/P3.5 (deepen the circuit before fanning out to more facts).

---

## Part 3 — Adding a new circuit (checklist)

1. Pick the **fact** and confirm it passes the three gates: wanted by carriers, backed by a trustworthy issuer, reducible to a checkable predicate.
2. Identify the **shape(s)** (§1.5) — reuse/parameterize an existing circuit template if possible.
3. Write the `.compact` under `compact/<name>/`; keep the witness tight and `disclose()` only the conclusion + metadata.
4. Register the fact in `src/lib/fact-registry.ts` with `source: 'third_party'` and a `proveImpl`.
5. Add a **circuit log entry here** (status, witness, constraints, disclosure, honesty status).
6. Only flip the per-fact "proven on Midnight" claim (and `strategic-direction.mdc` language) when the entry is 🟢.
