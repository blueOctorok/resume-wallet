'use client'

/**
 * Horizontal vault credential (chamfer top-right) — shared by nav rail and wide panels
 * (e.g. hub profile header). Decorative clip stays behind content; children stay unclipped.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { VAULT_CLIP_HORIZONTAL } from '@/lib/vault-credential-geometry'
import VaultLightFrostTexture from '@/components/ui/VaultLightFrostTexture'

const RIM_LIGHT =
  'linear-gradient(135deg, rgba(13,148,136,0.42) 0%, rgba(45,212,191,0.16) 20%, transparent 50%, rgba(91,33,182,0.16) 100%)'
const RIM_DARK =
  'linear-gradient(135deg, rgba(45,212,191,0.36) 0%, transparent 50%, rgba(167,139,246,0.2) 100%)'

const STRIP_LIGHT =
  'linear-gradient(90deg, transparent, rgba(13,148,136,0.52), rgba(91,33,182,0.28), transparent)'
const STRIP_DARK =
  'linear-gradient(90deg, transparent, rgba(45,212,191,0.38), rgba(139,92,246,0.26), transparent)'

export type VaultHorizontalLayout = 'nav' | 'panel'

export interface VaultHorizontalVaultShellProps {
  isDark: boolean
  children: React.ReactNode
  className?: string
  /** Padding around content (nav vs profile header) */
  contentClassName?: string
  /** `nav` = centered max width + stronger outer glow; `panel` = full width hub header */
  layout?: VaultHorizontalLayout
}

export default function VaultHorizontalVaultShell({
  isDark,
  children,
  className,
  contentClassName,
  layout = 'panel',
}: VaultHorizontalVaultShellProps) {
  const clip = { clipPath: VAULT_CLIP_HORIZONTAL }
  const isNav = layout === 'nav'
  const frostVariant = isNav ? 'bar' : 'tile'

  const innerBg = isDark
    ? 'linear-gradient(175deg, rgba(24,30,40,0.96) 0%, rgba(10,13,18,0.98) 100%)'
    : 'linear-gradient(175deg, rgba(252,254,255,0.96) 0%, rgba(236,248,250,0.9) 40%, rgba(228,238,245,0.92) 72%, rgba(220,232,242,0.94) 100%)'

  const outerFilter = isNav
    ? isDark
      ? 'drop-shadow(0 12px 36px rgba(0,0,0,0.45)) drop-shadow(0 0 28px rgba(45,212,191,0.12))'
      : 'drop-shadow(0 14px 36px rgba(15,23,42,0.12)) drop-shadow(0 4px 16px rgba(15,23,42,0.07)) drop-shadow(0 0 44px rgba(13,148,136,0.2)) drop-shadow(0 0 72px rgba(91,33,182,0.11))'
    : isDark
      ? 'drop-shadow(0 10px 32px rgba(0,0,0,0.42)) drop-shadow(0 0 32px rgba(45,212,191,0.14)) drop-shadow(0 0 48px rgba(139,92,246,0.1))'
      : 'drop-shadow(0 12px 32px rgba(15,23,42,0.11)) drop-shadow(0 4px 14px rgba(15,23,42,0.06)) drop-shadow(0 0 40px rgba(13,148,136,0.22)) drop-shadow(0 0 60px rgba(91,33,182,0.12))'

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
          style={{ ...clip, background: isDark ? RIM_DARK : RIM_LIGHT }}
        />

        <span
          aria-hidden
          className={cn(
            'vault-conic-slow absolute -inset-[20%] motion-reduce:opacity-0',
            isDark ? 'mix-blend-plus-lighter opacity-[0.16]' : 'mix-blend-multiply opacity-[0.17]',
          )}
          style={{
            ...clip,
            background: isDark
              ? 'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(45,212,191,0.28) 42deg, rgba(139,92,246,0.16) 100deg, transparent 220deg, rgba(45,212,191,0.2) 300deg, transparent 360deg)'
              : 'conic-gradient(from 200deg at 88% 0%, transparent 0deg, rgba(13,148,136,0.38) 42deg, rgba(91,33,182,0.18) 100deg, transparent 220deg, rgba(15,118,110,0.28) 300deg, transparent 360deg)',
          }}
        />

        <span
          aria-hidden
          className='absolute right-0 top-0 z-[2] h-6 w-12 max-w-[20%] translate-x-px -translate-y-px sm:h-7 sm:w-14'
          style={{
            background: isDark
              ? 'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(45,212,191,0.48) 0%, transparent 70%)'
              : 'radial-gradient(ellipse 75% 75% at 88% 12%, rgba(13,148,136,0.48) 0%, rgba(45,212,191,0.2) 48%, transparent 72%)',
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
              : 'backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.11),inset_0_0_40px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.88)] ring-1 ring-slate-400/55',
          )}
          style={{ ...clip, background: innerBg }}
        >
          {isDark ? (
            <span className='pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.055)_1px,transparent_1.5px)] [background-size:6px_6px] opacity-100' />
          ) : (
            <VaultLightFrostTexture variant={frostVariant} />
          )}
          {!isDark && (
            <span className='pointer-events-none absolute -left-[6%] top-0 h-[48%] w-[44%] rotate-[11deg] bg-gradient-to-br from-white/75 via-cyan-50/25 to-transparent opacity-60' />
          )}
          <span
            className={cn(
              'vault-sheen-layer pointer-events-none absolute inset-y-0 left-0',
              isDark
                ? 'w-[40%] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent'
                : cn(
                    'bg-gradient-to-r from-transparent via-cyan-50/45 to-transparent mix-blend-multiply',
                    isNav ? 'w-[58%] opacity-90' : 'w-[52%] opacity-86',
                  ),
            )}
          />
          <div aria-hidden className='absolute bottom-0 left-0 right-0 z-[1] h-[3px] overflow-hidden'>
            <span className='absolute inset-0' style={{ background: isDark ? STRIP_DARK : STRIP_LIGHT }} />
            <span
              className={cn(
                'vault-strip-sweep-el pointer-events-none absolute inset-y-0 w-[30%] opacity-90',
                isDark
                  ? 'bg-gradient-to-r from-transparent via-teal-200/22 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-teal-600/36 to-transparent',
              )}
            />
          </div>
        </div>
      </div>

      <div className={cn('relative z-[4]', contentClassName)}>{children}</div>
    </div>
  )
}
