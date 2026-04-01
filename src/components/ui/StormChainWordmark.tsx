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
 * Letter **O**: violet frame + **dark foil face** (hub-style conic / grain / sheen / spark / strip).
 * Teal is **only** the cloud stroke with a **tight** outer neon so the interior stays dim.
 * Icon is scaled to sit **near** the inner edge of the frame.
 */
function StormWordmarkOBlock({ isDark, isHero }: { isDark: boolean; isHero: boolean }) {
  const stroke = isHero ? 2.15 : 1.95
  return (
    <span className='relative inline-flex shrink-0 items-center justify-center' aria-hidden>
      <span
        className={cn(
          'pointer-events-none absolute -inset-[3px] z-0 rounded-[3px] sm:-inset-[4px] sm:rounded-[4px]',
          'bg-violet-500/55 dark:bg-violet-400/50',
          'blur-[5px] sm:blur-[7px]',
          isDark ? 'opacity-90' : 'opacity-85',
        )}
      />
      <span
        className={cn(
          'relative z-[1] inline-flex h-[1cap] min-h-[0.82em] w-[1cap] min-w-[0.82em] overflow-hidden',
          'rounded-[2px] sm:rounded-[3px]',
          'border-2 border-violet-500/90 dark:border-violet-400/90',
          isDark
            ? 'shadow-[0_0_10px_rgba(167,139,250,0.55),0_0_18px_rgba(139,92,246,0.38),0_0_24px_rgba(167,139,250,0.18)]'
            : 'shadow-[0_0_8px_rgba(124,58,237,0.45),0_0_16px_rgba(109,40,217,0.3),0_0_22px_rgba(139,92,246,0.16)]',
        )}
      >
        {/* Credential “foil” — same language as HubBlockVault face, scaled to the O */}
        <span className='pointer-events-none absolute inset-[2px] z-0 overflow-hidden rounded-[1px] sm:inset-[2.5px] sm:rounded-[2px]'>
          <span
            className={cn(
              'absolute inset-0',
              isDark
                ? 'bg-gradient-to-b from-[rgb(12,14,18)] via-[rgb(8,10,14)] to-[rgb(4,5,9)] shadow-[inset_0_0_12px_rgba(0,0,0,0.55)]'
                : 'bg-gradient-to-b from-slate-200/96 via-slate-100/92 to-slate-300/90 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.08),inset_0_0_20px_rgba(15,23,42,0.06)]',
            )}
          />
          <span
            className={cn(
              'pointer-events-none absolute -inset-[42%] motion-reduce:opacity-0',
              isDark ? 'mix-blend-plus-lighter opacity-[0.16]' : 'mix-blend-multiply opacity-[0.14]',
            )}
            style={{
              background: isDark
                ? 'conic-gradient(from 205deg at 72% 4%, transparent 0deg, rgba(45,212,191,0.4) 46deg, rgba(167,139,250,0.28) 108deg, transparent 198deg, rgba(45,212,191,0.32) 276deg, transparent 360deg)'
                : 'conic-gradient(from 205deg at 72% 4%, transparent 0deg, rgba(13,148,136,0.22) 46deg, rgba(109,40,217,0.14) 108deg, transparent 198deg, rgba(13,148,136,0.2) 276deg, transparent 360deg)',
            }}
          />
          {isDark ? (
            <span
              aria-hidden
              className='pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.042)_1px,transparent_1.5px)] [background-size:5px_5px] opacity-[0.42]'
            />
          ) : (
            <VaultLightFrostTexture variant='tile' />
          )}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-y-0 left-0 w-[48%]',
              isDark
                ? 'bg-gradient-to-r from-transparent via-white/[0.07] to-transparent'
                : 'bg-gradient-to-r from-transparent via-cyan-100/38 to-transparent opacity-85 mix-blend-multiply',
            )}
          />
          <span
            aria-hidden
            className='pointer-events-none absolute right-0 top-0 z-[1] h-[38%] w-[38%] max-h-[11px] max-w-[11px] translate-x-px -translate-y-px sm:max-h-[13px] sm:max-w-[13px]'
            style={{
              background: isDark
                ? 'radial-gradient(circle at 82% 18%, rgba(45,212,191,0.5) 0%, rgba(167,139,250,0.12) 42%, transparent 68%)'
                : 'radial-gradient(circle at 82% 18%, rgba(13,148,136,0.42) 0%, rgba(109,40,217,0.1) 42%, transparent 68%)',
              filter: 'blur(2px)',
            }}
          />
          <span
            aria-hidden
            className='pointer-events-none absolute bottom-0 left-0 right-0 h-px sm:h-[2px]'
            style={{
              background: isDark
                ? 'linear-gradient(90deg, transparent 0%, rgba(45,212,191,0.4) 38%, rgba(167,139,250,0.35) 62%, transparent 100%)'
                : 'linear-gradient(90deg, transparent 0%, rgba(13,148,136,0.45) 38%, rgba(109,40,217,0.32) 62%, transparent 100%)',
            }}
          />
        </span>

        <span className='relative z-[2] flex h-full w-full items-center justify-center p-px sm:p-[1.5px]'>
          <CloudLightning
            className={cn(
              'min-h-0 min-w-0 shrink-0 origin-center scale-[1.14] sm:scale-[1.12]',
              'h-full w-full',
              isDark
                ? 'text-teal-300 drop-shadow-[0_0_4px_rgba(45,212,191,0.95),0_0_9px_rgba(45,212,191,0.55),0_0_14px_rgba(94,234,212,0.22)]'
                : 'text-teal-600 drop-shadow-[0_0_3px_rgba(13,148,136,0.75),0_0_8px_rgba(20,184,166,0.4)]',
            )}
            strokeWidth={stroke}
          />
        </span>
      </span>
    </span>
  )
}

/**
 * **STORM** with **O** = violet frame + dark foil interior + scaled teal neon cloud. Default: full vault bar.
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
      <StormWordmarkOBlock isDark={isDark} isHero={isHero} />
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
