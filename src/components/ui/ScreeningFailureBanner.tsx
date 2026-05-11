'use client'

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'

/**
 * Red failure banner for MVR / PSP orders that came back as failed.
 *
 * Shows up when a screening order reaches a terminal `failed` state. The
 * usual cause is a typo in the DL number, state, or DOB — the vendor (state
 * DMV for MVR, FMCSA for PSP) couldn't find a matching record. We name that
 * cause out loud because the answer is almost always "fix the data and
 * retry" and we don't want users guessing.
 *
 * `onRetry` is the same as the original "Order" CTA — opens the order form,
 * which already prefills from the user's CDL block / DOT app.
 */
interface ScreeningFailureBannerProps {
  kind: 'mvr' | 'psp'
  /** ScreeningOutcome from accio-result-status — `unknown` is the typical failure outcome. */
  outcome?: string | null
  isDark: boolean
  onRetry?: () => void
  /** Hide the retry button (e.g. employer-viewed cards). */
  hideRetry?: boolean
}

export default function ScreeningFailureBanner({
  kind,
  outcome,
  isDark,
  onRetry,
  hideRetry,
}: ScreeningFailureBannerProps) {
  const label = kind === 'mvr' ? 'Motor Vehicle Record' : 'PSP report'
  const vendor = kind === 'mvr' ? 'state DMV' : 'FMCSA'

  // outcome="unknown" almost always means the vendor returned `unfilled` —
  // i.e. they couldn't locate a record. Other outcomes (e.g. `error`) get
  // a more generic message.
  const reason =
    outcome === 'unknown'
      ? `The ${vendor} couldn't find a matching record. Most often this means the driver license number, state, or date of birth was entered incorrectly.`
      : `Something went wrong while pulling this report from ${vendor}.`

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-4',
        isDark
          ? 'bg-red-950/30 border-red-700/50'
          : 'bg-red-50 border-red-300',
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={cn(
            'h-5 w-5 shrink-0 mt-0.5',
            isDark ? 'text-red-400' : 'text-red-600',
          )}
        />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-semibold mb-1',
              isDark ? 'text-red-300' : 'text-red-800',
            )}
          >
            We couldn&apos;t complete this {label}.
          </p>
          <p
            className={cn(
              'text-xs mb-3',
              isDark ? 'text-red-200/80' : 'text-red-700',
            )}
          >
            {reason} Double-check the info on the physical license and re-order — your data is prefilled from your last entry.
          </p>
          {!hideRetry && onRetry && (
            <Button type="button" variant="danger" size="sm" onClick={onRetry}>
              Re-order with corrected info
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
