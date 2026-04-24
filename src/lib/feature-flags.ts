/**
 * Feature flags
 *
 * Centralized flag readers so we don't sprinkle raw env access through the
 * codebase. Each flag is a pure function (not a constant) so it can be
 * re-evaluated in tests.
 */

/**
 * Simple Mode (job-first split view) is a staged rollout.
 * - `NEXT_PUBLIC_SIMPLE_MODE_ENABLED=true` → flip on for everyone
 * - Default (unset) → on (the product has graduated past the feature-flag stage
 *   by the time Phase 6 lands; flag stays readable for emergency disable).
 *
 * If the env var is explicitly `false`, Simple mode is suppressed — useful for
 * incident response without a rebuild.
 */
export function isSimpleModeEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_SIMPLE_MODE_ENABLED
  if (raw === 'false' || raw === '0') return false
  return true
}
