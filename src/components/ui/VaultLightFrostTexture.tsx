'use client'

import { cn } from '@/lib/utils'

/**
 * Light-mode only: layered micro-texture — dual-phase grain, brushed striae, prismatic wash,
 * depth + top bloom. Variants: **bar** (nav/wordmark), **tile** (hub), **canvas** (full viewport via `StormBackground`).
 */
export type VaultLightFrostVariant = 'bar' | 'tile' | 'canvas'

const GRAIN_DOT_A = 'rgba(51,85,110,0.055)'
const GRAIN_DOT_B = 'rgba(51,85,110,0.04)'
const BRUSH_LINE = 'rgba(51,85,110,0.038)'
const STRIAE_LINE = 'rgba(71,95,120,0.09)'

export default function VaultLightFrostTexture({
  variant = 'bar',
}: {
  variant?: VaultLightFrostVariant
}) {
  const isBar = variant === 'bar'
  const isCanvas = variant === 'canvas'

  const grainA = isCanvas ? 'opacity-[0.48]' : isBar ? 'opacity-[0.62]' : 'opacity-[0.58]'
  const grainB = isCanvas ? 'opacity-[0.3]' : isBar ? 'opacity-[0.44]' : 'opacity-[0.4]'
  const brush = isCanvas ? 'opacity-[0.34]' : isBar ? 'opacity-[0.48]' : 'opacity-[0.44]'
  const striae = isCanvas ? 'opacity-[0.32]' : 'opacity-[0.46]'

  const washClass = isCanvas
    ? 'from-slate-200/[0.18] via-transparent to-violet-100/[0.1]'
    : 'from-teal-100/[0.28] via-transparent to-violet-100/[0.16]'
  const depthClass = isCanvas ? 'from-white/38' : 'from-white/52'

  return (
    <>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${grainA}`}
        style={{
          backgroundImage: `radial-gradient(${GRAIN_DOT_A} 0.5px, transparent 0.65px)`,
          backgroundSize: '12px 12px',
        }}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${grainB}`}
        style={{
          backgroundImage: `radial-gradient(${GRAIN_DOT_B} 0.5px, transparent 0.65px)`,
          backgroundSize: '12px 12px',
          backgroundPosition: '6px 6px',
        }}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 mix-blend-multiply ${brush}`}
        style={{
          backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent 4px, ${BRUSH_LINE} 4px, ${BRUSH_LINE} 5px)`,
        }}
      />
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 mix-blend-multiply', striae)}
        style={{
          backgroundImage: `repeating-linear-gradient(93deg, transparent 0px, transparent 7px, ${STRIAE_LINE} 7px, ${STRIAE_LINE} 8px)`,
        }}
      />
      <span aria-hidden className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', washClass)} />
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 bg-gradient-to-b via-transparent to-slate-400/[0.14]', depthClass)}
      />
    </>
  )
}
