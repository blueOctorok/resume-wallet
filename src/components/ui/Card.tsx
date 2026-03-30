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
            'bg-white dark:bg-[rgb(21,25,34)]/85 border border-slate-300/90 dark:border-slate-600/35',
            'shadow-sm shadow-slate-900/[0.04] dark:shadow-[0_0_32px_-14px_rgba(45,212,191,0.08)]',
            'backdrop-blur-none dark:backdrop-blur-md',
          ),
        variant === 'elevated' &&
          cn(
            'relative overflow-hidden',
            'bg-white dark:bg-transparent',
            'border border-slate-300/85 dark:border-transparent',
            'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-4px_rgba(15,23,42,0.08)]',
            /* Dark: same storm-glass stack as LoadingScreen */
            'dark:storm-glass-panel dark:backdrop-blur-xl dark:ring-1 dark:ring-teal-400/[0.14]',
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
          className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent dark:from-transparent dark:via-teal-400/25 dark:to-transparent'
        />
      )}
      {children}
    </div>
  )
}
