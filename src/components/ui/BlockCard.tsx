'use client'

import { X, CheckCircle, Clock, AlertCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import Card from './Card'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BlockStatus = 'complete' | 'in-progress' | 'empty'

interface BlockCardProps {
  /** Icon component from lucide-react — passed as a component, not a string */
  icon: LucideIcon
  title: string
  description?: string
  status?: BlockStatus
  /** Shows an X button in the header to remove the block from the hub */
  onRemove?: () => void
  className?: string
  children?: React.ReactNode
}

// ── Status config ─────────────────────────────────────────────────────────────

const statusConfig: Record<BlockStatus, {
  icon: LucideIcon
  label: string
  classes: string
}> = {
  complete: {
    icon: CheckCircle,
    label: 'Complete',
    classes: 'text-emerald-500 dark:text-emerald-400',
  },
  'in-progress': {
    icon: Clock,
    label: 'In Progress',
    classes: 'text-amber-500 dark:text-amber-400',
  },
  empty: {
    icon: AlertCircle,
    label: 'Not Started',
    classes: 'text-gray-400 dark:text-gray-500',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * BlockCard — the universal shell for every composable hub block.
 *
 * All blocks must use this component as their outer wrapper. This enforces
 * a consistent layout across the hub: icon + title header, optional status
 * badge, and a standard card container.
 *
 * Usage:
 *   <BlockCard icon={ClipboardList} title="DOT Application" status="in-progress">
 *     <DotApplicationContent />
 *   </BlockCard>
 */
export default function BlockCard({
  icon: Icon,
  title,
  description,
  status,
  onRemove,
  className,
  children,
}: BlockCardProps) {
  const statusInfo = status ? statusConfig[status] : null
  const StatusIcon = statusInfo?.icon

  return (
    <Card variant='elevated' className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className='flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/60'>
        <div className='flex items-center gap-3 min-w-0'>
          {/* Block icon */}
          <div className='flex-shrink-0 w-9 h-9 rounded-lg bg-teal-500/10 dark:bg-teal-400/10 flex items-center justify-center'>
            <Icon className='w-5 h-5 text-teal-600 dark:text-teal-400' />
          </div>

          {/* Title + description */}
          <div className='min-w-0'>
            <h3 className='text-sm font-semibold text-gray-900 dark:text-white truncate'>
              {title}
            </h3>
            {description && (
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate'>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right side: status badge + remove button */}
        <div className='flex items-center gap-2 flex-shrink-0'>
          {statusInfo && StatusIcon && (
            <span className={cn('flex items-center gap-1 text-xs font-medium', statusInfo.classes)}>
              <StatusIcon className='w-3.5 h-3.5' />
              {statusInfo.label}
            </span>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              title={`Remove ${title} block`}
              className='p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {children && (
        <div className='p-4 sm:p-5'>
          {children}
        </div>
      )}
    </Card>
  )
}
