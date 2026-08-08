'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { LifeBuoy } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import {
  useHubBlocksStore,
  useInstalledBlocks,
  useStormiAutoWelcomeCandidateDone,
} from '@/stores/hub-blocks-store'
import { isCoreBlock } from '@/lib/block-registry'
import { useHubContext } from '@/lib/ava-chat'
import BackToHubButton from '@/components/ui/BackToHubButton'
import BlockCard from '@/components/ui/BlockCard'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import StormiChatPanel from '@/components/stormi/StormiChatPanel'
import StormiContextModal from '@/components/hub/StormiContextModal'

/**
 * Help — the answer surface for a driver who's stuck.
 * Reached from the nav Help button. Deliberately unbranded: no assistant name
 * or persona, because the promise is "get unstuck", not "meet our AI".
 */
export default function CandidateAskAiPage() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const navigateToHub = useUIStore((s) => s.navigateToHub)

  const fetchHubData = useHubBlocksStore((s) => s.fetchHubData)
  const setStormiAutoWelcomeCandidateDone = useHubBlocksStore((s) => s.setStormiAutoWelcomeCandidateDone)
  const isStormiContextModalOpen = useHubBlocksStore((s) => s.isStormiContextModalOpen)
  const installedBlocks = useInstalledBlocks()
  const hubContext = useHubContext()
  const stormiAutoWelcomeCandidateDone = useStormiAutoWelcomeCandidateDone()
  const candidateEmptyHub = installedBlocks.every((b) => isCoreBlock(b.blockType))

  return (
    <>
      {isStormiContextModalOpen && <StormiContextModal />}
      <div className='mx-auto w-full max-w-2xl space-y-4'>
        <BackToHubButton onClick={navigateToHub} label='Back to Career Card' />
        <div id='stormi-hub-panel' className='scroll-mt-24'>
          <HubSectionPanel isDark={isDark} accent='violet'>
            <BlockCard
              variant='embed'
              icon={LifeBuoy}
              title='Help'
              description="Ask anything about your DQ file — what a form means, what a carrier needs, or what to do next."
            >
              <StormiChatPanel
                mode='candidate'
                sessionUserId={sessionUserId}
                hubContext={hubContext}
                candidateEmptyHub={candidateEmptyHub}
                stormiAutoWelcomeCandidateDone={stormiAutoWelcomeCandidateDone}
                onStormiAutoWelcomeSynced={() => {
                  setStormiAutoWelcomeCandidateDone(true)
                  if (sessionUserId) void fetchHubData(sessionUserId)
                }}
                hubEmbedSurface
              />
            </BlockCard>
          </HubSectionPanel>
        </div>
      </div>
    </>
  )
}
