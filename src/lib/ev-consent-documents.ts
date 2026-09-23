/**
 * Canonical text of the three Track B EV legal artifacts (docs/EV_CONSENT_STACK.md).
 *
 * Each artifact row stores `document_version` + a sha256 of the EXACT text the
 * user saw, so the text lives here as data, is rendered verbatim by the consent
 * screens, and is serialized (with dynamic fields substituted) for hashing.
 * Bracketed [COUNSEL] items from the drafts render as the temporary lines the
 * drafts prescribe for test builds — never invented language.
 *
 * Client-safe: pure data + string serialization. Hashing happens server-side
 * (see hashEvDocument in src/lib/ev-share.ts).
 */

export interface EvDocumentSection {
  heading?: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface EvConsentDocument {
  /** Stable id for the screen rendering this document. */
  id:
    | 'driver-disclosure'
    | 'driver-authorization'
    | 'employer-share-request'
    | 'driver-share-ack'
    | 'employer-terms-ev-schedule'
  /** Document family version — stored on the artifact row. */
  version: string
  title: string
  sections: EvDocumentSection[]
  /** Required accept control — never pre-checked. */
  checkboxLabel?: string
  primaryCta?: string
}

export const EV_DISC_AUTH_VERSION = 'PROVVEN-EV-DISC-AUTH-B-0.1'
export const EV_EMP_SHARE_REQ_VERSION = 'PROVVEN-EV-EMP-SHARE-REQ-0.1'
export const EV_SHARE_ACK_VERSION = 'PROVVEN-EV-SHARE-ACK-6-0.1'
/** DRAFT — pending Frantz Ward review. Accepted at employer registration. */
export const EV_EMPLOYER_TERMS_VERSION = 'PROVVEN-EMP-TERMS-EV-0.1'

// ── Screen A — driver disclosure (standalone, scroll-to-continue) ────────────

export const EV_DRIVER_DISCLOSURE: EvConsentDocument = {
  id: 'driver-disclosure',
  version: EV_DISC_AUTH_VERSION,
  title: 'Disclosure Regarding Employment Verification Requests',
  sections: [
    {
      paragraphs: [
        'Please read this disclosure carefully.',
        'You are about to request that Provven transmit an Employment Verification inquiry to one or more of your prior employers (or their designated agents). This request is initiated by you. It is not an employer-ordered background check placed through Provven as a consumer reporting agency.',
      ],
    },
    {
      heading: 'What may be requested',
      paragraphs: [
        'The inquiry may ask your prior DOT-regulated employer(s) for information related to your employment history and safety performance, including (as applicable):',
      ],
      bullets: [
        'Dates of employment and position / whether you operated a commercial motor vehicle',
        'Accident and safety performance history of the kind described in 49 CFR 391.23(d) and related recordkeeping rules',
      ],
    },
    {
      heading: 'What is not included in this request',
      paragraphs: [
        'This Employment Verification request does not authorize a query of the FMCSA Drug & Alcohol Clearinghouse or other 391.23(e) drug and alcohol investigation. Any Clearinghouse or Part 40 consent is obtained separately, if and when you use that feature.',
      ],
    },
    {
      heading: "Provven's role",
      paragraphs: [
        'Provven will route (transmit) your request to the prior employer(s) or agents you identify and will return any response we receive to you — typically to your Provven inbox and, if you choose, your Career Card. Provven does not score, rank, or evaluate the response for employers as part of this flow. Provven is providing verification-routing and credential technology.',
      ],
    },
    {
      heading: 'Who receives the response first',
      paragraphs: [
        'Responses are delivered to you. An employer does not automatically receive the Employment Verification response. If an employer later asks to see it (for example, in connection with a job application), you will be asked to complete a separate, formal acknowledgment before any share occurs.',
      ],
    },
    {
      heading: 'Accuracy and disputes',
      paragraphs: [
        "Information comes from third-party employers or their agents. If you believe information returned to you is incomplete or inaccurate, you may use Provven's dispute / correction channel (request a correction from the packet in your Employment Verification block) so we can help route a correction request where appropriate. Additional rights may apply under FMCSA rules, including notice, correction, and rebuttal concepts associated with safety-performance history.",
      ],
    },
    {
      heading: 'Your choice',
      paragraphs: [
        'You are not required to request Employment Verification through Provven to use other Provven features. You may cancel before authorizing the transmission on the next screen.',
      ],
    },
  ],
  primaryCta: 'Continue',
}

// ── Screen B — driver authorization to route ─────────────────────────────────

export const EV_DRIVER_AUTHORIZATION: EvConsentDocument = {
  id: 'driver-authorization',
  version: EV_DISC_AUTH_VERSION,
  title: 'Authorization to Transmit Employment Verification Requests',
  sections: [
    {
      heading: 'Authorization',
      paragraphs: [
        `I have read the Disclosure Regarding Employment Verification Requests (version ${EV_DISC_AUTH_VERSION}).`,
        'I authorize Provven (and its service providers acting on its behalf) to transmit / route Employment Verification requests to the prior employer(s) and designated agent(s) I identify in this flow, and to receive responses for delivery to me in my Provven account.',
      ],
    },
    {
      heading: 'Scope of this authorization',
      bullets: [
        'Purpose. Hiring-related and FMCSA-regulated employment investigation support — specifically employment and safety performance history under 49 CFR 391.23(d) (and related elements needed to complete that inquiry).',
        'Data category. Employment dates / CMV operation / accident and safety performance history as described in the Disclosure. Not Clearinghouse / 391.23(e) drug and alcohol information.',
        'Recipients of the outbound request. Only the prior employer(s) / agent(s) I list for this request (and channels they designate for responding).',
        'What this does not authorize. This authorization does not by itself permit Provven to share the Employment Verification response with any prospective employer. Sharing with an employer requires my separate formal acknowledgment at the time of a share request.',
      ],
    },
    {
      heading: 'Identity and contacts',
      paragraphs: [
        'I certify that the identifying information and prior-employer contacts I provide are accurate to the best of my knowledge, and I understand that Provven may use them solely to route this request and return results to me.',
      ],
    },
    {
      heading: 'No evaluation by Provven',
      paragraphs: [
        'I understand Provven does not decide whether I am qualified for employment and does not add scoring or ranking to employer responses in this flow.',
      ],
    },
    {
      heading: 'Duration',
      paragraphs: [
        'This authorization applies to the Employment Verification request(s) I submit under this version until completed, withdrawn, or superseded.',
      ],
    },
    {
      heading: 'Electronic signature',
      paragraphs: [
        'I agree that selecting Authorize & Send Requests constitutes my written authorization under applicable law.',
      ],
    },
  ],
  checkboxLabel:
    'I have read the Disclosure and I authorize Provven to route Employment Verification requests as described above.',
  primaryCta: 'Authorize & Send Requests',
}

// ── Employer per-request clickwrap (PDF 3, section B) ────────────────────────
// Dynamic fields use {{token}} placeholders — substituted before render AND
// before hashing so the stored sha256 matches the exact text shown.

export const EV_EMPLOYER_SHARE_REQUEST: EvConsentDocument = {
  id: 'employer-share-request',
  version: EV_EMP_SHARE_REQ_VERSION,
  title: 'Request Employment Verification Share',
  sections: [
    {
      paragraphs: [
        'You are asking {{driverName}} to share Employment Verification material associated with their Provven account. That material (if available) comes from an Employment Verification request the driver ordered, which Provven routed to the driver\'s prior employer(s). It covers employment and safety-performance history of the kind associated with 49 CFR 391.23(d). It does not include FMCSA Drug & Alcohol Clearinghouse / 391.23(e) results.',
        'Before you can see anything, the driver must complete a separate formal acknowledgment authorizing share with {{employerLegalName}} for this request. If they decline, you will not receive the content.',
      ],
    },
    {
      heading: 'Your certifications',
      paragraphs: ['By selecting Request Share, you certify that:'],
      bullets: [
        'You have a current hiring-related need to review this material for this named driver in connection with {{applicationContext}}.',
        'Your purpose is limited to employment / FMCSA-related qualification evaluation — not marketing, sourcing lists, or general browsing.',
        'You are not attempting to search or browse a pool of drivers with Employment Verifications on file.',
        'You will use any material later shared only for that purpose, keep it confidential, and not redisclose except as required by law or further authorized.',
        'You understand Provven does not make the hiring decision, and that this request does not replace your own compliance obligations (including any separate Clearinghouse requirements).',
      ],
    },
    {
      heading: 'Electronic agreement',
      paragraphs: [
        'Selecting Request Share after checking the box below is your agreement to these terms for this request.',
      ],
    },
  ],
  checkboxLabel:
    'I certify the permissible purpose and no-browse rules above and request that this driver authorize sharing EV material with my organization for this hiring context.',
  primaryCta: 'Request Share',
}

// ── Driver Step 6 formal share acknowledgment (PDF 2) ────────────────────────

export const EV_SHARE_ACKNOWLEDGMENT: EvConsentDocument = {
  id: 'driver-share-ack',
  version: EV_SHARE_ACK_VERSION,
  title: 'Authorization to Share Employment Verification Information',
  sections: [
    {
      paragraphs: [
        'Please read this acknowledgment carefully before sharing.',
        'You previously ordered an Employment Verification request that Provven routed to your prior employer(s). The response is associated with your Provven account / Career Card.',
        '{{employerLegalName}} has requested to view the following material related to that Employment Verification: {{payloadDescription}}.',
      ],
    },
    {
      heading: 'Your authorization',
      paragraphs: [
        'By selecting Authorize Share, you instruct Provven to make the material described above available to {{employerLegalName}} solely for evaluating your application or potential employment in a safety-sensitive / DOT-related hiring context.',
      ],
    },
    {
      heading: 'Important limits',
      bullets: [
        'Named recipient only. This acknowledgment authorizes share with {{employerLegalName}} for this request/context only. It does not authorize Provven to publish your EV to other employers or to an employer-searchable pool.',
        'Not a new Provven-ordered report for the employer. This step shares material from your driver-ordered, Provven-routed Employment Verification.',
        'Provven does not hire you. Hiring and adverse employment decisions are made by the employer (or staffing customer), not by Provven.',
        'Purpose limitation. The employer should use shared material only for the stated hiring-related purpose and should not redisclose except as permitted by law or your further instruction.',
        'Accuracy. Information originated with third parties. If you believe it is inaccurate, you can request a correction from the packet in your Employment Verification block before or after sharing. Sharing does not waive dispute rights.',
      ],
    },
    {
      heading: 'Revocation / access duration',
      paragraphs: [
        // Temporary line prescribed by the draft for test builds — do not reword
        // until counsel locks Option A/B.
        'Revocation and retention rules for shared material will follow counsel-approved policy; for this test build, share creates an auditable access grant for this employer only.',
      ],
    },
    {
      heading: 'Electronic acknowledgment',
      paragraphs: [
        'Selecting Authorize Share after checking the box below is your formal legal acknowledgment and instruction to share as described.',
      ],
    },
  ],
  checkboxLabel:
    'I have read this acknowledgment. I authorize Provven to share the material described above with {{employerLegalName}} for the stated hiring-related purpose.',
  primaryCta: 'Authorize Share',
}

// ── Employer Terms schedule (A.1–A.8) — DRAFT, counsel review pending ────────

export const EV_EMPLOYER_TERMS: EvConsentDocument = {
  id: 'employer-terms-ev-schedule',
  version: EV_EMPLOYER_TERMS_VERSION,
  title: 'Employer Terms — Employment Verification share requests',
  sections: [
    {
      paragraphs: [
        'DRAFT pending counsel review (Frantz Ward). This schedule is part of the Provven employer terms. Accepting it covers your organization.',
      ],
    },
    {
      heading: 'Employment Verification share requests',
      paragraphs: [
        'Provven may allow you to request that a driver share Employment Verification material associated with that driver’s Provven account. That material, if any, originates from a driver-ordered request that Provven routed to the driver’s prior employer(s). Enabling a share request does not mean Provven is ordering a new consumer report for you in this flow.',
      ],
    },
    {
      heading: 'Permissible purpose',
      paragraphs: [
        'You represent that each Employment Verification share request is solely for a permissible employment purpose — evaluating the named driver for hiring, continued employment, or related FMCSA / DOT safety-sensitive qualification in connection with a specific application or hiring process — and not for marketing, general market research, or building a searchable pool of drivers.',
        'You will not request Employment Verification material without a legitimate, current hiring-related need tied to that named driver.',
      ],
    },
    {
      heading: 'No browse / no pool access',
      paragraphs: [
        'Provven’s Employment Verification features do not include the right to search, filter, browse, or query a directory of drivers based on verification status, to receive alerts about verified candidates outside a candidate-initiated application, or to access Employment Verification material for a driver who has not applied or otherwise started a share with you.',
        'Cards reach you through a link the candidate shared, or through a candidate-initiated application. Employment Verification content reaches you only after that application context plus the driver’s separate formal acknowledgment.',
      ],
    },
    {
      heading: 'Driver acknowledgment is required',
      paragraphs: [
        'Submitting a share request does not grant access. You will not receive Employment Verification content until the driver completes Provven’s formal share acknowledgment for your organization and that request. If the driver declines or does not respond, you will not receive the content.',
      ],
    },
    {
      heading: 'Limited use',
      paragraphs: [
        'You will use shared Employment Verification material only for the certified hiring-related purpose, limit internal access to personnel with a need to know, and not redisclose it except as required by law or with the driver’s further authorization.',
        'Shared material does not by itself satisfy all of your independent obligations under 49 CFR 391.23, including any Clearinghouse or drug and alcohol requirements, which are outside this Employment Verification scope.',
      ],
    },
    {
      heading: 'No Provven hiring decision',
      paragraphs: [
        'Provven does not decide whether you hire the driver. Any adverse employment decision is yours. You are responsible for any adverse-action notices and related processes required by law.',
      ],
    },
    {
      heading: 'Audit and suspension',
      paragraphs: [
        'Provven may log share requests and access events, and may suspend Employment Verification share-request features for accounts that attempt browse or pool behavior, misuse the stated purpose, or circumvent the driver acknowledgment.',
      ],
    },
    {
      heading: 'How Provven is described',
      paragraphs: [
        'Do not describe Provven as your background-check company or as providing access to a database of verified drivers.',
      ],
    },
  ],
  checkboxLabel:
    'I have read this Employment Verification schedule and I agree to it on behalf of my organization.',
}

// ── Rendering / hashing helpers ──────────────────────────────────────────────

export type EvDocumentSubstitutions = Record<string, string>

/** Replace {{token}} placeholders in one string. Unknown tokens are left as-is. */
export function substituteTokens(text: string, subs: EvDocumentSubstitutions): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, token: string) => subs[token] ?? match)
}

/** Document with all dynamic fields filled — what the screen actually renders. */
export function resolveEvDocument(
  doc: EvConsentDocument,
  subs: EvDocumentSubstitutions = {},
): EvConsentDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => ({
      heading: s.heading,
      paragraphs: s.paragraphs?.map((p) => substituteTokens(p, subs)),
      bullets: s.bullets?.map((b) => substituteTokens(b, subs)),
    })),
    checkboxLabel: doc.checkboxLabel ? substituteTokens(doc.checkboxLabel, subs) : undefined,
  }
}

/**
 * Deterministic serialization of the resolved document for sha256 snapshots.
 * Server and client must produce identical strings, so this is pure text —
 * no JSON key-order concerns.
 */
export function serializeEvDocument(
  doc: EvConsentDocument,
  subs: EvDocumentSubstitutions = {},
): string {
  const resolved = resolveEvDocument(doc, subs)
  const lines: string[] = [resolved.version, resolved.title]
  for (const section of resolved.sections) {
    if (section.heading) lines.push(`## ${section.heading}`)
    for (const p of section.paragraphs ?? []) lines.push(p)
    for (const b of section.bullets ?? []) lines.push(`- ${b}`)
  }
  if (resolved.checkboxLabel) lines.push(`[checkbox] ${resolved.checkboxLabel}`)
  return lines.join('\n')
}
