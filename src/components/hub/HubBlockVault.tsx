'use client'

/**
 * Storm "vault credential" tiles — chamfered silhouette, gradient rim, twin-ring sigil, foot strip.
 * Used by CandidateHub (sortable) and HomePage (marketing).
 */
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { getBlockColor } from '@/lib/block-registry'
import { VAULT_CLIP } from '@/lib/vault-credential-geometry'
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
  /** Hub tiles show twin-ring sigil; dense panels (e.g. career path) omit it */
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
  showSigil = true,
  style,
  onMouseEnter,
  onMouseLeave,
}: VaultCredentialChromeProps) {
  const rimBg = hasRoute
    ? `linear-gradient(135deg, ${glowColor} 0%, transparent 52%, ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'} 100%)`
    : isDark
      ? 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))'
      : 'linear-gradient(135deg, rgba(148,163,184,0.45), rgba(248,250,252,0.95))'

  const stripBg = hasRoute
    ? `linear-gradient(90deg, transparent 0%, ${glowColor} 42%, ${glowColor} 58%, transparent 100%)`
    : isDark
      ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)'
      : 'linear-gradient(90deg, transparent, rgba(148,163,184,0.4), transparent)'

  const sigilBorder = hasRoute ? glowColor : isDark ? 'rgba(255,255,255,0.22)' : 'rgba(100,116,139,0.45)'

  /** Brighter accent for sweep / spark (rim color is often low-alpha rgba). */
  const accentVivid = hasRoute
    ? glowColor.replace(/[\d.]+\)$/, '0.45)')
    : isDark
      ? 'rgba(45,212,191,0.35)'
      : 'rgba(13,148,136,0.4)'

  return (
    <div
      className={cn(
        'group/vault relative h-full w-full min-h-0 select-none',
        className,
      )}
      style={{ clipPath: VAULT_CLIP, ...style }}
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
        style={{ clipPath: VAULT_CLIP, background: rimBg }}
      />

      {/* Slow conic wash (teal / block accent / violet) — “living” credential */}
      {hasRoute && (
        <div
          aria-hidden
          className={cn(
            'vault-conic-slow pointer-events-none absolute -inset-[35%] z-0 motion-reduce:opacity-0',
            isDark ? 'mix-blend-plus-lighter opacity-[0.2]' : 'mix-blend-multiply opacity-[0.13]',
          )}
          style={{
            clipPath: VAULT_CLIP,
            background: isDark
              ? `conic-gradient(from 210deg at 70% 0%, transparent 0deg, ${glowColor} 52deg, rgba(139,92,246,0.22) 108deg, transparent 198deg, ${glowColor} 268deg, transparent 360deg)`
              : `conic-gradient(from 210deg at 70% 0%, transparent 0deg, ${glowColor} 52deg, rgba(109,40,217,0.14) 108deg, transparent 198deg, ${glowColor} 268deg, transparent 360deg)`,
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
            : 'bg-gradient-to-b from-white/91 via-slate-50/[0.88] to-slate-100/86 backdrop-blur-md backdrop-saturate-125 shadow-[inset_0_0_36px_rgba(15,23,42,0.052),inset_0_1px_0_rgba(255,255,255,0.98)] ring-1 ring-slate-200/95',
        )}
        style={{ clipPath: VAULT_CLIP }}
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
            className='pointer-events-none absolute -left-1/4 top-0 h-[52%] w-[68%] rotate-[17deg] bg-gradient-to-br from-white/88 via-teal-50/10 to-transparent opacity-58'
          />
        )}

        <div
          aria-hidden
          className={cn(
            'vault-sheen-layer pointer-events-none absolute inset-y-0 left-0',
            isDark
              ? 'w-[40%] bg-gradient-to-r from-transparent via-white/12 to-transparent'
              : 'w-[54%] bg-gradient-to-r from-transparent via-white/32 to-transparent opacity-84 mix-blend-overlay',
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
                  : 'bg-gradient-to-r from-transparent via-teal-700/26 to-transparent',
              )}
            />
          )}
        </div>
      </div>

      <div className='relative z-[1] flex h-full w-full min-h-0 flex-col'>{children}</div>
    </div>
  )
}

// ── Marketing tiles (HomePage) ────────────────────────────────────────────────

interface VaultMarketingTileProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  isDark: boolean
  floatDelaySec?: number
  isCenter?: boolean
  colors: {
    iconText: { dark: string; light: string }
    glowColor: string
  }
}

export function VaultMarketingTile({
  icon: Icon,
  label,
  isDark,
  floatDelaySec = 0,
  isCenter,
  colors,
}: VaultMarketingTileProps) {
  const defaultLight =
    'drop-shadow(0 4px 14px rgba(15,23,42,0.1)) drop-shadow(0 0 20px rgba(13,148,136,0.12)) drop-shadow(0 0 36px rgba(124,58,237,0.08))'
  const defaultDark = 'drop-shadow(0 4px 18px rgba(0,0,0,0.45))'
  const [filter, setFilter] = useState(() => (isDark ? defaultDark : defaultLight))

  useEffect(() => {
    setFilter(isDark ? defaultDark : defaultLight)
  }, [isDark])

  return (
    <div
      className={cn(
        'vault-marketing-float w-full',
        isCenter ? 'max-w-[13.5rem] sm:max-w-[15.5rem]' : 'max-w-[9.5rem] sm:max-w-[11rem]',
      )}
      style={{
        animation: `vault-float 5s ease-in-out ${floatDelaySec}s infinite alternate`,
      }}
    >
      <VaultCredentialChrome
        isDark={isDark}
        glowColor={colors.glowColor}
        hasRoute
        className={cn(isCenter ? 'min-h-[7.5rem] sm:min-h-[9.5rem]' : 'min-h-[5.75rem] sm:min-h-[6.75rem]')}
        style={{ filter }}
        onMouseEnter={() =>
          setFilter(
            isDark
              ? `drop-shadow(0 10px 28px ${colors.glowColor})`
              : `${defaultLight}, drop-shadow(0 8px 24px ${colors.glowColor})`,
          )
        }
        onMouseLeave={() => setFilter(isDark ? defaultDark : defaultLight)}
      >
        <div className='flex flex-1 flex-col items-center justify-center px-[10%] pt-5 pb-3 text-center'>
          <Icon
            className={cn(
              'flex-shrink-0 drop-shadow-sm',
              isCenter ? 'mb-1.5 w-7 h-7 sm:w-9 sm:h-9' : 'mb-1 w-5 h-5 sm:w-7 sm:h-7',
              isDark ? colors.iconText.dark : colors.iconText.light,
            )}
          />
          <span
            className={cn(
              'font-semibold tracking-tight',
              isCenter ? 'text-[10px] sm:text-xs' : 'text-[8px] sm:text-[10px]',
              isDark ? colors.iconText.dark : colors.iconText.light,
            )}
          >
            {label}
          </span>
        </div>
      </VaultCredentialChrome>
    </div>
  )
}

// ── Marketing showcase (HomePage) — same grid + tiles as hub ───────────────────

export type VaultShowcaseBlock = {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

export function VaultShowcase({ blocks, isDark }: { blocks: VaultShowcaseBlock[]; isDark: boolean }) {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const rows = narrow
    ? blocks.slice(0, 5).map((block, i) => ({
        block,
        slot: VAULT_SLOT_ORDER_MOBILE[i]!,
      }))
    : blocks.slice(0, 7).map((block, i) => ({
        block,
        slot: VAULT_SLOT_ORDER_DESKTOP[i]!,
      }))

  return (
    <div className='mx-auto grid w-full max-w-md grid-cols-2 grid-rows-[auto_auto_auto] gap-3 sm:max-w-xl sm:grid-cols-4 sm:grid-rows-3 sm:gap-4'>
      {rows.map(({ block, slot }, i) => {
        const colors = getBlockColor(block.id)
        const isCenter = slot === 'center'
        return (
          <div
            key={`${block.id}-${slot}`}
            className={cn(
              VAULT_SLOT_GRID_CLASS[slot],
              isCenter ? 'min-h-[7.25rem] sm:min-h-[9rem]' : 'min-h-[5.5rem] sm:min-h-[6.5rem]',
            )}
          >
            <VaultMarketingTile
              icon={block.icon}
              label={block.label}
              isDark={isDark}
              isCenter={isCenter}
              colors={{
                iconText: colors.iconText,
                glowColor: colors.glowColor,
              }}
              floatDelaySec={i * 0.35}
            />
          </div>
        )
      })}
    </div>
  )
}
