'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import Image from 'next/image'
import { cn } from '@/lib/utils'
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
 * Stormi / Ask AI — formerly the hub right rail.
 * Reachable from My Hub → Ask AI.
 */
export default function CandidateAskAiPage() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

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
        <BackToHubButton onClick={() => setCurrentPage('hub')} />
        <div id='stormi-hub-panel' className='scroll-mt-24'>
          <HubSectionPanel isDark={isDark} accent='violet'>
            <BlockCard
              variant='embed'
              headerIconSlot={
                <Image
                  src='/ava-robot.png'
                  alt=''
                  width={36}
                  height={36}
                  className={cn('object-contain', !isDark && 'invert')}
                />
              }
              title='Ask AI'
              description='Ranked jobs, interview practice, and talking points from your Career Card — you choose every apply.'
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
