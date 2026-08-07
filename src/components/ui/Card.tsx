'use client'

import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Use 'elevated' for a slightly more prominent card, 'flat' for a subtle border-only style */
  variant?: 'default' | 'elevated' | 'flat'
}

export default function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-[box-shadow,border-color,background-color] duration-300',
        variant === 'default' &&
          cn(
            /* Light: icy face + slate border so edges survive the brighter canvas */
            'bg-gradient-to-b from-slate-50/98 to-slate-100/95 dark:bg-[rgb(21,25,34)]/85 border border-slate-400/45 dark:border-slate-600/35',
            'shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.75)]',
            'dark:shadow-[0_0_32px_-14px_rgba(205,168,104,0.08)]',
            'backdrop-blur-none dark:backdrop-blur-md',
          ),
        variant === 'elevated' &&
          cn(
            'relative overflow-hidden',
            /* Light: glossy stack aligned with LoadingScreen + globals `.storm-light-panel` */
            'storm-light-panel dark:bg-transparent',
            'border-0 dark:border-transparent',
            'shadow-none dark:shadow-none',
            'dark:storm-glass-panel dark:backdrop-blur-xl',
            'dark:ring-1 dark:ring-teal-400/[0.14]',
          ),
        variant === 'flat' &&
          'bg-transparent border-gray-200 dark:border-gray-700',
        className
      )}
      {...props}
    >
      {variant === 'elevated' && (
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-600/32 to-transparent dark:from-transparent dark:via-teal-400/25 dark:to-transparent'
        />
      )}
      {children}
    </div>
  )
}
