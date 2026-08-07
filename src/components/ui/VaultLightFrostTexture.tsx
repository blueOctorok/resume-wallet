'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

/**
 * Light-mode only: layered micro-texture — dual-phase grain, brushed striae, prismatic wash,
 * depth + top bloom. Variants: **bar** (nav/wordmark), **tile** (hub), **canvas** (full viewport via `StormBackground`).
 *
 * **icy** — blue-slate grain + teal/violet wash (vault frost).
 * **newsprint** — neutral zinc/grey grain (`data-theme='paper'`).
 */
export type VaultLightFrostVariant = 'bar' | 'tile' | 'canvas'
export type VaultLightFrostTone = 'icy' | 'newsprint'

export default function VaultLightFrostTexture({
  variant = 'bar',
  tone: toneProp,
}: {
  variant?: VaultLightFrostVariant
  /** When omitted, follows global appearance (paper = newsprint; else icy). */
  tone?: VaultLightFrostTone
}) {
  const { theme } = useTheme()
  const tone: VaultLightFrostTone = toneProp ?? (theme === 'paper' ? 'newsprint' : 'icy')
  const isBar = variant === 'bar'
  const isCanvas = variant === 'canvas'
  const isNewsprint = tone === 'newsprint'

  const grainA = isNewsprint
    ? isCanvas
      ? 'opacity-[0.14]'
      : isBar
        ? 'opacity-[0.28]'
        : 'opacity-[0.26]'
    : isCanvas
      ? 'opacity-[0.48]'
      : isBar
        ? 'opacity-[0.62]'
        : 'opacity-[0.58]'
  const grainB = isNewsprint
    ? isCanvas
      ? 'opacity-[0.08]'
      : isBar
        ? 'opacity-[0.18]'
        : 'opacity-[0.16]'
    : isCanvas
      ? 'opacity-[0.3]'
      : isBar
        ? 'opacity-[0.44]'
        : 'opacity-[0.4]'
  const brush = isNewsprint
    ? isCanvas
      ? 'opacity-[0.1]'
      : isBar
        ? 'opacity-[0.22]'
        : 'opacity-[0.2]'
    : isCanvas
      ? 'opacity-[0.34]'
      : isBar
        ? 'opacity-[0.48]'
        : 'opacity-[0.44]'
  const striae = isNewsprint
    ? isCanvas
      ? 'opacity-[0.07]'
      : isBar
        ? 'opacity-[0.2]'
        : 'opacity-[0.2]'
    : isCanvas
      ? 'opacity-[0.32]'
      : 'opacity-[0.46]'

  const washClass = isNewsprint
    ? isCanvas
      ? 'from-zinc-200/[0.22] via-transparent to-zinc-300/[0.08]'
      : 'from-zinc-200/[0.26] via-transparent to-zinc-400/[0.1]'
    : isCanvas
      ? 'from-teal-100/[0.22] via-transparent to-violet-100/[0.12]'
      : 'from-teal-100/[0.28] via-transparent to-violet-100/[0.16]'

  const depthClass = isNewsprint
    ? isCanvas
      ? 'from-white/28'
      : 'from-white/44'
    : isCanvas
      ? 'from-white/38'
      : 'from-white/52'

  const bloom = isNewsprint
    ? isCanvas
      ? 'rgba(250,250,250,0.48)'
      : 'rgba(252,252,252,0.65)'
    : isCanvas
      ? 'rgba(255,255,255,0.58)'
      : 'rgba(255,255,255,0.72)'

  const corner = isNewsprint
    ? isCanvas
      ? 'rgba(63,63,70,0.04)'
      : 'rgba(63,63,70,0.055)'
    : isCanvas
      ? 'rgba(156,119,64,0.065)'
      : 'rgba(156,119,64,0.1)'

  const grainDotA = isNewsprint ? 'rgba(82,82,91,0.035)' : 'rgba(51,85,110,0.055)'
  const grainDotB = isNewsprint ? 'rgba(82,82,91,0.022)' : 'rgba(51,85,110,0.04)'
  const brushLine = isNewsprint ? 'rgba(113,113,122,0.022)' : 'rgba(51,85,110,0.038)'
  const striaeLine = isNewsprint ? 'rgba(82,82,91,0.04)' : 'rgba(71,95,120,0.09)'
  const depthTo = isNewsprint ? 'to-zinc-500/[0.08]' : 'to-slate-400/[0.14]'

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
          backgroundImage: isNewsprint
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
