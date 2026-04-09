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
/** Sepia: dusty green-grey — readable, not neon */
const primarySepia =
  'bg-[#5f6f6b] hover:bg-[#535f5c] text-[#faf6ef] shadow-sm dark:bg-teal-500 dark:hover:bg-teal-400'
/** Newsprint: neutral zinc — no teal */
const primaryPaper =
  'bg-zinc-600 hover:bg-zinc-500 text-zinc-50 shadow-sm dark:bg-teal-500 dark:hover:bg-teal-400'

const secondaryClasses =
  'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600'
const secondarySepiaClasses =
  'bg-[#ebe4d8] hover:bg-[#e0d8ca] text-[#3a342c] border border-[#cfc4b4] dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-600'
const secondaryPaperClasses =
  'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-600'

const ghostClasses =
  'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
const ghostSepiaClasses =
  'bg-transparent hover:bg-[#ebe4d8]/80 text-[#575049] hover:text-[#3a342c] dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-white'
const ghostPaperClasses =
  'bg-transparent hover:bg-zinc-200/80 text-zinc-600 hover:text-zinc-900 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-white'

const dangerClasses = 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white shadow-sm'

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

    const variantClass =
      variant === 'primary'
        ? theme === 'sepia'
          ? primarySepia
          : theme === 'paper'
            ? primaryPaper
            : primaryIcy
        : variant === 'secondary'
          ? theme === 'sepia'
            ? secondarySepiaClasses
            : theme === 'paper'
              ? secondaryPaperClasses
              : secondaryClasses
          : variant === 'ghost'
            ? theme === 'sepia'
              ? ghostSepiaClasses
              : theme === 'paper'
                ? ghostPaperClasses
                : ghostClasses
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
