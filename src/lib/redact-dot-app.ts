/**
 * Strip Tier 3 raw identifiers from a DOT application before it reaches an
 * employer's browser.
 *
 * The driver owning their DQ file and a carrier reviewing it is the product —
 * that is not what is being restricted. What changes is that SSN, date of birth,
 * and street address never travel over the wire. They exist to be decrypted
 * server-side for a consented screening order, and a DQ review does not need
 * them: the address *history timeline* (city/state/zip and dates) is what
 * 49 CFR 391.21 asks a carrier to review, not the house number.
 *
 * Use the unredacted payload only for the driver's own view.
 */

type Json = Record<string, unknown>

/** Field paths removed for employers. Surfaced to the client so the UI can render
 *  "hidden" rather than an ambiguous blank. */
export const REDACTED_DOT_FIELDS = [
  'form1.socialSecurity',
  'form1.dateOfBirth',
  'form1.currentMailing.street',
  'form1.previousAddresses[].street',
  'form3.ipAddress',
] as const

export interface RedactedDotApp {
  form1: Json | null
  form2: Json | null
  form3: Json | null
  redactedFields: readonly string[]
}

function redactForm1(form1: unknown): Json | null {
  if (!form1 || typeof form1 !== 'object') return null
  const { socialSecurity: _ssn, dateOfBirth: _dob, ...rest } = form1 as Json

  const currentMailing = rest.currentMailing
  if (currentMailing && typeof currentMailing === 'object') {
    const { street: _street, ...mailingRest } = currentMailing as Json
    rest.currentMailing = mailingRest
  }

  if (Array.isArray(rest.previousAddresses)) {
    rest.previousAddresses = (rest.previousAddresses as Json[]).map((addr) => {
      if (!addr || typeof addr !== 'object') return addr
      const { street: _street, ...addrRest } = addr
      return addrRest
    })
  }

  return rest
}

function redactForm3(form3: unknown): Json | null {
  if (!form3 || typeof form3 !== 'object') return null
  // ipAddress is signature metadata captured at submission — audit data for us,
  // not something a carrier needs.
  const { ipAddress: _ip, ...rest } = form3 as Json
  return rest
}

/**
 * Form 2 (accidents, convictions, license actions) carries no raw identifiers,
 * so it passes through unchanged.
 */
export function redactDotAppForEmployer(applicationData: unknown): RedactedDotApp {
  const data = (applicationData ?? {}) as Json

  return {
    form1: redactForm1(data.form1),
    form2: (data.form2 as Json) ?? null,
    form3: redactForm3(data.form3),
    redactedFields: REDACTED_DOT_FIELDS,
  }
}
