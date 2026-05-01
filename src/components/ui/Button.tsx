'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}

const primaryIcy =
  'bg-teal-600 hover:bg-teal-500 text-white shadow-sm dark:bg-teal-500 dark:hover:bg-teal-400'
/** Newsprint: neutral zinc — no teal */
const primaryPaper =
  'bg-zinc-600 hover:bg-zinc-500 text-zinc-50 shadow-sm dark:bg-teal-500 dark:hover:bg-teal-400'
/** Quiet ink: neutral on dark canvas — mirrors paper’s “no brand chroma” discipline. */
const primaryInk =
  'bg-zinc-500 hover:bg-zinc-400 text-white shadow-sm dark:bg-zinc-500 dark:hover:bg-zinc-400'

const secondaryClasses =
  'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600'
const secondaryPaperClasses =
  'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-600'
const secondaryInkClasses =
  'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-600'

const ghostClasses =
  'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
const ghostPaperClasses =
  'bg-transparent hover:bg-zinc-200/80 text-zinc-600 hover:text-zinc-900 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-white'
const ghostInkClasses =
  'bg-transparent hover:bg-zinc-800/90 text-zinc-400 hover:text-zinc-100 dark:bg-transparent dark:hover:bg-zinc-800/90 dark:text-zinc-400 dark:hover:text-zinc-100'

const dangerClasses = 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white shadow-sm'
/** Paper / ink: destructive cue without red (monochrome surfaces). */
const dangerPaperClasses =
  'bg-zinc-800 hover:bg-zinc-900 text-zinc-50 shadow-sm dark:bg-red-700 dark:hover:bg-red-800'
const dangerInkClasses =
  'bg-zinc-600 hover:bg-zinc-500 text-zinc-50 shadow-sm dark:bg-zinc-600 dark:hover:bg-zinc-500'

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const { theme } = useTheme()

    const quietLight = theme === 'paper'
    const quietDark = theme === 'ink'

    const variantClass =
      variant === 'primary'
        ? quietLight
          ? primaryPaper
          : quietDark
            ? primaryInk
            : primaryIcy
        : variant === 'secondary'
          ? quietLight
            ? secondaryPaperClasses
            : quietDark
              ? secondaryInkClasses
              : secondaryClasses
          : variant === 'ghost'
            ? quietLight
              ? ghostPaperClasses
              : quietDark
                ? ghostInkClasses
                : ghostClasses
            : quietLight
              ? dangerPaperClasses
              : quietDark
                ? dangerInkClasses
                : dangerClasses

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
          variantClass,
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading && <span className='animate-spin rounded-full h-4 w-4 border-b-2 border-current' />}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'

export default Button
