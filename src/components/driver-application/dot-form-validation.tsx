'use client'

import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DOT_VALIDATION_BANNER_ID = 'dot-form-validation-banner'

/** Red border helper for inputs that failed validation. */
export function dotErrorInputClass(hasError: boolean): string {
  return hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''
}

export function DotFieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{message}</p>
}

/**
 * Sticky-ish summary when Next is blocked — lists every validation message
 * so users aren't left with a dead button and no explanation.
 */
export function DotValidationBanner({
  errors,
  isDark,
}: {
  errors: Record<string, string>
  isDark: boolean
}) {
  const messages = Object.values(errors).filter(Boolean)
  if (messages.length === 0) return null

  return (
    <div
      id={DOT_VALIDATION_BANNER_ID}
      role='alert'
      aria-live='polite'
      className={cn(
        'mb-6 rounded-xl border px-4 py-3',
        isDark
          ? 'border-red-500/40 bg-red-500/10 text-red-200'
          : 'border-red-300 bg-red-50 text-red-800',
      )}
    >
      <div className='flex items-start gap-2.5'>
        <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-red-500' aria-hidden />
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-semibold'>
            Fix {messages.length} item{messages.length === 1 ? '' : 's'} to continue
          </p>
          <ul className='mt-2 list-disc space-y-1 pl-4 text-sm'>
            {messages.map((msg, i) => (
              <li key={`${i}-${msg}`}>{msg}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/** Call after a failed validateStep so the summary (and first field errors) are visible. */
export function scrollToDotValidationErrors(): void {
  if (typeof window === 'undefined') return
  requestAnimationFrame(() => {
    const el = document.getElementById(DOT_VALIDATION_BANNER_ID)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
}
