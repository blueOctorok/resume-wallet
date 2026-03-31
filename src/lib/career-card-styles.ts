import { cn } from '@/lib/utils'

/**
 * Shared visual vocabulary for CareerCard + ProjectedCareerCard. Outer shell is
 * `VaultHorizontalVaultShell`; inset panels match block-style cards on the same surface.
 */

/** Inner panels (completeness strip, dense lists) */
export function careerCardInsetPanelClass(isDark: boolean) {
  return cn(
    'rounded-xl border p-4',
    isDark
      ? 'border-gray-600/55 bg-gray-800/50 ring-1 ring-white/[0.04]'
      : 'border-gray-200/90 bg-white/75 ring-1 ring-gray-900/[0.04]',
  )
}
