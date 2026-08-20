/**
 * Strip Accio order-submission placeholders from MVR display.
 *
 * When Storm places an MVR without a phone on file, accio-xml-builder used to
 * send `<phone_number>555-555-5555</phone_number>`. Accio echoes that in the
 * result `<subject>` block — it is NOT DMV data. Same for gender `U` (Unknown)
 * when we never collected sex from the candidate.
 */

const PLACEHOLDER_PHONE_RE =
  /^(?:\+?1[-.\s]*)?(?:\(?555\)?[-.\s]*){2}5555$|^5555555555$/

export function isPlaceholderPhone(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false
  const normalized = phone.trim()
  if (PLACEHOLDER_PHONE_RE.test(normalized.replace(/\s/g, ''))) return true
  const digits = normalized.replace(/\D/g, '')
  return digits === '5555555555'
}

export function sanitizeSubjectPhone(
  phone: string | null | undefined,
): string | undefined {
  if (!phone?.trim()) return undefined
  if (isPlaceholderPhone(phone)) return undefined
  return phone.trim()
}

/** DOT Form 1 / PhoneInput mask: (XXX) XXX-XXXX. Empty if placeholder or not 10 US digits. */
export function formatPhoneForDotForm(phone: string | null | undefined): string {
  const cleaned = sanitizeSubjectPhone(phone)
  if (!cleaned) return ''
  const digits = cleaned.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length !== 10) return ''
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

export function isUnknownGender(gender: string | null | undefined): boolean {
  if (!gender?.trim()) return true
  const g = gender.trim().toUpperCase()
  return g === 'U' || g === 'UNKNOWN' || g === 'UNSPECIFIED' || g === 'X'
}

export function sanitizeSubjectGender(
  gender: string | null | undefined,
): string | undefined {
  if (isUnknownGender(gender)) return undefined
  return gender!.trim()
}

/** Prefer real subject phone; fall back to user_profiles when subject is a placeholder. */
export function resolveDisplayPhone(
  subjectPhone: string | null | undefined,
  profilePhone?: string | null,
): string | undefined {
  const fromSubject = sanitizeSubjectPhone(subjectPhone)
  if (fromSubject) return fromSubject
  return sanitizeSubjectPhone(profilePhone)
}

export function formatDisplayGender(
  gender: string | null | undefined,
): string | undefined {
  const cleaned = sanitizeSubjectGender(gender)
  if (!cleaned) return undefined
  const g = cleaned.toUpperCase()
  if (g === 'M') return 'Male'
  if (g === 'F') return 'Female'
  return cleaned
}

export interface MvrPersonalCharacteristics {
  sex?: string
  weight?: string
  height?: string
  eyes?: string
  hair?: string
  donor?: string
  age?: number
}

/** True when the DMV text block returned at least one physical descriptor (not age alone). */
export function hasDmvPersonalCharacteristics(
  pc: MvrPersonalCharacteristics | null | undefined,
): boolean {
  if (!pc) return false
  return Boolean(
    pc.sex?.trim() ||
      pc.weight?.trim() ||
      pc.height?.trim() ||
      pc.eyes?.trim() ||
      pc.hair?.trim() ||
      pc.donor?.trim(),
  )
}

/**
 * WI (and some other states) send pipe-delimited fields where each segment
 * repeats the previous text and appends the next restriction — e.g.
 * "E- Foo | E- Foo- H- Bar | E- Foo- H- Bar- Corr Lenses". Accio stores the
 * full chain verbatim. For PDF/UI, keep only the last segment (the complete list).
 */
export function collapseCumulativePipeField(
  value: string | null | undefined,
): string | undefined {
  if (!value?.trim()) return undefined
  const parts = value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return undefined
  return parts[parts.length - 1]
}
