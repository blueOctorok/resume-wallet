'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useMemo } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  FolderCheck,
  Lock,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import { useJourneyProgress } from '@/stores/journey-store'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import {
  DQ_ITEM_DEFINITIONS,
  dqSourceChipLabel,
  type DqItemId,
} from '@/lib/dq-file-registry'
import type { DqItemStatus, DqItemStatusResult } from '@/lib/dq-file-status'
import type { PageType } from '@/stores/types'

/**
 * The Build board — drivers-only DQ file status grid.
 * Profile + every DQ item (live or coming). No portfolio / GitHub / general
 * blocks. Tap a tile to work; "Add a block" opens the drivers-only picker.
 */

type TileStatus = 'done' | 'in-progress' | 'waiting' | 'attention' | 'todo' | 'locked'

interface BoardTile {
  id: string
  label: string
  /** One-liner under the label — what this is / what to do. */
  hint: string | null
  cfrNote?: string
  status: TileStatus
  /** Short chip text ("Done", "Processing", "Needs Key", …). */
  chip: string
  onClick?: () => void
}

/** Candidate-side route for each DQ item the driver can act on themselves. */
const DQ_ROUTES: Partial<Record<DqItemId, PageType>> = {
  mvr: 'mvr',
  psp: 'psp',
  dot_application: 'dotapp',
  cdlis_consent: 'screening-consent',
  employment_verification: 'employment-verification',
}

const CHIP_CLASSES: Record<TileStatus, string> = {
  done: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  'in-progress':
    'bg-teal-50 text-teal-800 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-400/25',
  waiting: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  attention: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  todo: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-gray-300',
  locked: 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-gray-500',
}

function TileStatusIcon({ status }: { status: TileStatus }) {
  if (status === 'done')
    return <CheckCircle2 className='h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400' aria-hidden />
  if (status === 'waiting' || status === 'attention')
    return <Clock className='h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400' aria-hidden />
  if (status === 'in-progress')
    return <CircleDot className='h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300' aria-hidden />
  if (status === 'locked')
    return <Lock className='h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-gray-500' aria-hidden />
  return <CircleDot className='h-4 w-4 shrink-0 text-slate-300 dark:text-gray-600' aria-hidden />
}

/** Map a resolved DQ item status onto tile status + chip + hint. */
function dqStatusToTile(item: DqItemStatusResult): Pick<BoardTile, 'status' | 'chip' | 'hint'> {
  switch (item.status) {
    case 'complete':
      return { status: 'done', chip: 'Done', hint: null }
    case 'processing':
      return { status: 'waiting', chip: 'Processing', hint: 'Being pulled now — no action needed' }
    case 'in_progress':
      return { status: 'in-progress', chip: 'In progress', hint: 'Pick up where you left off' }
    case 'requested':
      return { status: 'attention', chip: 'Requested', hint: 'An employer asked for this — finish it first' }
    case 'failed':
      return { status: 'attention', chip: 'Retry', hint: 'Something went wrong — tap to try again' }
    case 'missing':
      return { status: 'todo', chip: 'To do', hint: item.emptyHint }
    default:
      // needs_driver / needs_key / needs_gov / needs_employer / coming_soon
      return { status: 'locked', chip: item.sourceChip ?? 'Coming soon', hint: item.emptyHint }
  }
}

function BoardTileButton({ tile, isDark }: { tile: BoardTile; isDark: boolean }) {
  const clickable = !!tile.onClick
  return (
    <button
      type='button'
      onClick={tile.onClick}
      disabled={!clickable}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
        tile.status === 'locked' && 'border-dashed opacity-70',
        tile.status === 'done'
          ? isDark
            ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
            : 'border-emerald-200/80 bg-emerald-50/50'
          : isDark
            ? 'border-white/10 bg-white/[0.03]'
            : 'border-slate-200 bg-white/70',
        clickable
          ? isDark
            ? 'cursor-pointer hover:border-teal-400/40 hover:bg-white/[0.06]'
            : 'cursor-pointer hover:border-teal-300 hover:bg-teal-50/40'
          : 'cursor-default',
      )}
    >
      <span className='mt-0.5'>
        <TileStatusIcon status={tile.status} />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='flex items-baseline gap-1.5'>
          <span
            className={cn(
              'text-sm font-medium leading-snug',
              tile.status === 'done'
                ? isDark
                  ? 'text-emerald-200/90'
                  : 'text-emerald-900/90'
                : tile.status === 'locked'
                  ? isDark
                    ? 'text-gray-400'
                    : 'text-slate-500'
                  : isDark
                    ? 'text-gray-100'
                    : 'text-slate-900',
            )}
          >
            {tile.label}
          </span>
          {tile.cfrNote && (
            <span className={cn('shrink-0 text-[10px]', isDark ? 'text-gray-500' : 'text-slate-400')}>
              {tile.cfrNote}
            </span>
          )}
        </span>
        {tile.hint && (
          <span className={cn('mt-0.5 block text-xs leading-snug', isDark ? 'text-gray-400' : 'text-slate-500')}>
            {tile.hint}
          </span>
        )}
      </span>
      <span className='flex shrink-0 items-center gap-1.5 pt-0.5'>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            CHIP_CLASSES[tile.status],
          )}
        >
          {tile.chip}
        </span>
        {clickable && (
          <ChevronRight className={cn('h-3.5 w-3.5', isDark ? 'text-gray-500' : 'text-slate-400')} aria-hidden />
        )}
      </span>
    </button>
  )
}

export default function BuildBoard() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const setShowProfileSetup = useAuthStore((s) => s.setShowProfileSetup)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const dqFile = useDriverHubStore((s) => s.dqFile)
  const journey = useJourneyProgress()

  const journeyStatus = useMemo(() => {
    const byId = new Map(journey.steps.map((s) => [s.id, s.status]))
    return (id: string): TileStatus => {
      const status = byId.get(id)
      if (status === 'complete') return 'done'
      if (status === 'in_progress') return 'in-progress'
      return 'todo'
    }
  }, [journey.steps])

  const { activeTiles, comingTiles, completedCount, totalCount } = useMemo(() => {
    const active: BoardTile[] = []
    const coming: BoardTile[] = []

    // 1. Profile — identity data feeds every block, so it leads the board.
    const profileStatus = journeyStatus('profile')
    active.push({
      id: 'profile',
      label: 'Profile',
      hint: profileStatus === 'done' ? null : 'Name, contact & location',
      status: profileStatus,
      chip: profileStatus === 'done' ? 'Done' : profileStatus === 'in-progress' ? 'In progress' : 'To do',
      onClick: () => setShowProfileSetup(true),
    })

    // 2. Every DQ item — drivers only. No portfolio / GitHub / general blocks.
    for (const def of DQ_ITEM_DEFINITIONS) {
      const resolved = dqFile?.items.find((i) => i.id === def.id) ?? null
      const route = DQ_ROUTES[def.id]

      const base = resolved
        ? dqStatusToTile(resolved)
        : def.blocksOverallCompletion
          ? { status: 'todo' as const, chip: 'To do', hint: def.driverEmptyHint }
          : { status: 'locked' as const, chip: dqSourceChipLabel(def.source), hint: def.driverEmptyHint }

      const tile: BoardTile = {
        id: def.id,
        label: def.label,
        cfrNote: def.cfrNote,
        ...base,
        onClick:
          route && base.status !== 'locked' ? () => setCurrentPage(route) : undefined,
      }

      if (base.status === 'locked' && !def.blocksOverallCompletion) coming.push(tile)
      else active.push(tile)
    }

    return {
      activeTiles: active,
      comingTiles: coming,
      completedCount: active.filter((t) => t.status === 'done').length,
      totalCount: active.length,
    }
  }, [dqFile, journeyStatus, setCurrentPage, setShowProfileSetup])

  const overallStatus =
    completedCount >= totalCount ? 'complete' : completedCount > 0 ? 'in-progress' : 'empty'

  return (
    <HubSectionPanel isDark={isDark} accent='teal'>
      <BlockCard
        variant='embed'
        icon={FolderCheck}
        title='Your DQ file'
        description='Everything a complete file needs — tap a tile to work on it.'
        status={overallStatus}
        headerActions={
          <span
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums',
              isDark
                ? 'border-white/10 bg-white/[0.04] text-gray-200'
                : 'border-slate-200 bg-white/70 text-slate-700',
            )}
          >
            {completedCount}/{totalCount} done
          </span>
        }
      >
        <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
          {activeTiles.map((tile) => (
            <BoardTileButton key={tile.id} tile={tile} isDark={isDark} />
          ))}

          {/* Add-a-block tile — the picker entry point now that the old
              "Strengthen your card" rail is gone with the construct card. */}
          <button
            type='button'
            onClick={openPicker}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-3.5 text-sm font-medium transition-colors',
              isDark
                ? 'border-white/15 text-gray-300 hover:border-teal-400/40 hover:text-teal-200'
                : 'border-slate-300 text-slate-600 hover:border-teal-400 hover:text-teal-800',
            )}
          >
            <Plus className='h-4 w-4' aria-hidden />
            Add a block
          </button>
        </div>

        {comingTiles.length > 0 && (
          <div className='mt-5'>
            <p
              className={cn(
                'mb-2.5 text-[11px] font-semibold uppercase tracking-wide',
                isDark ? 'text-gray-500' : 'text-slate-400',
              )}
            >
              Coming online — handled by your employer or arriving soon
            </p>
            <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
              {comingTiles.map((tile) => (
                <BoardTileButton key={tile.id} tile={tile} isDark={isDark} />
              ))}
            </div>
          </div>
        )}
      </BlockCard>
    </HubSectionPanel>
  )
}
