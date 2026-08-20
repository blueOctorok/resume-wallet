'use client'

import { useMemo } from 'react'
import { FolderCheck } from 'lucide-react'
import { useJourneyProgress } from '@/stores/journey-store'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import DqCoachPanel from '@/components/hub/DqCoachPanel'
import { DQ_ITEM_DEFINITIONS } from '@/lib/dq-file-registry'

/**
 * Build board — one AI-ordered queue. The watcher decides what is first;
 * done work collapses to chips. Coming-soon employer items stay off the list.
 */

export default function BuildBoard() {
  const dqFile = useDriverHubStore((s) => s.dqFile)
  const journey = useJourneyProgress()

  const { completedCount, totalCount } = useMemo(() => {
    const live = DQ_ITEM_DEFINITIONS.filter((d) => d.blocksOverallCompletion)
    const profileDone = journey.steps.some((s) => s.id === 'profile' && s.status === 'complete')
    const dqDone = live.filter(
      (d) => dqFile?.items.find((i) => i.id === d.id)?.status === 'complete',
    ).length
    return {
      completedCount: (profileDone ? 1 : 0) + dqDone,
      totalCount: 1 + live.length,
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
        description='One list, in order. Do the first item, scan again, then the next.'
        status={overallStatus}
        headerActions={
          <span className='shrink-0 rounded-full border border-ironside/30 bg-stone-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#173150]'>
            {completedCount}/{totalCount} done
          </span>
        }
      >
        <DqCoachPanel />
      </BlockCard>
    </HubSectionPanel>
  )
}
