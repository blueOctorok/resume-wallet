/**
 * Normalize a US-centric phone string to E.164 for Pingram SMS.
 * Accepts +1…, 10-digit, or 11-digit starting with 1.
 * Returns null when the input cannot be normalized.
 */
export function normalizeToE164(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Already looks like E.164 with country code
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) {
    return trimmed
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  // International without +: keep if 8–15 digits
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`
  }
  return null
}
