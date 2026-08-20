'use client'

import { useMemo } from 'react'
import { FolderCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJourneyProgress } from '@/stores/journey-store'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import DqCoachPanel from '@/components/hub/DqCoachPanel'
import { DQ_ITEM_DEFINITIONS } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'

/**
 * File board — AI-ordered next steps, then the full DQ packet
 * (including items we have not shipped yet).
 */

function packetChip(status: DqItemStatus | 'todo', live: boolean): { label: string; className: string } {
  if (status === 'complete') {
    return { label: 'On file', className: 'bg-retro-teal/10 text-retro-teal ring-1 ring-retro-teal/25' }
  }
  if (status === 'processing' || status === 'in_progress') {
    return { label: status === 'processing' ? 'Processing' : 'In progress', className: 'bg-dark-amber/10 text-dark-amber ring-1 ring-dark-amber/25' }
  }
  if (status === 'requested' || status === 'failed') {
    return { label: status === 'failed' ? 'Retry' : 'Requested', className: 'bg-dark-amber/10 text-dark-amber ring-1 ring-dark-amber/20' }
  }
  if (!live) {
    return { label: 'Not built yet', className: 'bg-stone-100 text-ironside ring-1 ring-ironside/15' }
  }
  return { label: 'To do', className: 'bg-stone-100 text-stone-700' }
}

export default function BuildBoard() {
  const dqFile = useDriverHubStore((s) => s.dqFile)
  const journey = useJourneyProgress()

  const { completedCount, totalCount, packet } = useMemo(() => {
    const live = DQ_ITEM_DEFINITIONS.filter((d) => d.blocksOverallCompletion)
    const profileDone = journey.steps.some((s) => s.id === 'profile' && s.status === 'complete')
    const dqDone = live.filter(
      (d) => dqFile?.items.find((i) => i.id === d.id)?.status === 'complete',
    ).length

    const profileStatus: DqItemStatus | 'todo' = profileDone
      ? 'complete'
      : journey.steps.some((s) => s.id === 'profile' && s.status === 'in_progress')
        ? 'in_progress'
        : 'todo'

    return {
      completedCount: (profileDone ? 1 : 0) + dqDone,
      totalCount: 1 + live.length,
      packet: [
        {
          id: 'profile',
          label: 'Profile',
          hint: profileDone ? null : 'Name, contact, and location',
          live: true,
          status: profileStatus,
        },
        ...DQ_ITEM_DEFINITIONS.map((def) => {
          const resolved = dqFile?.items.find((i) => i.id === def.id)
          return {
            id: def.id,
            label: def.label,
            hint: def.cfrNote ?? null,
            live: def.blocksOverallCompletion,
            status: (resolved?.status ?? (def.blocksOverallCompletion ? 'missing' : 'coming_soon')) as DqItemStatus,
          }
        }),
      ],
    }
  }, [dqFile, journey.steps])

  const overallStatus =
    completedCount >= totalCount ? 'complete' : completedCount > 0 ? 'in-progress' : 'empty'

  return (
    <HubSectionPanel isDark={false} accent='teal'>
      <BlockCard
        variant='embed'
        paper
        icon={FolderCheck}
        title='Your DQ file'
        description='What to do first, then every piece a complete file needs — including ones we have not shipped yet.'
        status={overallStatus}
        headerActions={
          <span className='shrink-0 rounded-full border border-ironside/30 bg-stone-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#173150]'>
            {completedCount}/{totalCount} live
          </span>
        }
      >
        <DqCoachPanel />

        <div className='mt-6 border-t border-ironside/15 pt-4'>
          <p className='mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#173150]'>
            Full DQ packet
          </p>
          <ul className='divide-y divide-ironside/10'>
            {packet.map((row) => {
              const chip = packetChip(row.status, row.live)
              return (
                <li key={row.id} className='flex items-baseline justify-between gap-3 py-2'>
                  <span className='min-w-0'>
                    <span className='text-sm text-[#173150]'>{row.label}</span>
                    {row.hint ? (
                      <span className='ml-1.5 text-[10px] text-ironside'>{row.hint}</span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      chip.className,
                    )}
                  >
                    {chip.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </BlockCard>
    </HubSectionPanel>
  )
}
