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
    'linear-gradient(135deg, rgba(156,119,64,0.42) 0%, rgba(205,168,104,0.16) 20%, transparent 50%, rgba(54,69,89,0.16) 100%)',
  rimDark:
    'linear-gradient(135deg, rgba(205,168,104,0.36) 0%, transparent 50%, rgba(127,151,184,0.2) 100%)',
  stripLight:
    'linear-gradient(90deg, transparent, rgba(156,119,64,0.52), rgba(54,69,89,0.28), transparent)',
  stripDark:
    'linear-gradient(90deg, transparent, rgba(205,168,104,0.38), rgba(95,122,158,0.26), transparent)',
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(156,119,64,0.38) 42deg, rgba(54,69,89,0.18) 100deg, transparent 220deg, rgba(125,94,51,0.28) 300deg, transparent 360deg)',
  conicDark:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(205,168,104,0.28) 42deg, rgba(95,122,158,0.16) 100deg, transparent 220deg, rgba(205,168,104,0.2) 300deg, transparent 360deg)',
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(156,119,64,0.48) 0%, rgba(205,168,104,0.2) 48%, transparent 72%)',
  chamferDark:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(205,168,104,0.48) 0%, transparent 70%)',
  sweepLight: 'linear-gradient(to right, transparent, rgba(156,119,64,0.36), transparent)',
  sweepDark: 'linear-gradient(to right, transparent, rgba(205,168,104,0.22), transparent)',
  filterPanelLight:
    'drop-shadow(0 12px 32px rgba(15,23,42,0.11)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 40px rgba(156,119,64,0.22)) drop-shadow(0 0 60px rgba(54,69,89,0.12))',
  filterPanelDark:
    'drop-shadow(0 10px 32px rgba(0,0,0,0.42)) drop-shadow(0 0 32px rgba(205,168,104,0.14)) drop-shadow(0 0 48px rgba(95,122,158,0.1))',
  filterNavLight:
    'drop-shadow(0 14px 36px rgba(15,23,42,0.12)) drop-shadow(0 4px 16px rgba(15,23,42,0.07)) drop-shadow(0 0 44px rgba(156,119,64,0.2)) drop-shadow(0 0 72px rgba(54,69,89,0.11))',
  filterNavDark:
    'drop-shadow(0 12px 36px rgba(0,0,0,0.45)) drop-shadow(0 0 28px rgba(205,168,104,0.12))',
  /* Heritage faces: warm cream (light) / ink-navy glass (dark) — matches landing plane */
  innerBgLight:
    'linear-gradient(175deg, rgba(255,254,250,0.96) 0%, rgba(250,245,236,0.9) 40%, rgba(245,238,226,0.92) 72%, rgba(240,232,218,0.94) 100%)',
  innerBgDark:
    'linear-gradient(175deg, rgba(22,32,51,0.96) 0%, rgba(9,15,26,0.98) 100%)',
  sheenLightClassName: 'bg-gradient-to-r from-transparent via-[#f4ecd9]/50 to-transparent',
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
    'linear-gradient(135deg, rgba(95,122,158,0.42) 0%, rgba(170,187,210,0.2) 22%, transparent 48%, rgba(127,151,184,0.18) 100%)',
  rimDark:
    'linear-gradient(135deg, rgba(127,151,184,0.4) 0%, rgba(170,187,210,0.15) 40%, transparent 52%, rgba(244,114,182,0.18) 100%)',
  stripLight:
    'linear-gradient(90deg, transparent, rgba(95,122,158,0.5), rgba(127,151,184,0.32), rgba(170,187,210,0.28), transparent)',
  stripDark:
    'linear-gradient(90deg, transparent, rgba(127,151,184,0.4), rgba(244,114,182,0.25), transparent)',
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(95,122,158,0.38) 42deg, rgba(127,151,184,0.22) 100deg, transparent 220deg, rgba(170,187,210,0.3) 300deg, transparent 360deg)',
  conicDark:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(127,151,184,0.3) 42deg, rgba(244,114,182,0.2) 100deg, transparent 220deg, rgba(170,187,210,0.22) 300deg, transparent 360deg)',
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(95,122,158,0.52) 0%, rgba(127,151,184,0.22) 45%, transparent 72%)',
  chamferDark:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(170,187,210,0.42) 0%, transparent 70%)',
  sweepLight: 'linear-gradient(to right, transparent, rgba(95,122,158,0.4), transparent)',
  sweepDark: 'linear-gradient(to right, transparent, rgba(170,187,210,0.26), transparent)',
  filterPanelLight:
    'drop-shadow(0 12px 32px rgba(15,23,42,0.1)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 44px rgba(95,122,158,0.22)) drop-shadow(0 0 58px rgba(127,151,184,0.12))',
  filterPanelDark:
    'drop-shadow(0 10px 32px rgba(0,0,0,0.45)) drop-shadow(0 0 38px rgba(127,151,184,0.16)) drop-shadow(0 0 52px rgba(127,151,184,0.1))',
  filterNavLight:
    'drop-shadow(0 14px 36px rgba(15,23,42,0.11)) drop-shadow(0 0 48px rgba(95,122,158,0.2)) drop-shadow(0 0 70px rgba(127,151,184,0.1))',
  filterNavDark:
    'drop-shadow(0 12px 36px rgba(0,0,0,0.48)) drop-shadow(0 0 34px rgba(127,151,184,0.14))',
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
    'linear-gradient(135deg, rgba(129,140,248,0.38) 0%, rgba(99,102,241,0.14) 38%, transparent 52%, rgba(205,168,104,0.16) 100%)',
  stripLight:
    'linear-gradient(90deg, transparent, rgba(79,70,229,0.52), rgba(99,102,241,0.35), rgba(14,165,233,0.22), transparent)',
  stripDark:
    'linear-gradient(90deg, transparent, rgba(129,140,248,0.38), rgba(205,168,104,0.22), transparent)',
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(79,70,229,0.38) 42deg, rgba(14,165,233,0.2) 100deg, transparent 220deg, rgba(99,102,241,0.3) 300deg, transparent 360deg)',
  conicDark:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(129,140,248,0.28) 42deg, rgba(205,168,104,0.18) 100deg, transparent 220deg, rgba(99,102,241,0.22) 300deg, transparent 360deg)',
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(79,70,229,0.5) 0%, rgba(99,102,241,0.22) 45%, transparent 72%)',
  chamferDark:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(129,140,248,0.42) 0%, transparent 70%)',
  sweepLight: 'linear-gradient(to right, transparent, rgba(79,70,229,0.38), transparent)',
  sweepDark: 'linear-gradient(to right, transparent, rgba(129,140,248,0.24), transparent)',
  filterPanelLight:
    'drop-shadow(0 12px 32px rgba(15,23,42,0.1)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 42px rgba(79,70,229,0.22)) drop-shadow(0 0 56px rgba(14,165,233,0.12))',
  filterPanelDark:
    'drop-shadow(0 10px 32px rgba(0,0,0,0.45)) drop-shadow(0 0 36px rgba(129,140,248,0.16)) drop-shadow(0 0 48px rgba(205,168,104,0.08))',
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
    'linear-gradient(135deg, rgba(245,158,11,0.48) 0%, rgba(251,191,36,0.24) 20%, transparent 48%, rgba(156,119,64,0.22) 100%)',
  rimDark:
    'linear-gradient(135deg, rgba(251,191,36,0.35) 0%, rgba(245,158,11,0.18) 38%, transparent 52%, rgba(205,168,104,0.18) 100%)',
  stripLight:
    'linear-gradient(90deg, transparent, rgba(245,158,11,0.55), rgba(251,191,36,0.38), rgba(156,119,64,0.28), transparent)',
  stripDark:
    'linear-gradient(90deg, transparent, rgba(251,191,36,0.38), rgba(205,168,104,0.22), transparent)',
  conicLight:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(245,158,11,0.4) 42deg, rgba(156,119,64,0.2) 100deg, transparent 220deg, rgba(251,191,36,0.32) 300deg, transparent 360deg)',
  conicDark:
    'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(251,191,36,0.28) 42deg, rgba(205,168,104,0.18) 100deg, transparent 220deg, rgba(245,158,11,0.22) 300deg, transparent 360deg)',
  chamferLight:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(245,158,11,0.55) 0%, rgba(251,191,36,0.28) 45%, transparent 72%)',
  chamferDark:
    'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(251,191,36,0.4) 0%, transparent 70%)',
  sweepLight: 'linear-gradient(to right, transparent, rgba(217,119,6,0.4), transparent)',
  sweepDark: 'linear-gradient(to right, transparent, rgba(251,191,36,0.26), transparent)',
  filterPanelLight:
    'drop-shadow(0 12px 32px rgba(15,23,42,0.1)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 44px rgba(245,158,11,0.2)) drop-shadow(0 0 52px rgba(156,119,64,0.12))',
  filterPanelDark:
    'drop-shadow(0 10px 32px rgba(0,0,0,0.45)) drop-shadow(0 0 38px rgba(251,191,36,0.14)) drop-shadow(0 0 48px rgba(205,168,104,0.08))',
  filterNavLight:
    'drop-shadow(0 14px 36px rgba(15,23,42,0.11)) drop-shadow(0 0 48px rgba(245,158,11,0.18)) drop-shadow(0 0 60px rgba(156,119,64,0.1))',
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
