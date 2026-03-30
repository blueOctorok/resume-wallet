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
            /* Light: crisp panel + hairline gloss (Stripe-like separation from canvas) */
            'bg-white dark:bg-[rgb(21,25,34)]/85 border border-slate-300/95 dark:border-slate-600/35',
            'shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.88)] dark:shadow-[0_0_32px_-14px_rgba(45,212,191,0.08)]',
            'backdrop-blur-none dark:backdrop-blur-md',
          ),
        variant === 'elevated' &&
          cn(
            'relative overflow-hidden',
            /* Light: glossy stack aligned with LoadingScreen + globals `.storm-light-panel` */
            'storm-light-panel dark:bg-transparent',
            'border-0 dark:border-transparent',
            'shadow-none dark:shadow-none',
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
          className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-600/22 to-transparent dark:from-transparent dark:via-teal-400/25 dark:to-transparent'
        />
      )}
      {children}
    </div>
  )
}
