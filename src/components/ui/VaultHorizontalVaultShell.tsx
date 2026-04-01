'use client'

/**
 * Horizontal vault credential (chamfer top-right) — shared by nav rail and wide panels
 * (e.g. hub profile header). Decorative clip stays behind content; children stay unclipped.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { VAULT_CLIP_HORIZONTAL } from '@/lib/vault-credential-geometry'
import VaultLightFrostTexture from '@/components/ui/VaultLightFrostTexture'
import { getVaultAccentLayersForTheme, type VaultAccentPreset } from '@/lib/vault-accent-presets'
import { useTheme } from '@/contexts/ThemeContext'

export type VaultHorizontalLayout = 'nav' | 'panel'

export interface VaultHorizontalVaultShellProps {
  isDark: boolean
  children: React.ReactNode
  className?: string
  /** Padding around content (nav vs profile header) */
  contentClassName?: string
  /** `nav` = centered max width + stronger outer glow; `panel` = full width hub header */
  layout?: VaultHorizontalLayout
  /** Rim, strip, conic, and glow tuned per hub section (default matches profile/nav teal) */
  accent?: VaultAccentPreset
}

export default function VaultHorizontalVaultShell({
  isDark,
  children,
  className,
  contentClassName,
  layout = 'panel',
  accent = 'teal',
}: VaultHorizontalVaultShellProps) {
  const { theme } = useTheme()
  const clip = { clipPath: VAULT_CLIP_HORIZONTAL }
  const isNav = layout === 'nav'
  const frostVariant = isNav ? 'bar' : 'tile'
  const A = getVaultAccentLayersForTheme(accent, theme)
  const paperKindle = theme === 'paper' && !isDark

  const innerBg = isDark ? A.innerBgDark : A.innerBgLight

  const outerFilter = isNav
    ? isDark
      ? A.filterNavDark
      : A.filterNavLight
    : isDark
      ? A.filterPanelDark
      : A.filterPanelLight

  return (
    <div
      className={cn(
        'relative w-full overflow-visible pointer-events-auto',
        isNav && 'mx-auto max-w-2xl',
        className,
      )}
      style={{ filter: outerFilter }}
    >
      <div className='pointer-events-none absolute inset-0 z-0 overflow-hidden' style={clip}>
        <span
          aria-hidden
          className='absolute inset-0'
          style={{ ...clip, background: isDark ? A.rimDark : A.rimLight }}
        />

        <span
          aria-hidden
          className={cn(
            'vault-conic-slow absolute -inset-[20%] motion-reduce:opacity-0',
            isDark ? 'mix-blend-plus-lighter opacity-[0.16]' : 'mix-blend-multiply opacity-[0.17]',
          )}
          style={{
            ...clip,
            background: isDark ? A.conicDark : A.conicLight,
          }}
        />

        <span
          aria-hidden
          className='absolute right-0 top-0 z-[2] h-6 w-12 max-w-[20%] translate-x-px -translate-y-px sm:h-7 sm:w-14'
          style={{
            background: isDark ? A.chamferDark : A.chamferLight,
            filter: 'blur(3px)',
          }}
        />

        <div
          aria-hidden
          className={cn(
            'absolute inset-[2px] overflow-hidden',
            'shadow-[inset_0_0_22px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_26px_rgba(0,0,0,0.38)]',
            isDark
              ? 'backdrop-blur-xl ring-1 ring-white/[0.06]'
              : paperKindle
                ? 'backdrop-blur-xl backdrop-saturate-[0.92] shadow-[inset_0_0_0_1px_rgba(120,108,92,0.07),inset_0_0_36px_rgba(58,52,46,0.035),inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-amber-900/12'
                : 'backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.11),inset_0_0_40px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.88)] ring-1 ring-slate-400/55',
          )}
          style={{ ...clip, background: innerBg }}
        >
          {isDark ? (
            <span className='pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.055)_1px,transparent_1.5px)] [background-size:6px_6px] opacity-100' />
          ) : (
            <VaultLightFrostTexture variant={frostVariant} />
          )}
          {!isDark && paperKindle && (
            <span className='pointer-events-none absolute -left-[6%] top-0 h-[48%] w-[44%] rotate-[11deg] bg-gradient-to-br from-white/45 via-amber-50/10 to-transparent opacity-45' />
          )}
          {!isDark && !paperKindle && (
            <span className='pointer-events-none absolute -left-[6%] top-0 h-[48%] w-[44%] rotate-[11deg] bg-gradient-to-br from-white/75 via-cyan-50/25 to-transparent opacity-60' />
          )}
          <span
            className={cn(
              'vault-sheen-layer pointer-events-none absolute inset-y-0 left-0',
              isDark
                ? 'w-[40%] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent'
                : cn(
                    A.sheenLightClassName,
                    'mix-blend-multiply',
                    isNav ? 'w-[58%] opacity-90' : 'w-[52%] opacity-86',
                  ),
            )}
          />
          <div aria-hidden className='absolute bottom-0 left-0 right-0 z-[1] h-[3px] overflow-hidden'>
            <span className='absolute inset-0' style={{ background: isDark ? A.stripDark : A.stripLight }} />
            <span
              className='vault-strip-sweep-el pointer-events-none absolute inset-y-0 w-[30%] opacity-90'
              style={{
                background: isDark ? A.sweepDark : A.sweepLight,
              }}
            />
          </div>
        </div>
      </div>

      <div className={cn('relative z-[4]', contentClassName)}>{children}</div>
    </div>
  )
}
