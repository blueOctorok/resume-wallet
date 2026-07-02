'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { getBlockColor } from '@/lib/block-registry'
import { VaultCredentialChrome } from '@/components/hub/HubBlockVault'
import VaultLightFrostTexture from '@/components/ui/VaultLightFrostTexture'

export type StormChainWordmarkSize = 'nav' | 'hero' | 'display'

interface StormChainWordmarkProps {
  size?: StormChainWordmarkSize
  className?: string
  /**
   * Full horizontal vault bar (rim, face, strip). Set false in nav where `NavVaultShell` already
   * provides the credential chrome — logo stays STORM + cloud mark only.
   */
  vaultChrome?: boolean
}

/** Same drop-shadow stack as hub `BlockTile` (installed blocks). */
const STORM_WORDMARK_TILE_SHADOW_LIGHT =
  'drop-shadow(0 6px 18px rgba(15,23,42,0.12)) drop-shadow(0 0 28px rgba(13,148,136,0.2)) drop-shadow(0 0 48px rgba(91,33,182,0.1))'
const STORM_WORDMARK_TILE_SHADOW_DARK = 'drop-shadow(0 4px 18px rgba(0,0,0,0.45))'

type DropletSpec = {
  left: string
  top: string
  w: string
  h: string
  rotate: string
  opacityClass: string
}

/** Dew-on-glass — stronger specular + teal fill + meniscus so beads read clearly on the vault. */
function WordmarkDroplet({
  isDark,
  spec,
}: {
  isDark: boolean
  spec: DropletSpec
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute rounded-full',
        spec.opacityClass,
        isDark
          ? 'mix-blend-plus-lighter [box-shadow:inset_0_-2px_3px_rgba(0,0,0,0.55),inset_0_2px_2px_rgba(45,212,191,0.35)]'
          : 'mix-blend-multiply [box-shadow:inset_0_-2px_4px_rgba(15,23,42,0.14),inset_0_2px_3px_rgba(255,255,255,0.92)]',
      )}
      style={{
        left: spec.left,
        top: spec.top,
        width: spec.w,
        height: spec.h,
        transform: `rotate(${spec.rotate})`,
        background: isDark
          ? 'radial-gradient(ellipse 72% 78% at 30% 26%, rgba(240,255,255,0.92) 0%, rgba(94,234,212,0.45) 18%, rgba(45,212,191,0.22) 45%, rgba(13,148,136,0.12) 62%, rgba(0,0,0,0.5) 90%, transparent 100%)'
          : 'radial-gradient(ellipse 76% 82% at 27% 23%, rgba(255,255,255,1) 0%, rgba(224,242,254,0.85) 10%, rgba(45,212,191,0.38) 38%, rgba(13,148,136,0.26) 58%, rgba(15,23,42,0.14) 88%, transparent 100%)',
      }}
    />
  )
}

const DROPLETS_BAR: DropletSpec[] = [
  { left: '5%', top: '18%', w: '3.8%', h: '5.6%', rotate: '-8deg', opacityClass: 'opacity-[0.78] dark:opacity-[0.68]' },
  { left: '11%', top: '52%', w: '3.1%', h: '4.2%', rotate: '14deg', opacityClass: 'opacity-[0.72] dark:opacity-[0.62]' },
  { left: '18%', top: '72%', w: '2.6%', h: '3.8%', rotate: '-5deg', opacityClass: 'opacity-[0.68] dark:opacity-[0.58]' },
  { left: '26%', top: '32%', w: '3.4%', h: '4.8%', rotate: '-4deg', opacityClass: 'opacity-[0.75] dark:opacity-[0.65]' },
  { left: '36%', top: '20%', w: '2.6%', h: '3.8%', rotate: '11deg', opacityClass: 'opacity-[0.7] dark:opacity-[0.6]' },
  { left: '42%', top: '58%', w: '4%', h: '5.2%', rotate: '-12deg', opacityClass: 'opacity-[0.82] dark:opacity-[0.7]' },
  { left: '50%', top: '38%', w: '2.9%', h: '4.1%', rotate: '7deg', opacityClass: 'opacity-[0.73] dark:opacity-[0.63]' },
  { left: '58%', top: '68%', w: '2.7%', h: '3.9%', rotate: '-9deg', opacityClass: 'opacity-[0.7] dark:opacity-[0.6]' },
  { left: '66%', top: '44%', w: '2.8%', h: '4%', rotate: '-14deg', opacityClass: 'opacity-[0.72] dark:opacity-[0.62]' },
  { left: '74%', top: '22%', w: '3.6%', h: '5.1%', rotate: '9deg', opacityClass: 'opacity-[0.8] dark:opacity-[0.68]' },
  { left: '80%', top: '54%', w: '3%', h: '4.2%', rotate: '-6deg', opacityClass: 'opacity-[0.74] dark:opacity-[0.64]' },
  { left: '88%', top: '36%', w: '2.4%', h: '3.5%', rotate: '16deg', opacityClass: 'opacity-[0.68] dark:opacity-[0.58]' },
  { left: '93%', top: '62%', w: '2.8%', h: '3.9%', rotate: '4deg', opacityClass: 'opacity-[0.7] dark:opacity-[0.6]' },
  { left: '30%', top: '78%', w: '2.5%', h: '3.6%', rotate: '-2deg', opacityClass: 'opacity-[0.66] dark:opacity-[0.56]' },
]

const DROPLETS_O_TILE: DropletSpec[] = [
  { left: '10%', top: '14%', w: '26%', h: '32%', rotate: '-10deg', opacityClass: 'opacity-[0.72] dark:opacity-[0.62]' },
  { left: '54%', top: '18%', w: '30%', h: '36%', rotate: '12deg', opacityClass: 'opacity-[0.76] dark:opacity-[0.66]' },
  { left: '22%', top: '54%', w: '28%', h: '34%', rotate: '5deg', opacityClass: 'opacity-[0.7] dark:opacity-[0.6]' },
  { left: '62%', top: '58%', w: '24%', h: '30%', rotate: '-14deg', opacityClass: 'opacity-[0.66] dark:opacity-[0.57]' },
  { left: '40%', top: '36%', w: '20%', h: '26%', rotate: '-6deg', opacityClass: 'opacity-[0.62] dark:opacity-[0.54]' },
]

function WordmarkDropletField({
  isDark,
  variant,
}: {
  isDark: boolean
  variant: 'bar' | 'o-tile'
}) {
  const specs = variant === 'bar' ? DROPLETS_BAR : DROPLETS_O_TILE
  return (
    <span
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden motion-reduce:opacity-0',
        variant === 'bar' ? 'z-[2]' : 'z-[1]',
      )}
      aria-hidden
    >
      {specs.map((spec, i) => (
        <WordmarkDroplet key={i} isDark={isDark} spec={spec} />
      ))}
    </span>
  )
}

/** Light: etched metallic letters without blowing past the O (no outer blur). */
function WordmarkLetterGroup({
  isDark,
  isHero,
  children,
}: {
  isDark: boolean
  isHero: boolean
  children: ReactNode
}) {
  if (isDark) {
    return <span className='select-none uppercase'>{children}</span>
  }
  return (
    <span
      className={cn(
        'select-none uppercase bg-gradient-to-b from-slate-950 via-slate-800 to-slate-900 bg-clip-text text-transparent',
        isHero && 'from-slate-950 via-slate-800 to-slate-950',
      )}
      style={{
        filter: isHero
          ? 'drop-shadow(0 1px 0 rgb(255 255 255 / 0.5)) drop-shadow(0 -0.5px 0 rgb(15 23 42 / 0.06)) drop-shadow(0 1px 2px rgb(13 148 136 / 0.06))'
          : 'drop-shadow(0 1px 0 rgb(255 255 255 / 0.45)) drop-shadow(0 -0.5px 0 rgb(15 23 42 / 0.05)) drop-shadow(0 0 1px rgb(13 148 136 / 0.05))',
      }}
    >
      {children}
    </span>
  )
}

/**
 * Letter **O**: violet frame + foil interior (hub language). Icon lives **inside** the foil clip so
 * light-mode teal “neon” cannot bleed past the credential. Dark keeps an outer violet bloom.
 */
function StormWordmarkOBlock({
  isDark,
  isHero,
  isDisplay = false,
}: {
  isDark: boolean
  isHero: boolean
  isDisplay?: boolean
}) {
  const stroke = isDisplay ? 2.35 : isHero ? 2.15 : 1.95

  const iconFilterLight =
    'drop-shadow(0 1px 0 rgb(255 255 255 / 0.65)) drop-shadow(0 -0.5px 0 rgb(15 23 42 / 0.08)) drop-shadow(0 0 2px rgb(13 148 136 / 0.55)) drop-shadow(0 0 5px rgb(13 148 136 / 0.42)) drop-shadow(0 0 9px rgb(45 212 191 / 0.28))'

  return (
    <span className='relative inline-flex shrink-0 items-center justify-center' aria-hidden>
      {isDark && (
        <span
          className={cn(
            'pointer-events-none absolute -inset-[3px] z-0 rounded-[3px] sm:-inset-[4px] sm:rounded-[4px]',
            'bg-violet-400/50',
            'blur-[5px] sm:blur-[7px] opacity-90',
          )}
        />
      )}
      <span
        className={cn(
          'relative z-[1] inline-flex h-[1cap] min-h-[0.82em] w-[1cap] min-w-[0.82em] overflow-hidden',
          'rounded-[2px] sm:rounded-[3px]',
          isDark
            ? 'border-2 border-violet-400/90 shadow-[0_0_10px_rgba(167,139,250,0.55),0_0_18px_rgba(139,92,246,0.38),0_0_24px_rgba(167,139,250,0.18)]'
            : cn(
                'border-2 border-violet-600/70 ring-1 ring-inset ring-violet-400/35 ring-offset-0',
                'shadow-[inset_0_1px_0_rgb(255_255_255_/_0.9),inset_0_-1px_0_rgb(15_23_42_/_0.06),inset_0_0_16px_rgb(109_40_217_/_0.12),inset_0_0_0_1px_rgb(109_40_217_/_0.26),0_2px_4px_rgb(15_23_42_/_0.07)]',
              ),
        )}
      >
        {/* Foil face + icon (icon clipped — kills light-mode glow bleed) */}
        <span
          className={cn(
            'absolute inset-[2px] z-0 overflow-hidden rounded-[1px] sm:inset-[2.5px] sm:rounded-[2px]',
            !isDark &&
              'shadow-[inset_0_0_14px_rgb(13_148_136_/_0.07),inset_0_0_0_1px_rgb(148_163_184_/_0.4),inset_0_0_20px_rgb(109_40_217_/_0.06)]',
          )}
        >
          <span
            className={cn(
              'absolute inset-0',
              isDark
                ? 'bg-gradient-to-b from-[rgb(12,14,18)] via-[rgb(8,10,14)] to-[rgb(4,5,9)] shadow-[inset_0_0_12px_rgba(0,0,0,0.55)]'
                : cn(
                    'bg-gradient-to-b from-[#eef9f8] via-[#e2f4f2] to-[#d4e8e8]',
                    'shadow-[inset_0_1px_0_rgb(255_255_255_/_0.95),inset_0_0_18px_rgb(13_148_136_/_0.08)]',
                  ),
            )}
          />
          <span
            className={cn(
              'pointer-events-none absolute -inset-[42%] motion-reduce:opacity-0',
              isDark ? 'mix-blend-plus-lighter opacity-[0.16]' : 'mix-blend-multiply opacity-[0.17]',
            )}
            style={{
              background: isDark
                ? 'conic-gradient(from 205deg at 72% 4%, transparent 0deg, rgba(45,212,191,0.4) 46deg, rgba(167,139,250,0.28) 108deg, transparent 198deg, rgba(45,212,191,0.32) 276deg, transparent 360deg)'
                : 'conic-gradient(from 205deg at 72% 4%, transparent 0deg, rgba(13,148,136,0.26) 46deg, rgba(109,40,217,0.16) 108deg, transparent 198deg, rgba(13,148,136,0.22) 276deg, transparent 360deg)',
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
          {!isDark && (
            <span
              aria-hidden
              className='pointer-events-none absolute inset-0 opacity-[0.45] mix-blend-multiply bg-[radial-gradient(rgb(51_85_110_/_0.08)_0.5px,transparent_0.65px)] [background-size:4px_4px] [background-position:2px_1px]'
            />
          )}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-y-0 left-0 w-[48%]',
              isDark
                ? 'bg-gradient-to-r from-transparent via-white/[0.07] to-transparent'
                : 'bg-gradient-to-r from-transparent via-cyan-200/48 to-transparent opacity-95 mix-blend-multiply',
            )}
          />
          <span
            aria-hidden
            className='pointer-events-none absolute right-0 top-0 z-[1] h-[38%] w-[38%] max-h-[11px] max-w-[11px] translate-x-px -translate-y-px sm:max-h-[13px] sm:max-w-[13px]'
            style={{
              background: isDark
                ? 'radial-gradient(circle at 82% 18%, rgba(45,212,191,0.5) 0%, rgba(167,139,250,0.12) 42%, transparent 68%)'
                : 'radial-gradient(circle at 82% 18%, rgba(13,148,136,0.38) 0%, rgba(45,212,191,0.18) 38%, rgba(109,40,217,0.12) 52%, transparent 72%)',
              filter: isDark ? 'blur(2px)' : 'blur(1.25px)',
            }}
          />
          <span
            aria-hidden
            className='pointer-events-none absolute bottom-0 left-0 right-0 h-px sm:h-[2px]'
            style={{
              background: isDark
                ? 'linear-gradient(90deg, transparent 0%, rgba(45,212,191,0.4) 38%, rgba(167,139,250,0.35) 62%, transparent 100%)'
                : 'linear-gradient(90deg, transparent 0%, rgba(13,148,136,0.48) 38%, rgba(109,40,217,0.36) 62%, transparent 100%)',
            }}
          />

          <WordmarkDropletField isDark={isDark} variant='o-tile' />

          <span className='relative z-[2] flex h-full w-full items-center justify-center p-px sm:p-[1.5px]'>
            <ShieldCheck
              className={cn(
                'min-h-0 min-w-0 shrink-0 origin-center scale-[1.14] sm:scale-[1.12]',
                'h-full w-full',
                isDark
                  ? 'text-teal-300 drop-shadow-[0_0_4px_rgba(45,212,191,0.95),0_0_9px_rgba(45,212,191,0.55),0_0_14px_rgba(94,234,212,0.22)]'
                  : 'text-teal-700',
              )}
              strokeWidth={stroke}
              style={!isDark ? { filter: iconFilterLight } : undefined}
            />
          </span>
        </span>
      </span>
    </span>
  )
}

/**
 * **ZKNIGHT** with a leading violet foil tile + shield-check mark. Full chrome uses **`VaultCredentialChrome`**
 * from the hub (`clipVariant="horizontal"`) — same rim, conic, chamfer spark, frosted face, sheen, foot strip +
 * sweep, and hover drop-shadow as **My blocks** tiles. `vaultChrome={false}` = tile + type only (e.g. inside `NavVaultShell`).
 */
export default function StormChainWordmark({
  size = 'nav',
  className,
  vaultChrome = true,
}: StormChainWordmarkProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  /** Larger than nav: whitepaper hero + marketing homepage */
  const isLarge = size === 'hero' || size === 'display'
  const isDisplay = size === 'display'

  const tileColors = getBlockColor('storm')

  const [tileFilter, setTileFilter] = useState<string | undefined>(() =>
    isDark ? STORM_WORDMARK_TILE_SHADOW_DARK : STORM_WORDMARK_TILE_SHADOW_LIGHT,
  )

  useEffect(() => {
    setTileFilter(isDark ? STORM_WORDMARK_TILE_SHADOW_DARK : STORM_WORDMARK_TILE_SHADOW_LIGHT)
  }, [isDark])

  const typeStyles = cn(
    /* Orbitron 600 via `.storm-wordmark-font`; font-semibold matches next/font weight */
    'storm-wordmark-font font-semibold tracking-[0.04em] sm:tracking-[0.05em]',
    isDisplay
      ? cn(
          /* Homepage — larger than whitepaper `hero` */
          'text-[3rem] sm:text-[3.75rem] md:text-[4.5rem] lg:text-[5.25rem]',
          isDark
            ? 'text-slate-100 [text-shadow:0_2px_0_rgba(0,0,0,0.45),0_0_20px_rgba(0,0,0,0.45)]'
            : 'text-slate-800',
        )
      : isLarge
        ? cn(
            'text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem]',
            isDark
              ? 'text-slate-100 [text-shadow:0_2px_0_rgba(0,0,0,0.45),0_0_20px_rgba(0,0,0,0.45)]'
              : 'text-slate-800',
          )
        : cn(
            'text-[1.75rem] sm:text-[2rem] lg:text-[2.25rem]',
            isDark
              ? 'text-slate-200/95 [text-shadow:0_1px_0_rgba(255,255,255,0.06),0_-1px_3px_rgba(0,0,0,0.6)]'
              : 'text-slate-800',
          ),
  )

  const stormMarkRow = (
    <div
      className={cn(
        'flex items-center justify-center gap-[0.05em] sm:gap-[0.06em]',
        vaultChrome
          ? ''
          : 'px-[0.12em] py-2 sm:px-[0.18em] sm:py-2.5',
        !isDark && 'isolate',
      )}
    >
      <StormWordmarkOBlock isDark={isDark} isHero={isLarge} isDisplay={isDisplay} />
      <WordmarkLetterGroup isDark={isDark} isHero={isLarge}>
        ZKNIGHT
      </WordmarkLetterGroup>
    </div>
  )

  if (!vaultChrome) {
    return (
      <div className={cn('inline-flex leading-none', typeStyles, className)}>
        <span className='sr-only'>ZKnight</span>
        {stormMarkRow}
      </div>
    )
  }

  return (
    <div className={cn('inline-flex leading-none', typeStyles, className)}>
      <span className='sr-only'>ZKnight</span>
      <VaultCredentialChrome
        isDark={isDark}
        glowColor={tileColors.glowColor}
        hasRoute
        clipVariant='horizontal'
        className='inline-block min-h-0 w-auto align-middle'
        style={{ filter: tileFilter }}
        onMouseEnter={() =>
          setTileFilter(
            isDark
              ? `drop-shadow(0 10px 28px ${tileColors.glowColor})`
              : `${STORM_WORDMARK_TILE_SHADOW_LIGHT}, drop-shadow(0 8px 24px ${tileColors.glowColor})`,
          )
        }
        onMouseLeave={() =>
          setTileFilter(isDark ? STORM_WORDMARK_TILE_SHADOW_DARK : STORM_WORDMARK_TILE_SHADOW_LIGHT)
        }
      >
        <div className='relative w-full min-w-0'>
          <WordmarkDropletField isDark={isDark} variant='bar' />
          <div
            className={cn(
              'relative z-[2] flex flex-col items-stretch leading-none',
              /* Room above/below type inside the vault face (foot strip still reads clearly below) */
              'px-[0.36em] pt-2 pb-2.5 sm:px-[0.44em] sm:pt-2.5 sm:pb-3',
              isLarge && 'sm:pt-3 sm:pb-3.5 lg:pt-3.5 lg:pb-4',
              isDisplay && 'md:pt-4 md:pb-4 lg:pt-[1.15rem] lg:pb-[1.35rem]',
            )}
          >
            {stormMarkRow}
          </div>
        </div>
      </VaultCredentialChrome>
    </div>
  )
}
