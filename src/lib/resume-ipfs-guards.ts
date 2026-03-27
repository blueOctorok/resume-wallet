/**
 * `resumes.ipfs_hash` is sometimes a placeholder until verify/upload (e.g. developer
 * POST uses `'pending'`, built resumes use `built_*`). Those must not be sent to a
 * gateway URL or iframe — they 403 and confuse users.
 */
export function isLiveResumeIpfsHash(h: string | null | undefined): boolean {
  if (h == null || typeof h !== 'string') return false
  const t = h.trim()
  if (!t) return false
  const lower = t.toLowerCase()
  if (lower === 'pending') return false
  if (t.startsWith('built_')) return false
  if (lower.startsWith('placeholder_ipfs_hash_')) return false
  return true
}
