'use client'

/**
 * Storm "vault credential" tiles — chamfered silhouette, gradient rim, twin-ring sigil, foot strip.
 * Used by CandidateHub (sortable) and StormChainWordmark.
 */
import { cn } from '@/lib/utils'
import { VAULT_CLIP, VAULT_CLIP_HORIZONTAL } from '@/lib/vault-credential-geometry'
import VaultLightFrostTexture from '@/components/ui/VaultLightFrostTexture'

export { VAULT_CLIP } from '@/lib/vault-credential-geometry'

/** Desktop hive order: center, then ring TL, TR, ML, MR, BL, BR */
export const VAULT_SLOT_ORDER_DESKTOP = ['center', 't1', 't2', 't3', 't4', 't5', 't6'] as const
/** Mobile omits middle-left / middle-right */
export const VAULT_SLOT_ORDER_MOBILE = ['center', 't1', 't2', 't5', 't6'] as const

export type VaultSlotId = (typeof VAULT_SLOT_ORDER_DESKTOP)[number]

export function vaultSlotForIndex(index: number, mobile: boolean): VaultSlotId | undefined {
  const order = mobile ? VAULT_SLOT_ORDER_MOBILE : VAULT_SLOT_ORDER_DESKTOP
  return order[index]
}

/** Grid cell placement — must match `VaultShowcaseGrid` template */
export const VAULT_SLOT_GRID_CLASS: Record<VaultSlotId, string> = {
  t1: 'col-start-1 row-start-1 sm:col-start-2 sm:row-start-1 justify-self-end sm:justify-self-center w-full max-w-[9.5rem] sm:max-w-none',
  t2: 'col-start-2 row-start-1 sm:col-start-3 sm:row-start-1 justify-self-start sm:justify-self-center w-full max-w-[9.5rem] sm:max-w-none',
  t3: 'hidden sm:flex sm:col-start-1 sm:row-start-2 sm:justify-self-center',
  t4: 'hidden sm:flex sm:col-start-4 sm:row-start-2 sm:justify-self-center',
  center:
    'col-span-2 row-start-2 sm:col-start-2 sm:col-span-2 sm:row-start-2 justify-self-center w-full flex justify-center',
  t5: 'col-start-1 row-start-3 sm:col-start-2 sm:row-start-3 justify-self-end sm:justify-self-center w-full max-w-[9.5rem] sm:max-w-none',
  t6: 'col-start-2 row-start-3 sm:col-start-3 sm:row-start-3 justify-self-start sm:justify-self-center w-full max-w-[9.5rem] sm:max-w-none',
}

interface VaultCredentialChromeProps {
  children: React.ReactNode
  isDark: boolean
  glowColor: string
  hasRoute: boolean
  className?: string
  /** Hub hive tiles use chamfered `VAULT_CLIP`; wordmark bar uses shallow `VAULT_CLIP_HORIZONTAL`. */
  clipVariant?: 'tile' | 'horizontal'
  /** Hub tiles show twin-ring sigil; horizontal bar is too shallow — default false when `clipVariant="horizontal"`. */
  showSigil?: boolean
  /** Drop shadow / hover glow on the whole tile */
  style?: React.CSSProperties
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void
}

export function VaultCredentialChrome({
  children,
  isDark,
  glowColor,
  hasRoute,
  className,
  clipVariant = 'tile',
  showSigil: showSigilProp,
  style,
  onMouseEnter,
  onMouseLeave,
}: VaultCredentialChromeProps) {
  const clip = clipVariant === 'horizontal' ? VAULT_CLIP_HORIZONTAL : VAULT_CLIP
  const showSigil = showSigilProp ?? clipVariant !== 'horizontal'

  const routeGlow = glowColor

  const rimBg = hasRoute
    ? `linear-gradient(135deg, ${routeGlow} 0%, transparent 52%, ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(30,58,90,0.08)'} 100%)`
    : isDark
      ? 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))'
      : 'linear-gradient(135deg, rgba(100,116,139,0.42), rgba(236,245,248,0.92))'

  const stripBg = hasRoute
    ? `linear-gradient(90deg, transparent 0%, ${routeGlow} 42%, ${routeGlow} 58%, transparent 100%)`
    : isDark
      ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)'
      : 'linear-gradient(90deg, transparent, rgba(156,119,64,0.35), rgba(54,69,89,0.22), transparent)'

  const sigilBorder = hasRoute
    ? routeGlow
    : isDark
      ? 'rgba(255,255,255,0.22)'
      : 'rgba(51,65,85,0.55)'

  /** Brighter accent for sweep / spark (rim color is often low-alpha rgba). */
  const accentVivid = hasRoute
    ? glowColor.replace(/[\d.]+\)$/, '0.45)')
    : isDark
      ? 'rgba(241,90,43,0.35)'
      : 'rgba(156,119,64,0.48)'

  const conicDarkBg = `conic-gradient(from 210deg at 70% 0%, transparent 0deg, ${glowColor} 52deg, rgba(95,122,158,0.22) 108deg, transparent 198deg, ${glowColor} 268deg, transparent 360deg)`

  return (
    <div
      className={cn(
        'group/vault relative h-full w-full min-h-0 select-none',
        className,
      )}
      style={{ clipPath: clip, ...style }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Rim — intensifies on hover */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 z-0 transition-opacity duration-300',
          hasRoute ? 'opacity-90 group-hover/vault:opacity-100' : 'opacity-95 group-hover/vault:opacity-100',
        )}
        style={{ clipPath: clip, background: rimBg }}
      />

      {/* Slow conic wash (teal / block accent / violet) — “living” credential */}
      {hasRoute && (
        <div
          aria-hidden
          className={cn(
            'vault-conic-slow pointer-events-none absolute -inset-[35%] z-0 motion-reduce:opacity-0',
            isDark
              ? 'mix-blend-plus-lighter opacity-[0.2]'
              : 'mix-blend-multiply opacity-[0.18]',
          )}
          style={{
            clipPath: clip,
            background: isDark
              ? conicDarkBg
              : `conic-gradient(from 210deg at 70% 0%, transparent 0deg, ${glowColor} 52deg, rgba(63,82,108,0.14) 108deg, transparent 198deg, ${glowColor} 268deg, transparent 360deg)`,
          }}
        />
      )}

      {/* Chamfer spark — draws the eye to the signature cut */}
      <div
        aria-hidden
        className='pointer-events-none absolute right-0 top-0 z-[2] h-5 w-5 translate-x-px -translate-y-px'
        style={{
          background: `radial-gradient(circle at 80% 15%, ${accentVivid} 0%, transparent 65%)`,
          filter: 'blur(3px)',
        }}
      />

      <div
        aria-hidden
        className={cn(
          'absolute inset-[2px] z-0 overflow-hidden dark:shadow-[inset_0_0_28px_rgba(0,0,0,0.35)]',
          isDark
            ? 'bg-gradient-to-b from-[rgb(22,28,36)]/96 via-[rgb(14,18,24)]/98 to-[rgb(8,11,15)] ring-1 ring-white/[0.05] shadow-[inset_0_0_20px_rgba(0,0,0,0.04)]'
            : 'bg-gradient-to-b from-[#f4fafb]/96 via-cyan-50/[0.28] to-slate-200/88 backdrop-blur-md backdrop-saturate-125 shadow-[inset_0_0_0_1px_rgba(156,119,64,0.1),inset_0_0_42px_rgba(15,23,42,0.065),inset_0_1px_0_rgba(255,255,255,0.88)] ring-1 ring-slate-400/50',
        )}
        style={{ clipPath: clip }}
      >
        {/* Dark: dot grid. Light: sparse grain + glass depth (avoid graph-paper read). */}
        {isDark ? (
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.055)_1px,transparent_1.5px)] [background-size:7px_7px] opacity-[0.35]'
          />
        ) : (
          <VaultLightFrostTexture variant='tile' />
        )}

        {!isDark && (
          <div
            aria-hidden
            className='pointer-events-none absolute -left-1/4 top-0 h-[52%] w-[68%] rotate-[17deg] bg-gradient-to-br from-white/72 via-cyan-100/22 to-transparent opacity-62'
          />
        )}

        <div
          aria-hidden
          className={cn(
            'vault-sheen-layer pointer-events-none absolute inset-y-0 left-0',
            isDark
              ? 'w-[40%] bg-gradient-to-r from-transparent via-white/12 to-transparent'
              : 'w-[54%] bg-gradient-to-r from-transparent via-cyan-100/40 to-transparent opacity-88 mix-blend-multiply',
          )}
        />

        {showSigil && (
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute left-1/2 top-2.5 flex gap-1',
              hasRoute ? 'vault-sigil-breathe-el' : '-translate-x-1/2 opacity-[0.38] dark:opacity-[0.3]',
            )}
          >
            <span
              className='h-2 w-2 rounded-full border-[1.5px] border-solid'
              style={{ borderColor: sigilBorder }}
            />
            <span
              className='h-2 w-2 rounded-full border-[1.5px] border-solid opacity-80'
              style={{ borderColor: sigilBorder }}
            />
          </div>
        )}

        <div aria-hidden className='absolute bottom-0 left-0 right-0 z-[1] h-[3px] overflow-hidden'>
          <div className='absolute inset-0' style={{ background: stripBg }} />
          {hasRoute && (
            <div
              className={cn(
                'vault-strip-sweep-el pointer-events-none absolute inset-y-0 w-2/5 opacity-85',
                isDark
                  ? 'bg-gradient-to-r from-transparent via-teal-200/25 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-teal-600/34 to-transparent',
              )}
            />
          )}
        </div>
      </div>

      <div
        className={cn(
          'relative z-[1] flex w-full min-h-0 flex-col',
          clipVariant === 'horizontal' ? '' : 'h-full',
        )}
      >
        {children}
      </div>
    </div>
  )
}

