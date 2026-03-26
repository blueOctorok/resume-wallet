/**
 * Claude API model strings — keep in sync with:
 * https://docs.anthropic.com/en/docs/about-claude/models
 *
 * Older Haiku 4.5 snapshots (e.g. claude-haiku-4-5-20250414) are removed from the API and return 404.
 */

export const ANTHROPIC_MODEL_SONNET = 'claude-sonnet-4-6'
/** Haiku 4.5 — pinned snapshot for stable behavior */
export const ANTHROPIC_MODEL_HAIKU = 'claude-haiku-4-5-20251001'
