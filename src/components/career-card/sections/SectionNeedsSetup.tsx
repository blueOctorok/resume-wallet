'use client'

import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface SectionNeedsSetupProps {
  icon: LucideIcon
  label: string
  isDark: boolean
  onAction?: () => void
}

/**
 * Placeholder shown inside the career card when a block is installed but has
 * no data yet. Visible in owner modes (self + construct) so the user always
 * knows which blocks still need attention. Public/employer views skip it.
 */
export default function SectionNeedsSetup({ icon: Icon, label, isDark, onAction }: SectionNeedsSetupProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed p-4',
        isDark ? 'bg-amber-500/[0.04] border-amber-500/30' : 'bg-amber-50/50 border-amber-400/40',
      )}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2.5'>
          <div
            className={cn(
              'flex size-7 items-center justify-center rounded-lg',
              isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-600',
            )}
          >
            <Icon className='size-3.5' />
          </div>
          <div>
            <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
              {label}
            </p>
            <p className={cn('flex items-center gap-1 text-xs', isDark ? 'text-amber-400/80' : 'text-amber-600')}>
              <AlertCircle className='size-3' />
              Not started yet
            </p>
          </div>
        </div>
        {onAction && (
          <button
            type='button'
            onClick={onAction}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              isDark
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200',
            )}
          >
            Set up
          </button>
        )}
      </div>
    </div>
  )
}
