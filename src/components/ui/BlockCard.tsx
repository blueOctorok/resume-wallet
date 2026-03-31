'use client'

import type { ReactNode } from 'react'
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
  /** Extra controls in the header row (e.g. hub hive Edit + Add) */
  headerActions?: ReactNode
  /**
   * `embed` — header + content only (no rounded `Card`); no left accent/sigil (outer vault frames the block); extra padding. Use inside `VaultHorizontalVaultShell`.
   */
  variant?: 'default' | 'embed'
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
 *   <BlockCard icon={LayoutGrid} title="Your blocks" headerActions={...}>…hive…</BlockCard>
 *   <VaultHorizontalVaultShell><BlockCard variant="embed" … /></VaultHorizontalVaultShell> — hub files; no nested Card.
 */
function BlockCardChrome({
  icon: Icon,
  title,
  description,
  status,
  onRemove,
  headerActions,
  children,
  /** Inside vault shell — no left accent bar (vault already frames the block) + roomier padding */
  embed = false,
}: Omit<BlockCardProps, 'variant' | 'className'> & { embed?: boolean }) {
  const statusInfo = status ? statusConfig[status] : null
  const StatusIcon = statusInfo?.icon

  return (
    <>
      {!embed && (
        <>
          <div
            aria-hidden
            className='pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-teal-500/80 via-cyan-500/50 to-violet-500/60 dark:from-teal-400/70 dark:via-teal-500/40 dark:to-violet-500/50'
          />
          <div
            aria-hidden
            className='pointer-events-none absolute left-2 top-3 flex gap-0.5 opacity-30 dark:opacity-25'
          >
            <span className='h-1.5 w-1.5 rounded-full border border-teal-600/70 dark:border-teal-400/60' />
            <span className='h-1.5 w-1.5 rounded-full border border-teal-600/50 dark:border-teal-400/40' />
          </div>
        </>
      )}
      <div
        className={cn(
          'flex items-start justify-between gap-3 border-b border-slate-300/90 dark:border-gray-700/50',
          embed
            ? 'px-5 py-4 sm:px-6 sm:py-5'
            : 'p-4 pl-5 sm:p-5 sm:pl-6',
        )}
      >
        <div className='flex min-w-0 items-center gap-3'>
          <div className='flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/20 via-cyan-500/12 to-violet-500/15 shadow-inner shadow-teal-900/5 ring-1 ring-teal-500/25 dark:from-teal-400/25 dark:via-teal-500/10 dark:to-violet-500/20 dark:ring-teal-400/30'>
            <Icon className='h-5 w-5 text-teal-600 dark:text-teal-400' />
          </div>

          <div className='min-w-0'>
            <h3 className='text-sm font-semibold tracking-tight text-slate-900 dark:text-white truncate'>
              {title}
            </h3>
            {description && (
              <p className='text-xs text-slate-600 dark:text-gray-400 mt-0.5 truncate'>
                {description}
              </p>
            )}
          </div>
        </div>

        <div className='flex flex-wrap items-center justify-end gap-2 flex-shrink-0'>
          {headerActions}
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

      {children && (
        <div className={embed ? 'px-5 py-6 sm:px-6 sm:py-7' : 'p-4 sm:p-5'}>
          {children}
        </div>
      )}
    </>
  )
}

export default function BlockCard({
  icon: Icon,
  title,
  description,
  status,
  onRemove,
  headerActions,
  variant = 'default',
  className,
  children,
}: BlockCardProps) {
  if (variant === 'embed') {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <BlockCardChrome
          embed
          icon={Icon}
          title={title}
          description={description}
          status={status}
          onRemove={onRemove}
          headerActions={headerActions}
        >
          {children}
        </BlockCardChrome>
      </div>
    )
  }

  return (
    <Card variant='elevated' className={cn('overflow-hidden relative', className)}>
      <BlockCardChrome
        embed={false}
        icon={Icon}
        title={title}
        description={description}
        status={status}
        onRemove={onRemove}
        headerActions={headerActions}
      >
        {children}
      </BlockCardChrome>
    </Card>
  )
}
