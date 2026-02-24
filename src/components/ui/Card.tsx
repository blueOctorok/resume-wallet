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
        'rounded-2xl border transition-colors',
        variant === 'default' &&
          'bg-white/80 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 backdrop-blur-sm',
        variant === 'elevated' &&
          'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg',
        variant === 'flat' &&
          'bg-transparent border-gray-200 dark:border-gray-700',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
