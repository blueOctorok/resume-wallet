/**
 * Shared chamfer for “vault credential” silhouette (hub tiles + STORM wordmark O).
 *
 * Hub cells are large — a fixed px cut stays crisp. Small marks that need a chamfer to scale with
 * size can use the proportional clip (not used by the current STORM wordmark O, which is a square block).
 */
export const VAULT_CLIP =
  'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 0 100%)'

/** Scales with element size — use for STORM logo O and other small vault marks */
export const VAULT_CLIP_PROPORTIONAL =
  'polygon(0 0, calc(100% - 26%) 0, 100% 26%, 100% 100%, 0 100%)'

/** Full wordmark credential bar — shallow chamfer on trailing top-right */
export const VAULT_CLIP_HORIZONTAL =
  'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)'
