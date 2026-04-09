/**
 * Per-section accent for `VaultHorizontalVaultShell` — rim, strip, conic, chamfer, outer glow, inner tint, sheen.
 * Keeps hub “credential” language while giving Job alerts, Referral, Employer requests, STORM distinct moods.
 */
export type VaultAccentPreset = 'teal' | 'sky' | 'violet' | 'indigo' | 'amber'

export interface VaultAccentLayers {
  rimLight: string
  rimDark: string
  stripLight: string
  stripDark: string
  conicLight: string
  conicDark: string
  chamferLight: string
  chamferDark: string
  sweepLight: string
  sweepDark: string
  filterPanelLight: string
  filterPanelDark: string
  filterNavLight: string
  filterNavDark: string
  innerBgLight: string
  innerBgDark: string
  /** Light-mode sheen (multiply) — full gradient utility string */
  sheenLightClassName: string
}

const TEAL: VaultAccentLayers = {
  rimLight:
    'linear-gradient(135deg, rgba(13,148,136,0.42) 0%, rgba(45,212,191,0.16) 20%, transparent 50%, rgba(91,33,182,0.16) 100%)',
  rimDark:
    'linear-gradient(135deg, rgba(45,212,191,0.36) 0%, transparent 50%, rgba(167,139,246,0.2) 100%)',
  stripLight:
    'linear-gradient(90deg, transparent, rgba(13,148,136,0.52), rgba(91,33,182,0.28), transparent)',
  stripDark:
    'linear-gradient(90deg, transparent, rgba(45,212,191,0.38), rgba(139,92,246,0.26), transparent)',
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(13,148,136,0.38) 42deg, rgba(91,33,182,0.18) 100deg, transparent 220deg, rgba(15,118,110,0.28) 300deg, transparent 360deg)',
  conicDark:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(45,212,191,0.28) 42deg, rgba(139,92,246,0.16) 100deg, transparent 220deg, rgba(45,212,191,0.2) 300deg, transparent 360deg)',
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(13,148,136,0.48) 0%, rgba(45,212,191,0.2) 48%, transparent 72%)',
  chamferDark:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(45,212,191,0.48) 0%, transparent 70%)',
  sweepLight: 'linear-gradient(to right, transparent, rgba(13,148,136,0.36), transparent)',
  sweepDark: 'linear-gradient(to right, transparent, rgba(45,212,191,0.22), transparent)',
  filterPanelLight:
    'drop-shadow(0 12px 32px rgba(15,23,42,0.11)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 40px rgba(13,148,136,0.22)) drop-shadow(0 0 60px rgba(91,33,182,0.12))',
  filterPanelDark:
    'drop-shadow(0 10px 32px rgba(0,0,0,0.42)) drop-shadow(0 0 32px rgba(45,212,191,0.14)) drop-shadow(0 0 48px rgba(139,92,246,0.1))',
  filterNavLight:
    'drop-shadow(0 14px 36px rgba(15,23,42,0.12)) drop-shadow(0 4px 16px rgba(15,23,42,0.07)) drop-shadow(0 0 44px rgba(13,148,136,0.2)) drop-shadow(0 0 72px rgba(91,33,182,0.11))',
  filterNavDark:
    'drop-shadow(0 12px 36px rgba(0,0,0,0.45)) drop-shadow(0 0 28px rgba(45,212,191,0.12))',
  innerBgLight:
    'linear-gradient(175deg, rgba(252,254,255,0.96) 0%, rgba(236,248,250,0.9) 40%, rgba(228,238,245,0.92) 72%, rgba(220,232,242,0.94) 100%)',
  innerBgDark:
    'linear-gradient(175deg, rgba(24,30,40,0.96) 0%, rgba(10,13,18,0.98) 100%)',
  sheenLightClassName: 'bg-gradient-to-r from-transparent via-cyan-50/45 to-transparent',
}

const SKY: VaultAccentLayers = {
  rimLight:
    'linear-gradient(135deg, rgba(2,132,199,0.45) 0%, rgba(56,189,248,0.22) 22%, transparent 48%, rgba(14,165,233,0.2) 100%)',
  rimDark:
    'linear-gradient(135deg, rgba(56,189,248,0.38) 0%, rgba(125,211,252,0.12) 35%, transparent 55%, rgba(99,102,241,0.22) 100%)',
  stripLight:
    'linear-gradient(90deg, transparent, rgba(14,165,233,0.55), rgba(56,189,248,0.35), rgba(99,102,241,0.22), transparent)',
  stripDark:
    'linear-gradient(90deg, transparent, rgba(56,189,248,0.42), rgba(129,140,248,0.28), transparent)',
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(14,165,233,0.4) 42deg, rgba(99,102,241,0.2) 100deg, transparent 220deg, rgba(56,189,248,0.32) 300deg, transparent 360deg)',
  conicDark:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(56,189,248,0.32) 42deg, rgba(129,140,248,0.22) 100deg, transparent 220deg, rgba(34,211,238,0.24) 300deg, transparent 360deg)',
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(14,165,233,0.55) 0%, rgba(56,189,248,0.25) 45%, transparent 72%)',
  chamferDark:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(125,211,252,0.45) 0%, transparent 70%)',
  sweepLight: 'linear-gradient(to right, transparent, rgba(2,132,199,0.42), transparent)',
  sweepDark: 'linear-gradient(to right, transparent, rgba(125,211,252,0.28), transparent)',
  filterPanelLight:
    'drop-shadow(0 12px 32px rgba(15,23,42,0.1)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 44px rgba(14,165,233,0.24)) drop-shadow(0 0 56px rgba(99,102,241,0.12))',
  filterPanelDark:
    'drop-shadow(0 10px 32px rgba(0,0,0,0.45)) drop-shadow(0 0 36px rgba(56,189,248,0.18)) drop-shadow(0 0 48px rgba(99,102,241,0.12))',
  filterNavLight:
    'drop-shadow(0 14px 36px rgba(15,23,42,0.11)) drop-shadow(0 0 48px rgba(14,165,233,0.22)) drop-shadow(0 0 64px rgba(56,189,248,0.1))',
  filterNavDark:
    'drop-shadow(0 12px 36px rgba(0,0,0,0.48)) drop-shadow(0 0 32px rgba(56,189,191,0.14))',
  innerBgLight:
    'linear-gradient(175deg, rgba(252,254,255,0.97) 0%, rgba(224,242,254,0.88) 38%, rgba(219,234,254,0.9) 72%, rgba(224,231,255,0.85) 100%)',
  innerBgDark:
    'linear-gradient(175deg, rgba(22,32,42,0.97) 0%, rgba(12,20,32,0.98) 55%, rgba(15,23,42,0.99) 100%)',
  sheenLightClassName: 'bg-gradient-to-r from-transparent via-sky-200/50 to-transparent',
}

const VIOLET: VaultAccentLayers = {
  rimLight:
    'linear-gradient(135deg, rgba(139,92,246,0.42) 0%, rgba(192,132,252,0.2) 22%, transparent 48%, rgba(217,70,239,0.18) 100%)',
  rimDark:
    'linear-gradient(135deg, rgba(167,139,250,0.4) 0%, rgba(192,132,252,0.15) 40%, transparent 52%, rgba(244,114,182,0.18) 100%)',
  stripLight:
    'linear-gradient(90deg, transparent, rgba(139,92,246,0.5), rgba(217,70,239,0.32), rgba(192,132,252,0.28), transparent)',
  stripDark:
    'linear-gradient(90deg, transparent, rgba(167,139,250,0.4), rgba(244,114,182,0.25), transparent)',
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(139,92,246,0.38) 42deg, rgba(217,70,239,0.22) 100deg, transparent 220deg, rgba(192,132,252,0.3) 300deg, transparent 360deg)',
  conicDark:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(167,139,250,0.3) 42deg, rgba(244,114,182,0.2) 100deg, transparent 220deg, rgba(192,132,252,0.22) 300deg, transparent 360deg)',
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(139,92,246,0.52) 0%, rgba(217,70,239,0.22) 45%, transparent 72%)',
  chamferDark:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(192,132,252,0.42) 0%, transparent 70%)',
  sweepLight: 'linear-gradient(to right, transparent, rgba(139,92,246,0.4), transparent)',
  sweepDark: 'linear-gradient(to right, transparent, rgba(192,132,252,0.26), transparent)',
  filterPanelLight:
    'drop-shadow(0 12px 32px rgba(15,23,42,0.1)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 44px rgba(139,92,246,0.22)) drop-shadow(0 0 58px rgba(217,70,239,0.12))',
  filterPanelDark:
    'drop-shadow(0 10px 32px rgba(0,0,0,0.45)) drop-shadow(0 0 38px rgba(167,139,250,0.16)) drop-shadow(0 0 52px rgba(217,70,239,0.1))',
  filterNavLight:
    'drop-shadow(0 14px 36px rgba(15,23,42,0.11)) drop-shadow(0 0 48px rgba(139,92,246,0.2)) drop-shadow(0 0 70px rgba(217,70,239,0.1))',
  filterNavDark:
    'drop-shadow(0 12px 36px rgba(0,0,0,0.48)) drop-shadow(0 0 34px rgba(167,139,250,0.14))',
  innerBgLight:
    'linear-gradient(175deg, rgba(252,254,255,0.97) 0%, rgba(245,243,255,0.9) 40%, rgba(250,245,255,0.92) 72%, rgba(253,242,248,0.88) 100%)',
  innerBgDark:
    'linear-gradient(175deg, rgba(30,24,40,0.97) 0%, rgba(18,14,28,0.98) 55%, rgba(12,10,20,0.99) 100%)',
  sheenLightClassName: 'bg-gradient-to-r from-transparent via-violet-200/45 to-transparent',
}

const INDIGO: VaultAccentLayers = {
  rimLight:
    'linear-gradient(135deg, rgba(79,70,229,0.42) 0%, rgba(99,102,241,0.2) 22%, transparent 48%, rgba(14,165,233,0.2) 100%)',
  rimDark:
    'linear-gradient(135deg, rgba(129,140,248,0.38) 0%, rgba(99,102,241,0.14) 38%, transparent 52%, rgba(45,212,191,0.16) 100%)',
  stripLight:
    'linear-gradient(90deg, transparent, rgba(79,70,229,0.52), rgba(99,102,241,0.35), rgba(14,165,233,0.22), transparent)',
  stripDark:
    'linear-gradient(90deg, transparent, rgba(129,140,248,0.38), rgba(45,212,191,0.22), transparent)',
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(79,70,229,0.38) 42deg, rgba(14,165,233,0.2) 100deg, transparent 220deg, rgba(99,102,241,0.3) 300deg, transparent 360deg)',
  conicDark:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(129,140,248,0.28) 42deg, rgba(45,212,191,0.18) 100deg, transparent 220deg, rgba(99,102,241,0.22) 300deg, transparent 360deg)',
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(79,70,229,0.5) 0%, rgba(99,102,241,0.22) 45%, transparent 72%)',
  chamferDark:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(129,140,248,0.42) 0%, transparent 70%)',
  sweepLight: 'linear-gradient(to right, transparent, rgba(79,70,229,0.38), transparent)',
  sweepDark: 'linear-gradient(to right, transparent, rgba(129,140,248,0.24), transparent)',
  filterPanelLight:
    'drop-shadow(0 12px 32px rgba(15,23,42,0.1)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 42px rgba(79,70,229,0.22)) drop-shadow(0 0 56px rgba(14,165,233,0.12))',
  filterPanelDark:
    'drop-shadow(0 10px 32px rgba(0,0,0,0.45)) drop-shadow(0 0 36px rgba(129,140,248,0.16)) drop-shadow(0 0 48px rgba(45,212,191,0.08))',
  filterNavLight:
    'drop-shadow(0 14px 36px rgba(15,23,42,0.11)) drop-shadow(0 0 46px rgba(79,70,229,0.2)) drop-shadow(0 0 64px rgba(14,165,233,0.1))',
  filterNavDark:
    'drop-shadow(0 12px 36px rgba(0,0,0,0.48)) drop-shadow(0 0 32px rgba(129,140,248,0.14))',
  innerBgLight:
    'linear-gradient(175deg, rgba(252,254,255,0.97) 0%, rgba(238,242,255,0.9) 40%, rgba(224,242,254,0.88) 72%, rgba(241,245,249,0.92) 100%)',
  innerBgDark:
    'linear-gradient(175deg, rgba(24,26,40,0.97) 0%, rgba(15,18,32,0.98) 55%, rgba(10,12,24,0.99) 100%)',
  sheenLightClassName: 'bg-gradient-to-r from-transparent via-indigo-200/45 to-transparent',
}

const AMBER: VaultAccentLayers = {
  rimLight:
    'linear-gradient(135deg, rgba(245,158,11,0.48) 0%, rgba(251,191,36,0.24) 20%, transparent 48%, rgba(13,148,136,0.22) 100%)',
  rimDark:
    'linear-gradient(135deg, rgba(251,191,36,0.35) 0%, rgba(245,158,11,0.18) 38%, transparent 52%, rgba(45,212,191,0.18) 100%)',
  stripLight:
    'linear-gradient(90deg, transparent, rgba(245,158,11,0.55), rgba(251,191,36,0.38), rgba(13,148,136,0.28), transparent)',
  stripDark:
    'linear-gradient(90deg, transparent, rgba(251,191,36,0.38), rgba(45,212,191,0.22), transparent)',
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(245,158,11,0.4) 42deg, rgba(13,148,136,0.2) 100deg, transparent 220deg, rgba(251,191,36,0.32) 300deg, transparent 360deg)',
  conicDark:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(251,191,36,0.28) 42deg, rgba(45,212,191,0.18) 100deg, transparent 220deg, rgba(245,158,11,0.22) 300deg, transparent 360deg)',
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(245,158,11,0.55) 0%, rgba(251,191,36,0.28) 45%, transparent 72%)',
  chamferDark:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(251,191,36,0.4) 0%, transparent 70%)',
  sweepLight: 'linear-gradient(to right, transparent, rgba(217,119,6,0.4), transparent)',
  sweepDark: 'linear-gradient(to right, transparent, rgba(251,191,36,0.26), transparent)',
  filterPanelLight:
    'drop-shadow(0 12px 32px rgba(15,23,42,0.1)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 44px rgba(245,158,11,0.2)) drop-shadow(0 0 52px rgba(13,148,136,0.12))',
  filterPanelDark:
    'drop-shadow(0 10px 32px rgba(0,0,0,0.45)) drop-shadow(0 0 38px rgba(251,191,36,0.14)) drop-shadow(0 0 48px rgba(45,212,191,0.08))',
  filterNavLight:
    'drop-shadow(0 14px 36px rgba(15,23,42,0.11)) drop-shadow(0 0 48px rgba(245,158,11,0.18)) drop-shadow(0 0 60px rgba(13,148,136,0.1))',
  filterNavDark:
    'drop-shadow(0 12px 36px rgba(0,0,0,0.48)) drop-shadow(0 0 32px rgba(251,191,36,0.12))',
  innerBgLight:
    'linear-gradient(175deg, rgba(255,253,250,0.98) 0%, rgba(254,252,232,0.92) 38%, rgba(240,253,250,0.88) 72%, rgba(228,238,245,0.92) 100%)',
  innerBgDark:
    'linear-gradient(175deg, rgba(32,28,20,0.97) 0%, rgba(20,18,12,0.98) 55%, rgba(12,11,8,0.99) 100%)',
  sheenLightClassName: 'bg-gradient-to-r from-transparent via-amber-200/45 to-transparent',
}

const PRESETS: Record<VaultAccentPreset, VaultAccentLayers> = {
  teal: TEAL,
  sky: SKY,
  violet: VIOLET,
  indigo: INDIGO,
  amber: AMBER,
}

export function getVaultAccentLayers(preset: VaultAccentPreset): VaultAccentLayers {
  return PRESETS[preset] ?? TEAL
}

/**
 * Kindle-style sepia cream shell, no teal/violet rim glow — easy on the eyes.
 * Used when `data-theme='sepia'`.
 */
export const SEPIA_KINDLE_VAULT_SHELL: VaultAccentLayers = {
  rimLight:
    'linear-gradient(135deg, rgba(188,170,148,0.28) 0%, rgba(250,243,230,0.55) 42%, transparent 62%, rgba(168,155,138,0.18) 100%)',
  rimDark: TEAL.rimDark,
  stripLight: 'linear-gradient(90deg, transparent, rgba(150,138,122,0.22), transparent)',
  stripDark: TEAL.stripDark,
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(140,128,112,0.1) 90deg, transparent 220deg, rgba(130,118,104,0.06) 300deg, transparent 360deg)',
  conicDark: TEAL.conicDark,
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(148,136,120,0.22) 0%, transparent 72%)',
  chamferDark: TEAL.chamferDark,
  sweepLight: 'linear-gradient(to right, transparent, rgba(130,120,108,0.12), transparent)',
  sweepDark: TEAL.sweepDark,
  filterPanelLight:
    'drop-shadow(0 10px 26px rgba(52,46,40,0.06)) drop-shadow(0 2px 8px rgba(52,46,40,0.035))',
  filterPanelDark: TEAL.filterPanelDark,
  filterNavLight:
    'drop-shadow(0 12px 28px rgba(52,46,40,0.07)) drop-shadow(0 2px 10px rgba(52,46,40,0.04))',
  filterNavDark: TEAL.filterNavDark,
  innerBgLight:
    'linear-gradient(175deg, rgba(252,247,236,0.99) 0%, rgba(244,234,218,0.98) 38%, rgba(238,226,208,0.97) 72%, rgba(232,220,198,0.98) 100%)',
  innerBgDark: TEAL.innerBgDark,
  sheenLightClassName: 'bg-gradient-to-r from-transparent via-amber-100/20 to-transparent',
}

/** Grey newsprint hub shell — no teal/violet; cool neutral ink on stock. */
export const PAPER_NEWSPRINT_VAULT_SHELL: VaultAccentLayers = {
  rimLight:
    'linear-gradient(135deg, rgba(148,148,156,0.22) 0%, rgba(252,252,252,0.55) 42%, transparent 62%, rgba(120,120,128,0.14) 100%)',
  rimDark: TEAL.rimDark,
  stripLight: 'linear-gradient(90deg, transparent, rgba(100,116,128,0.18), transparent)',
  stripDark: TEAL.stripDark,
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(100,116,128,0.08) 90deg, transparent 220deg, rgba(90,98,108,0.05) 300deg, transparent 360deg)',
  conicDark: TEAL.conicDark,
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(110,118,128,0.18) 0%, transparent 72%)',
  chamferDark: TEAL.chamferDark,
  sweepLight: 'linear-gradient(to right, transparent, rgba(100,108,118,0.1), transparent)',
  sweepDark: TEAL.sweepDark,
  filterPanelLight:
    'drop-shadow(0 10px 26px rgba(15,23,42,0.05)) drop-shadow(0 2px 8px rgba(15,23,42,0.03))',
  filterPanelDark: TEAL.filterPanelDark,
  filterNavLight:
    'drop-shadow(0 12px 28px rgba(15,23,42,0.06)) drop-shadow(0 2px 10px rgba(15,23,42,0.035))',
  filterNavDark: TEAL.filterNavDark,
  innerBgLight:
    'linear-gradient(175deg, rgba(252,252,252,0.995) 0%, rgba(244,244,246,0.98) 38%, rgba(236,236,240,0.97) 72%, rgba(230,230,234,0.98) 100%)',
  innerBgDark: TEAL.innerBgDark,
  sheenLightClassName: 'bg-gradient-to-r from-transparent via-zinc-200/25 to-transparent',
}

export function getVaultAccentLayersForTheme(
  preset: VaultAccentPreset,
  theme: 'light' | 'dark' | 'sepia' | 'paper',
): VaultAccentLayers {
  if (theme === 'sepia') return SEPIA_KINDLE_VAULT_SHELL
  if (theme === 'paper') return PAPER_NEWSPRINT_VAULT_SHELL
  return getVaultAccentLayers(preset)
}
