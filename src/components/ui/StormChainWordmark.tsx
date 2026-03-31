'use client'

import { CloudLightning } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { VAULT_CLIP_HORIZONTAL } from '@/lib/vault-credential-geometry'
import VaultLightFrostTexture from '@/components/ui/VaultLightFrostTexture'

export type StormChainWordmarkSize = 'nav' | 'hero'

interface StormChainWordmarkProps {
  size?: StormChainWordmarkSize
  className?: string
  /**
   * Full horizontal vault bar (rim, face, strip). Set false in nav where `NavVaultShell` already
   * provides the credential chrome — logo stays STORM + cloud mark only.
   */
  vaultChrome?: boolean
}

const BAR_RIM_LIGHT =
  'linear-gradient(135deg, rgba(13,148,136,0.42) 0%, rgba(45,212,191,0.16) 20%, transparent 50%, rgba(91,33,182,0.16) 100%)'
const BAR_RIM_DARK =
  'linear-gradient(135deg, rgba(45,212,191,0.34) 0%, transparent 48%, rgba(167,139,246,0.2) 100%)'

const BAR_STRIP_LIGHT =
  'linear-gradient(90deg, transparent, rgba(13,148,136,0.52), rgba(91,33,182,0.28), transparent)'
const BAR_STRIP_DARK =
  'linear-gradient(90deg, transparent, rgba(45,212,191,0.4), rgba(139,92,246,0.28), transparent)'

/**
 * **STORM** with **O** = cloud + lightning. Default: full horizontal vault credential bar.
 * Use `vaultChrome={false}` when the parent already supplies vault chrome (e.g. `NavVaultShell`).
 */
export default function StormChainWordmark({
  size = 'nav',
  className,
  vaultChrome = true,
}: StormChainWordmarkProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const isHero = size === 'hero'

  const typeStyles = cn(
    'font-[family-name:var(--font-storm-wordmark),ui-serif,Georgia,serif] font-medium tracking-[0.045em] sm:tracking-[0.055em]',
    isHero
      ? cn(
          'text-[2.25rem] sm:text-[2.75rem] lg:text-[3.25rem]',
          isDark
            ? 'text-slate-100 [text-shadow:0_2px_0_rgba(0,0,0,0.45),0_0_20px_rgba(0,0,0,0.45)]'
            : 'text-slate-700 [text-shadow:0_1px_0_rgba(255,255,255,0.9),0_-1px_1px_rgba(15,23,42,0.1)]',
        )
      : cn(
          'text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem]',
          isDark
            ? 'text-slate-200/95 [text-shadow:0_1px_0_rgba(255,255,255,0.06),0_-1px_3px_rgba(0,0,0,0.6)]'
            : 'text-slate-700 [text-shadow:0_1px_0_rgba(255,255,255,0.85),0_-1px_1px_rgba(15,23,42,0.12)]',
        ),
  )

  const innerBg = isDark
    ? 'linear-gradient(175deg, rgba(24,30,40,0.97) 0%, rgba(10,13,18,0.99) 100%)'
    : 'linear-gradient(175deg, rgba(252,254,255,0.96) 0%, rgba(236,248,250,0.9) 40%, rgba(228,238,245,0.92) 72%, rgba(220,232,242,0.94) 100%)'

  const clip = { clipPath: VAULT_CLIP_HORIZONTAL }

  const stormMarkRow = (
    <div
      className={cn(
        'flex items-center justify-center gap-[0.05em] sm:gap-[0.06em]',
        vaultChrome
          ? 'px-[0.38em] pb-[0.1em] pt-[0.14em] sm:px-[0.46em] sm:pb-[0.12em] sm:pt-[0.16em]'
          : 'px-[0.12em] py-[0.06em] sm:px-[0.18em] sm:py-[0.08em]',
      )}
    >
      <span className='select-none uppercase'>ST</span>
      <CloudLightning
        className={cn(
          'shrink-0 text-teal-600 dark:text-teal-300',
          'h-[1cap] w-[1cap]',
          'drop-shadow-[0_0_12px_rgba(45,212,191,0.22)] dark:drop-shadow-[0_0_14px_rgba(45,212,191,0.18)]',
        )}
        strokeWidth={isHero ? 2.35 : 2.1}
        aria-hidden
      />
      <span className='select-none uppercase'>RM</span>
    </div>
  )

  if (!vaultChrome) {
    return (
      <div className={cn('inline-flex leading-none', typeStyles, className)}>
        <span className='sr-only'>Storm</span>
        {stormMarkRow}
      </div>
    )
  }

  return (
    <div className={cn('inline-flex leading-none', typeStyles, className)}>
      <span className='sr-only'>Storm</span>
      <div className='relative inline-block' style={clip}>
        {/* Background stack — all absolute; size comes from in-flow column below */}
        <span
          aria-hidden
          className='absolute inset-0 z-0'
          style={{ ...clip, background: isDark ? BAR_RIM_DARK : BAR_RIM_LIGHT }}
        />

        {isHero && (
          <span
            aria-hidden
            className={cn(
              'vault-conic-slow pointer-events-none absolute -inset-[22%] z-0 motion-reduce:opacity-0',
              isDark ? 'mix-blend-plus-lighter opacity-[0.18]' : 'mix-blend-multiply opacity-[0.17]',
            )}
            style={{
              ...clip,
              background: isDark
                ? 'conic-gradient(from 200deg at 85% 0%, transparent 0deg, rgba(45,212,191,0.3) 40deg, rgba(139,92,246,0.18) 100deg, transparent 220deg, rgba(45,212,191,0.22) 300deg, transparent 360deg)'
                : 'conic-gradient(from 200deg at 85% 0%, transparent 0deg, rgba(13,148,136,0.38) 40deg, rgba(91,33,182,0.18) 100deg, transparent 220deg, rgba(15,118,110,0.28) 300deg, transparent 360deg)',
            }}
          />
        )}

        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-[2px] z-[1] overflow-hidden dark:shadow-[inset_0_0_22px_rgba(0,0,0,0.4)]',
            isDark
              ? 'shadow-[inset_0_0_18px_rgba(0,0,0,0.05)]'
              : 'backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.11),inset_0_0_40px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.88)] ring-1 ring-slate-400/55',
          )}
          style={{ ...clip, background: innerBg }}
        >
          {isDark ? (
            <span className='pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.055)_1px,transparent_1.5px)] [background-size:6px_6px] opacity-[0.26]' />
          ) : (
            <VaultLightFrostTexture variant='bar' />
          )}
          {!isDark && (
            <span className='pointer-events-none absolute -left-[10%] top-0 h-[52%] w-[45%] rotate-[14deg] bg-gradient-to-br from-white/75 via-cyan-50/25 to-transparent opacity-60' />
          )}
          {isHero && (
            <span
              className={cn(
                'vault-sheen-layer pointer-events-none absolute inset-y-0 left-0',
                isDark
                  ? 'w-[36%] bg-gradient-to-r from-transparent via-white/08 to-transparent'
                  : 'w-[54%] bg-gradient-to-r from-transparent via-cyan-50/45 to-transparent opacity-90 mix-blend-multiply',
              )}
            />
          )}
        </div>

        <span
          aria-hidden
          className='pointer-events-none absolute right-0 top-0 z-[4] h-6 w-10 max-w-[18%] translate-x-px -translate-y-px sm:h-7 sm:w-12'
          style={{
            background: isDark
              ? 'radial-gradient(ellipse 80% 80% at 90% 10%, rgba(45,212,191,0.5) 0%, transparent 72%)'
              : 'radial-gradient(ellipse 80% 80% at 90% 10%, rgba(13,148,136,0.48) 0%, rgba(45,212,191,0.2) 48%, transparent 72%)',
            filter: 'blur(3px)',
          }}
        />

        {/* In-flow: defines bar width/height (px-[2px] aligns type with inset-[2px] face) */}
        <div className='relative z-[3] flex flex-col px-[2px]'>
          {stormMarkRow}
          <div className='relative h-[3px] min-h-[2px] w-full shrink-0 overflow-hidden'>
            <span
              aria-hidden
              className='absolute inset-0'
              style={{ background: isDark ? BAR_STRIP_DARK : BAR_STRIP_LIGHT }}
            />
            {isHero && (
              <span
                className={cn(
                  'vault-strip-sweep-el pointer-events-none absolute inset-y-0 w-1/3 opacity-90',
                  isDark
                    ? 'bg-gradient-to-r from-transparent via-teal-200/22 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-teal-600/36 to-transparent',
                )}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
