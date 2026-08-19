'use client'

import { useMemo } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  FolderCheck,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore, useUIStore } from '@/stores'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import { useJourneyProgress } from '@/stores/journey-store'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import DqCoachPanel from '@/components/hub/DqCoachPanel'
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
  done: 'bg-retro-teal/10 text-retro-teal ring-1 ring-retro-teal/25',
  'in-progress': 'bg-dark-amber/10 text-dark-amber ring-1 ring-dark-amber/25',
  waiting: 'bg-dark-amber/10 text-dark-amber ring-1 ring-dark-amber/20',
  attention: 'bg-dark-amber/10 text-dark-amber ring-1 ring-dark-amber/20',
  todo: 'bg-stone-100 text-stone-700',
  locked: 'bg-stone-100 text-ironside',
}

function TileStatusIcon({ status }: { status: TileStatus }) {
  if (status === 'done')
    return <CheckCircle2 className='h-4 w-4 shrink-0 text-retro-teal' aria-hidden />
  if (status === 'waiting' || status === 'attention')
    return <Clock className='h-4 w-4 shrink-0 text-dark-amber' aria-hidden />
  if (status === 'in-progress')
    return <CircleDot className='h-4 w-4 shrink-0 text-dark-amber' aria-hidden />
  if (status === 'locked')
    return <Lock className='h-3.5 w-3.5 shrink-0 text-ironside' aria-hidden />
  return <CircleDot className='h-4 w-4 shrink-0 text-ironside/50' aria-hidden />
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

function BoardTileButton({ tile }: { tile: BoardTile }) {
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
          ? 'border-retro-teal/30 bg-retro-teal/[0.08]'
          : 'border-ironside/25 bg-white',
        clickable
          ? 'cursor-pointer hover:border-[#f15a2b]/35 hover:bg-[#f15a2b]/[0.04]'
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
                ? 'text-[#173150]'
                : tile.status === 'locked'
                  ? 'text-ironside'
                  : 'text-[#173150]',
            )}
          >
            {tile.label}
          </span>
          {tile.cfrNote && (
            <span className='shrink-0 text-[10px] text-ironside'>
              {tile.cfrNote}
            </span>
          )}
        </span>
        {tile.hint && (
          <span className='mt-0.5 block text-xs leading-snug text-ironside'>
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
          <ChevronRight className='h-3.5 w-3.5 text-ironside' aria-hidden />
        )}
      </span>
    </button>
  )
}

export default function BuildBoard() {
  const setShowProfileSetup = useAuthStore((s) => s.setShowProfileSetup)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
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
    <HubSectionPanel isDark={false} accent='teal'>
      <BlockCard
        variant='embed'
        paper
        icon={FolderCheck}
        title='Your DQ file'
        description='Put the file together. The watcher scans your card and blocks for the next hole and anything that does not match.'
        status={overallStatus}
        headerActions={
          <span className='shrink-0 rounded-full border border-ironside/30 bg-stone-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#173150]'>
            {completedCount}/{totalCount} done
          </span>
        }
      >
        <DqCoachPanel />
        <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
          {activeTiles.map((tile) => (
            <BoardTileButton key={tile.id} tile={tile} />
          ))}
        </div>

        {comingTiles.length > 0 && (
          <div className='mt-5'>
            <p className='mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-ironside'>
              Coming online — handled by your employer or arriving soon
            </p>
            <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
              {comingTiles.map((tile) => (
                <BoardTileButton key={tile.id} tile={tile} />
              ))}
            </div>
          </div>
        )}
      </BlockCard>
    </HubSectionPanel>
  )
}
