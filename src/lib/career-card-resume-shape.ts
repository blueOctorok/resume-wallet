/** Developer builder persists `experience[]`; driver/general use `employments[]`. */
export function isDeveloperResumeStructured(sd: unknown): boolean {
  if (!sd || typeof sd !== 'object') return false
  return Array.isArray((sd as Record<string, unknown>).experience)
}
