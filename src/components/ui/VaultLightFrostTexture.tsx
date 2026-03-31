'use client'

import { cn } from '@/lib/utils'

/**
 * Light-mode only: layered micro-texture — dual-phase grain, brushed striae, cool prismatic wash,
 * depth + top bloom. Variants: **bar** (nav/wordmark), **tile** (hub), **canvas** (full viewport via `StormBackground`).
 */
export type VaultLightFrostVariant = 'bar' | 'tile' | 'canvas'

export default function VaultLightFrostTexture({ variant = 'bar' }: { variant?: VaultLightFrostVariant }) {
  const isBar = variant === 'bar'
  const isCanvas = variant === 'canvas'
  const grainA = isCanvas ? 'opacity-[0.34]' : isBar ? 'opacity-[0.52]' : 'opacity-[0.46]'
  const grainB = isCanvas ? 'opacity-[0.2]' : isBar ? 'opacity-[0.34]' : 'opacity-[0.3]'
  const brush = isCanvas ? 'opacity-[0.26]' : isBar ? 'opacity-[0.42]' : 'opacity-[0.38]'
  const striae = isCanvas ? 'opacity-[0.24]' : 'opacity-[0.38]'
  const washClass = isCanvas
    ? 'from-teal-50/[0.12] via-transparent to-violet-50/[0.08]'
    : 'from-teal-50/[0.2] via-transparent to-violet-50/[0.14]'
  const depthClass = isCanvas ? 'from-white/42' : 'from-white/62'
  const bloom = isCanvas ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.9)'
  const corner = isCanvas ? 'rgba(13,148,136,0.045)' : 'rgba(13,148,136,0.075)'

  return (
    <>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${grainA} bg-[radial-gradient(rgba(15,23,42,0.044)_0.5px,transparent_0.65px)] [background-size:12px_12px]`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${grainB} bg-[radial-gradient(rgba(15,23,42,0.032)_0.5px,transparent_0.65px)] [background-size:12px_12px] [background-position:6px_6px]`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 mix-blend-multiply ${brush}`}
        style={{
          backgroundImage:
            'repeating-linear-gradient(180deg, transparent 0px, transparent 4px, rgba(15,23,42,0.028) 4px, rgba(15,23,42,0.028) 5px)',
        }}
      />
      {/* Near-vertical micro-striae — etched glass; kept soft to limit moiré */}
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 mix-blend-soft-light', striae)}
        style={{
          backgroundImage:
            'repeating-linear-gradient(93deg, transparent 0px, transparent 7px, rgba(148,163,184,0.075) 7px, rgba(148,163,184,0.075) 8px)',
        }}
      />
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', washClass)}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-b via-transparent to-slate-200/[0.11]',
          depthClass,
        )}
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
