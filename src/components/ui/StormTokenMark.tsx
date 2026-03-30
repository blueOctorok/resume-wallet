'use client'

import { CloudLightning } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

const SIZE_MAP = {
  /** Nav pill, tight wallet rows */
  xs: {
    outer: 'h-7 w-7',
    mid: 'inset-[2px]',
    inner: 'inset-[8px]',
    icon: 'h-3 w-3',
    ring: 'border' as const,
    d1: '1s',
    d2: '1.35s',
    stroke: 1.2,
  },
  /** Token picker tiles, send form header */
  sm: {
    outer: 'h-8 w-8',
    mid: 'inset-[3px]',
    inner: 'inset-[13px]',
    icon: 'h-3.5 w-3.5',
    ring: 'border' as const,
    d1: '1.05s',
    d2: '1.4s',
    stroke: 1.25,
  },
  /** STORM balance card header */
  md: {
    outer: 'h-10 w-10',
    mid: 'inset-[3px]',
    inner: 'inset-[12px]',
    icon: 'h-4 w-4',
    ring: 'border-2' as const,
    d1: '1.1s',
    d2: '1.5s',
    stroke: 1.3,
  },
  /** LoadingScreen compact, driver hub hero */
  lg: {
    outer: 'h-16 w-16',
    mid: 'inset-[5px]',
    inner: 'inset-[22px]',
    icon: 'h-5 w-5',
    ring: 'border-2' as const,
    d1: '1s',
    d2: '1.35s',
    stroke: 1.35,
  },
  /** LoadingScreen full */
  xl: {
    outer: 'h-28 w-28 sm:h-32 sm:w-32',
    mid: 'inset-2',
    inner: 'inset-6',
    icon: 'h-10 w-10 sm:h-11 sm:w-11',
    ring: 'border-2' as const,
    d1: '1.15s',
    d2: '1.65s',
    stroke: 1.35,
  },
} as const

export type StormTokenMarkSize = keyof typeof SIZE_MAP

interface StormTokenMarkProps {
  size?: StormTokenMarkSize
  className?: string
  /** Decorative by default */
  decorative?: boolean
}

/**
 * Teal/violet counter-rotating rings + storm icon — same language as LoadingScreen.
 */
export default function StormTokenMark({
  size = 'md',
  className,
  decorative = true,
}: StormTokenMarkProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const s = SIZE_MAP[size]
  const ring = s.ring

  return (
    <div
      className={cn('relative shrink-0 motion-reduce:animate-none', s.outer, className)}
      aria-hidden={decorative ? true : undefined}
    >
      <div
        className={cn(
          `absolute inset-0 rounded-full ${ring} border-transparent motion-reduce:animate-none animate-spin`,
          'border-t-teal-500 border-r-teal-400/45 dark:border-t-teal-400 dark:border-r-teal-500/35',
        )}
        style={{ animationDuration: s.d1 }}
      />
      <div
        className={cn(
          `absolute rounded-full ${ring} border-transparent motion-reduce:animate-none animate-spin`,
          s.mid,
          'border-b-violet-500 border-l-violet-400/45 dark:border-b-violet-400 dark:border-l-violet-500/35',
        )}
        style={{ animationDuration: s.d2, animationDirection: 'reverse' }}
      />
      <div
        className={cn(
          'absolute flex items-center justify-center rounded-full',
          s.inner,
          isDark
            ? 'bg-gradient-to-br from-teal-500/[0.2] to-violet-600/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_-8px_rgba(45,212,191,0.12)]'
            : 'bg-gradient-to-br from-teal-100/90 to-violet-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
        )}
      >
        <CloudLightning
          className={cn(s.icon, 'text-teal-600 dark:text-teal-200/90')}
          strokeWidth={s.stroke}
          aria-hidden
        />
      </div>
    </div>
  )
}
