'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string | null
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className='w-full'>
        {label ? (
          <label
            htmlFor={inputId}
            className='mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl border px-4 py-2.5 text-sm transition-colors',
            'bg-white text-gray-900 placeholder-gray-400 border-gray-300',
            'focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500',
            'dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:border-gray-600',
            'dark:focus:border-teal-500 dark:focus:ring-teal-500',
            error && 'border-red-500 dark:border-red-500',
            className,
          )}
          {...props}
        />
        {error ? (
          <p className='mt-1.5 text-sm text-red-600 dark:text-red-400' role='alert'>
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)

Input.displayName = 'Input'

export default Input
