'use client'

/**
 * Heritage panel — shared chrome for wide hub panels (career card, DQ progress,
 * referrals, employer sections). Mirrors the landing page's panel language:
 * clean rounded face, hairline border, champagne-gold top hairline, soft depth.
 * (Replaces the old chamfered "vault credential" chrome — DEC: hub containers
 * must read like the homepage, not like tech blocks.)
 */
import { cn } from '@/lib/utils'
import type { VaultAccentPreset } from '@/lib/vault-accent-presets'

export type VaultHorizontalLayout = 'nav' | 'panel'

export interface VaultHorizontalVaultShellProps {
  isDark: boolean
  children: React.ReactNode
  className?: string
  /** Padding around content (nav vs profile header) */
  contentClassName?: string
  /** `nav` = centered max width; `panel` = full width hub section */
  layout?: VaultHorizontalLayout
  /**
   * Kept for API compatibility with existing call sites. The heritage chrome
   * is deliberately uniform (gold is the only accent, like the landing page),
   * so the preset no longer changes the rendering.
   */
  accent?: VaultAccentPreset
}

export default function VaultHorizontalVaultShell({
  isDark,
  children,
  className,
  contentClassName,
  layout = 'panel',
}: VaultHorizontalVaultShellProps) {
  const isNav = layout === 'nav'

  const face = isDark
    ? 'border-white/[0.1] bg-white/[0.035] ring-1 ring-[#f15a2b]/15 shadow-xl shadow-black/40 backdrop-blur-md'
    : 'border-stone-400/45 bg-gradient-to-b from-[#fffdf8] via-[#fbf7ee] to-[#f6efe2] ring-1 ring-[#c43d14]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(41,37,36,0.06),0_16px_40px_-18px_rgba(41,37,36,0.18)]'

  const hairline = isDark ? 'via-[#f15a2b]/40' : 'via-[#c43d14]/35'

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border',
        face,
        isNav && 'mx-auto max-w-3xl',
        className,
      )}
    >
      {/* Gold ledger hairline — the landing panels' signature top edge */}
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent', hairline)}
      />
      <div className={cn('relative', contentClassName)}>{children}</div>
    </div>
  )
}
