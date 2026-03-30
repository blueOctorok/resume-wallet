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
            /* Light: solid face + clear edge (no frosted white-on-slate = muddy contrast) */
            'bg-white dark:bg-gray-800/55 border border-slate-300/90 dark:border-gray-700/80',
            'shadow-sm shadow-slate-900/[0.04] dark:shadow-none',
            'backdrop-blur-none dark:backdrop-blur-md',
          ),
        variant === 'elevated' &&
          cn(
            'relative overflow-hidden',
            'bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-900 dark:to-gray-800/95',
            'border border-slate-300/85 dark:border-gray-600/70',
            /* Neutral lift in light; brand glow only in dark */
            'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-4px_rgba(15,23,42,0.08)]',
            'dark:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.55)]',
            'ring-1 ring-slate-200/90 dark:ring-teal-400/[0.09]',
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
          className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent dark:via-teal-400/35'
        />
      )}
      {children}
    </div>
  )
}
