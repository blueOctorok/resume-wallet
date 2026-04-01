'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

/**
 * Light-mode only: layered micro-texture — dual-phase grain, brushed striae, prismatic wash,
 * depth + top bloom. Variants: **bar** (nav/wordmark), **tile** (hub), **canvas** (full viewport via `StormBackground`).
 *
 * **icy** — blue-slate grain + teal/violet wash (vault frost).
 * **paper** — Kindle-style: warm grain, very soft (esp. canvas); no cool wash.
 */
export type VaultLightFrostVariant = 'bar' | 'tile' | 'canvas'
export type VaultLightFrostTone = 'icy' | 'paper'

export default function VaultLightFrostTexture({
  variant = 'bar',
  tone: toneProp,
}: {
  variant?: VaultLightFrostVariant
  /** When omitted, follows global appearance (paper vs icy light). */
  tone?: VaultLightFrostTone
}) {
  const { theme } = useTheme()
  const tone = toneProp ?? (theme === 'paper' ? 'paper' : 'icy')
  const isBar = variant === 'bar'
  const isCanvas = variant === 'canvas'
  const isPaper = tone === 'paper'

  const grainA = isPaper
    ? isCanvas
      ? 'opacity-[0.2]'
      : isBar
        ? 'opacity-[0.38]'
        : 'opacity-[0.36]'
    : isCanvas
      ? 'opacity-[0.48]'
      : isBar
        ? 'opacity-[0.62]'
        : 'opacity-[0.58]'
  const grainB = isPaper
    ? isCanvas
      ? 'opacity-[0.12]'
      : isBar
        ? 'opacity-[0.26]'
        : 'opacity-[0.24]'
    : isCanvas
      ? 'opacity-[0.3]'
      : isBar
        ? 'opacity-[0.44]'
        : 'opacity-[0.4]'
  const brush = isPaper
    ? isCanvas
      ? 'opacity-[0.14]'
      : isBar
        ? 'opacity-[0.32]'
        : 'opacity-[0.3]'
    : isCanvas
      ? 'opacity-[0.34]'
      : isBar
        ? 'opacity-[0.48]'
        : 'opacity-[0.44]'
  const striae = isPaper
    ? isCanvas
      ? 'opacity-[0.1]'
      : 'opacity-[0.28]'
    : isCanvas
      ? 'opacity-[0.32]'
      : 'opacity-[0.46]'

  const washClass = isPaper
    ? isCanvas
      ? 'from-stone-200/[0.35] via-transparent to-stone-300/[0.12]'
      : 'from-stone-200/[0.4] via-transparent to-stone-400/[0.14]'
    : isCanvas
      ? 'from-teal-100/[0.22] via-transparent to-violet-100/[0.12]'
      : 'from-teal-100/[0.28] via-transparent to-violet-100/[0.16]'

  const depthClass = isPaper
    ? isCanvas
      ? 'from-white/32'
      : 'from-white/48'
    : isCanvas
      ? 'from-white/38'
      : 'from-white/52'

  const bloom = isPaper
    ? isCanvas
      ? 'rgba(255,252,248,0.52)'
      : 'rgba(255,252,248,0.68)'
    : isCanvas
      ? 'rgba(255,255,255,0.58)'
      : 'rgba(255,255,255,0.72)'

  const corner = isPaper
    ? isCanvas
      ? 'rgba(68,64,60,0.05)'
      : 'rgba(68,64,60,0.07)'
    : isCanvas
      ? 'rgba(13,148,136,0.065)'
      : 'rgba(13,148,136,0.1)'

  const grainDotA = isPaper ? 'rgba(120,108,92,0.04)' : 'rgba(51,85,110,0.055)'
  const grainDotB = isPaper ? 'rgba(120,108,92,0.028)' : 'rgba(51,85,110,0.04)'
  const brushLine = isPaper ? 'rgba(130,118,102,0.028)' : 'rgba(51,85,110,0.038)'
  const striaeLine = isPaper ? 'rgba(110,100,88,0.05)' : 'rgba(71,95,120,0.09)'
  const depthTo = isPaper ? 'to-stone-500/[0.12]' : 'to-slate-400/[0.14]'

  return (
    <>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${grainA}`}
        style={{
          backgroundImage: `radial-gradient(${grainDotA} 0.5px, transparent 0.65px)`,
          backgroundSize: '12px 12px',
        }}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${grainB}`}
        style={{
          backgroundImage: `radial-gradient(${grainDotB} 0.5px, transparent 0.65px)`,
          backgroundSize: '12px 12px',
          backgroundPosition: '6px 6px',
        }}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 mix-blend-multiply ${brush}`}
        style={{
          backgroundImage: isPaper
            ? isCanvas
              ? `repeating-linear-gradient(180deg, transparent 0px, transparent 5px, ${brushLine} 5px, ${brushLine} 6px)`
              : `repeating-linear-gradient(180deg, transparent 0px, transparent 3px, ${brushLine} 3px, ${brushLine} 4px)`
            : `repeating-linear-gradient(180deg, transparent 0px, transparent 4px, ${brushLine} 4px, ${brushLine} 5px)`,
        }}
      />
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 mix-blend-multiply', striae)}
        style={{
          backgroundImage: `repeating-linear-gradient(93deg, transparent 0px, transparent 7px, ${striaeLine} 7px, ${striaeLine} 8px)`,
        }}
      />
      <span aria-hidden className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', washClass)} />
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 bg-gradient-to-b via-transparent', depthTo, depthClass)}
      />
      <span
        aria-hidden
        className='pointer-events-none absolute inset-0'
        style={{
          background: `radial-gradient(ellipse 98% 58% at 50% -14%, ${bloom} 0%, transparent 56%)`,
        }}
      />
      <span
        aria-hidden
        className='pointer-events-none absolute inset-0'
        style={{
          background: `radial-gradient(ellipse 70% 45% at 100% 0%, ${corner} 0%, transparent 55%)`,
        }}
      />
    </>
  )
}
