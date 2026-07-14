'use client'

import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DotVerifiedCoverage } from '@/lib/dot-verified-coverage'

interface DotVerifiedMeterProps {
  coverage: DotVerifiedCoverage
  isDark: boolean
  /** Compact = career card chip; full = DOT flow / preview banner */
  variant?: 'full' | 'compact'
  className?: string
}

/**
 * Honest verified-% meter for the DOT pre-screen packet (P3.7).
 * Headline can say "Verified" once majorityVerified — small print always shows.
 */
export default function DotVerifiedMeter({
  coverage,
  isDark,
  variant = 'full',
  className,
}: DotVerifiedMeterProps) {
  if (coverage.totalCount === 0) {
    if (variant === 'compact') return null
    return (
      <div
        className={cn(
          'rounded-xl border px-4 py-3 text-sm',
          isDark
            ? 'border-gray-700 bg-gray-800/60 text-gray-400'
            : 'border-gray-200 bg-gray-50 text-gray-600',
          className,
        )}
      >
        {coverage.caveat}
      </div>
    )
  }

  const barColor = coverage.majorityVerified
    ? isDark
      ? 'bg-teal-400'
      : 'bg-teal-600'
    : isDark
      ? 'bg-amber-400'
      : 'bg-amber-500'

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <ShieldCheck
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            coverage.majorityVerified
              ? isDark
                ? 'text-teal-300'
                : 'text-teal-700'
              : isDark
                ? 'text-amber-300'
                : 'text-amber-700',
          )}
        />
        <span
          className={cn(
            'text-xs font-medium',
            isDark ? 'text-gray-200' : 'text-gray-800',
          )}
        >
          {coverage.majorityVerified ? 'Verified' : 'Partially verified'} ·{' '}
          {coverage.percent}%
        </span>
        <span className={cn('text-[10px]', isDark ? 'text-gray-500' : 'text-gray-400')}>
          ({coverage.verifiedCount}/{coverage.totalCount} risk fields)
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        isDark
          ? 'border-teal-500/30 bg-teal-950/30'
          : 'border-teal-200 bg-teal-50/80',
        className,
      )}
    >
      <div className='flex items-start justify-between gap-3 mb-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <ShieldCheck
            className={cn(
              'h-4 w-4 shrink-0',
              coverage.majorityVerified
                ? isDark
                  ? 'text-teal-300'
                  : 'text-teal-700'
                : isDark
                  ? 'text-amber-300'
                  : 'text-amber-700',
            )}
          />
          <div className='min-w-0'>
            <p
              className={cn(
                'text-sm font-semibold',
                isDark ? 'text-gray-100' : 'text-gray-900',
              )}
            >
              {coverage.majorityVerified
                ? `Verified pre-screen · ${coverage.percent}%`
                : `Verification in progress · ${coverage.percent}%`}
            </p>
            <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {coverage.verifiedCount} of {coverage.totalCount} risk-bearing fields
              issuer-backed
            </p>
          </div>
        </div>
        <span
          className={cn(
            'text-lg font-bold tabular-nums shrink-0',
            isDark ? 'text-teal-200' : 'text-teal-800',
          )}
        >
          {coverage.percent}%
        </span>
      </div>
      <div
        className={cn(
          'h-2 w-full rounded-full overflow-hidden',
          isDark ? 'bg-gray-700' : 'bg-white/80',
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(100, Math.max(0, coverage.percent))}%` }}
        />
      </div>
      <p className={cn('mt-2 text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-gray-600')}>
        {coverage.caveat}
      </p>
    </div>
  )
}
