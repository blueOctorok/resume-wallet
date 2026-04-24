/**
 * Adzuna "smart defaults" — seed external search from hub onboarding + installed
 * blocks so the first result set isn't a random firehose (Phase 5).
 *
 * Pure helpers only; network calls stay in `useJobSearch` / API routes.
 */

export interface HubOnboardingLike {
  occupation?: string | null
  /** Future: city/state from profile — Adzuna location string */
  locationHint?: string | null
}

export function buildAdzunaSmartDefaults(
  onboarding: HubOnboardingLike | null | undefined,
  installedBlockTypes: string[],
): { keywords: string; location: string } {
  const occ = onboarding?.occupation?.trim() ?? ''
  const loc = onboarding?.locationHint?.trim() ?? ''

  const hints: string[] = []
  if (installedBlockTypes.some((t) => t.includes('driver') || t === 'driver-cdl-credentials')) {
    hints.push('truck driver')
  }
  if (installedBlockTypes.some((t) => t.includes('developer') || t === 'developer-github')) {
    hints.push('software engineer')
  }

  const keywordParts = [occ, ...hints].filter(Boolean)
  const keywords = keywordParts.length ? keywordParts.join(' ') : ''

  return { keywords, location: loc }
}
