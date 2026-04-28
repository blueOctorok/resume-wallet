/** Max career card pages (user-facing). Beyond this the UI discourages more breaks. */
export const CARD_PAGE_MAX = 5

/** Hub block `config.cardPage` — which flip page the section appears on (1-based). */
export function readCardPage(config: Record<string, unknown> | null | undefined): number {
  const raw = config?.cardPage
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return 1
  return Math.min(CARD_PAGE_MAX, Math.max(1, Math.floor(n)))
}
