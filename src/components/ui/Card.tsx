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
          'bg-white/85 dark:bg-gray-800/55 border-gray-200/90 dark:border-gray-700/80 backdrop-blur-md shadow-sm dark:shadow-none',
        variant === 'elevated' &&
          cn(
            'relative overflow-hidden',
            'bg-gradient-to-br from-white via-white to-slate-50/90',
            'dark:from-gray-900 dark:via-gray-900 dark:to-gray-800/95',
            'border-gray-200/90 dark:border-gray-600/70',
            'shadow-[0_12px_40px_-12px_rgba(13,148,136,0.18)] dark:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.55)]',
            'ring-1 ring-teal-500/[0.08] dark:ring-teal-400/[0.09]',
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
          className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/45 to-transparent dark:via-teal-400/35'
        />
      )}
      {children}
    </div>
  )
}
