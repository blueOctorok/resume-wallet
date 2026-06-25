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

Status legend: 🟢 real proof (predicate enforced in-circuit) · 🟡 anchor only (commitment stored, predicate off-chain) · ⬜ designed, not built

### `mvr-clean-36` — status 🟡 (P3.4-A predicate compiled; P3.4-B provenance pending)

- **Fact:** `mvr_clean_36_months` — no moving violations in the last 36 months.
- **Source / provenance:** Accio MVR (`source_cra='accio'`, `source_pull_id`=Accio order number). **Metadata only** until P3.4-B adds in-circuit issuer signature.
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
  commitment: Opaque<"string">
): Boolean {
  for (const i of 0..32) {
    const v = violationAt(i);
    assert(
      !v.active || v.dateYmd < windowStart || v.dateYmd > windowEnd,
      "violation in verification window"
    );
  }
  factCommitment = disclose(commitment);
  return disclose(true);
}
```

- **Witness (private):** 32 fixed `ViolationEntry` slots (`dateYmd` + `active`), built off-chain from `block_driver_mvr.violations` via `src/lib/mvr-clean-predicate.ts`.
- **Constraints:** every active violation must fall **outside** the public 36-month window (`windowStart`/`windowEnd` as YYYYMMDD ints).
- **Discloses:** boolean `true` + fact commitment (SHA-256 over attestation metadata — `midnight/runtime/src/fact-commitment.ts`). Never violations or PII.
- **Taxonomy v1:** any parseable violation date inside the window fails (mirrors `fact-registry.ts`). Full ACD disqualifying-code list is a future version bump.
- **Not yet in-circuit:** issuer signature (P3.4-B), replay/nullifier binding (P3.4-A step 4).

**Honesty status:** still 🟡 — real predicate math over private violation dates, but provenance trusts Storm/Accio metadata, not an in-circuit CRA signature. **Do NOT** attach per-fact "this MVR is ZK-proven on-chain / trust the math not Storm" until P3.4-B lands (DEC-2026-05-004).

---

### `mvr-clean-36` (target 🟢) — status ⬜ blocked on P3.4-B

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
