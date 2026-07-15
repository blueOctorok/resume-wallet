'use client'

import { useAuthStore, useUIStore } from '@/stores'
import type { PageType } from '@/stores/types'
import { getBlockDefinition } from '@/lib/block-registry'
import BackToHubButton from '@/components/ui/BackToHubButton'
import HubInboxSection from '@/components/hub/HubInboxSection'

/**
 * Job alerts / employer requests / applications — formerly embedded on the hub home.
 * Reachable from My Hub → Inbox.
 */
export default function CandidateInboxPage() {
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  return (
    <div className='mx-auto w-full max-w-4xl space-y-4'>
      <BackToHubButton onClick={() => setCurrentPage('hub')} />
      <HubInboxSection
        sessionUserId={sessionUserId}
        onNavigateToResume={(targetBlockType) => {
          const route = targetBlockType ? getBlockDefinition(targetBlockType)?.pageRoute : null
          if (route) setCurrentPage(route as PageType)
          else setCurrentPage('storm-resume')
        }}
        onNavigateToDotApp={() => setCurrentPage('dotapp')}
      />
    </div>
  )
}
