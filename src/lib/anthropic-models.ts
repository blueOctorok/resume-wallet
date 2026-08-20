/**
 * Claude API model strings — keep in sync with:
 * https://docs.anthropic.com/en/docs/about-claude/models
 *
 * Older Haiku 4.5 snapshots (e.g. claude-haiku-4-5-20250414) are removed from the API and return 404.
 */

/** Sonnet 4.6 — Stormi chat / drafting workhorse */
export const ANTHROPIC_MODEL_SONNET = 'claude-sonnet-4-6'
/** Sonnet 5 — DQ file review (identity + MVR/PSP/DOT discrepancies) */
export const ANTHROPIC_MODEL_SONNET_5 = 'claude-sonnet-5'
/** Haiku 4.5 — pinned snapshot for stable behavior */
export const ANTHROPIC_MODEL_HAIKU = 'claude-haiku-4-5-20251001'
