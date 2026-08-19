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
    ? 'border-white/[0.1] bg-white/[0.035] ring-1 ring-white/[0.08] shadow-xl shadow-black/40 backdrop-blur-md'
    : // Paper face: white in Light, same cream as the inverted Dark-mode nav.
      'border-ironside/30 bg-white dark:bg-[#fbf8f1]/92 ring-1 ring-[#173150]/[0.06] shadow-[0_24px_70px_-18px_rgba(0,0,0,0.18),0_0_0_1px_rgba(23,49,80,0.04)]'

  const hairline = isDark ? 'via-[#f15a2b]/40' : 'via-[#f15a2b]/35'

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
