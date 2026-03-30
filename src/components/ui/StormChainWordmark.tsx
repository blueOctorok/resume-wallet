'use client'

import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import StormOLogoMark from '@/components/ui/StormOLogoMark'

export type StormChainWordmarkSize = 'nav' | 'hero'

interface StormChainWordmarkProps {
  size?: StormChainWordmarkSize
  className?: string
}

/**
 * Logo lockup: **STORM** as the hero (ST + O-mark + RM), **chain** as a smaller linker underneath.
 * O-mark is sized near cap-height with tight side margins so it reads as a true **O**, not “ST · icon · RM”.
 */
export default function StormChainWordmark({
  size = 'nav',
  className,
}: StormChainWordmarkProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const isHero = size === 'hero'

  const stormLine = cn(
    'inline-flex items-center justify-center font-[family-name:var(--font-storm-wordmark),ui-serif,Georgia,serif] font-medium leading-none tracking-[0.045em] sm:tracking-[0.055em]',
    isHero
      ? cn(
          'text-[2.25rem] sm:text-[2.75rem] lg:text-[3.25rem]',
          isDark
            ? 'text-slate-200/95 [text-shadow:0_2px_0_rgba(0,0,0,0.45),0_0_24px_rgba(0,0,0,0.5)]'
            : 'text-slate-600 [text-shadow:0_1px_0_rgba(255,255,255,0.9),0_-1px_1px_rgba(15,23,42,0.12)]',
        )
      : cn(
          'text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem]',
          isDark
            ? 'text-slate-500/90 [text-shadow:0_1px_0_rgba(255,255,255,0.07),0_-1px_3px_rgba(0,0,0,0.65),0_0.12em_0.35em_rgba(0,0,0,0.35)]'
            : 'text-slate-500/95 [text-shadow:0_1px_0_rgba(255,255,255,0.85),0_-1px_1px_rgba(15,23,42,0.14),0_0.08em_0.2em_rgba(15,23,42,0.06)]',
        ),
  )

  const chainLine = cn(
    'font-[family-name:var(--font-storm-wordmark),ui-serif,Georgia,serif] font-normal leading-none lowercase',
    isHero
      ? cn(
          'text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem] tracking-[0.14em]',
          isDark
            ? 'text-teal-400/65 [text-shadow:0_2px_0_rgba(0,0,0,0.4),0_0_20px_rgba(45,212,191,0.12)]'
            : 'text-teal-700/55 [text-shadow:0_1px_0_rgba(255,255,255,0.8),0_-1px_1px_rgba(15,118,110,0.18)]',
        )
      : cn(
          'text-[0.8125rem] sm:text-[0.9375rem] lg:text-[1.0625rem] tracking-[0.12em]',
          isDark
            ? 'text-teal-500/50 [text-shadow:0_1px_0_rgba(255,255,255,0.06),0_-1px_3px_rgba(0,0,0,0.6),0_0.12em_0.35em_rgba(0,0,0,0.32)]'
            : 'text-teal-700/45 [text-shadow:0_1px_0_rgba(255,255,255,0.8),0_-1px_1px_rgba(15,118,110,0.18),0_0.08em_0.2em_rgba(15,23,42,0.05)]',
        ),
  )

  return (
    <div className={cn('flex flex-col items-center gap-0 leading-none', className)}>
      <div className={cn(stormLine, 'gap-0')}>
        <span className='select-none uppercase'>ST</span>
        <StormOLogoMark
          className={cn(
            /* Negative horizontal margin: closes optical gap so O sits like a real letter */
            isHero
              ? 'h-[1.12em] w-[1.12em] -mx-[0.085em]'
              : 'h-[1.06em] w-[1.06em] -mx-[0.075em]',
          )}
        />
        <span className='select-none uppercase'>RM</span>
      </div>
      {/* Pull linker up; amount scales with smaller “chain” type */}
      <div
        className={cn(
          chainLine,
          isHero
            ? '-mt-[0.30em] sm:-mt-[0.28em] lg:-mt-[0.26em]'
            : '-mt-[0.22em] sm:-mt-[0.20em] lg:-mt-[0.18em]',
        )}
      >
        chain
      </div>
    </div>
  )
}
