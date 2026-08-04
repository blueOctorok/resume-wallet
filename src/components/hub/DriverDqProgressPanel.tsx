'use client'

import { ClipboardList } from 'lucide-react'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import DqFileSection from '@/components/employer/dq/DqFileSection'
import { useDriverHubStore } from '@/stores/driver-hub-store'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Driver-side mirror of the employer DQ checklist.
 * Same item registry — driver lens (owned artifacts + pending requests).
 * Only shows when the candidate has at least one driver-* block installed.
 */
export default function DriverDqProgressPanel() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const dqFile = useDriverHubStore((s) => s.dqFile)
  const installedBlocks = useHubBlocksStore((s) => s.installedBlocks)
  const hasDriverBlocks = installedBlocks.some((b) => b.blockType.startsWith('driver-'))

  if (!hasDriverBlocks || !dqFile) return null

  return (
    <HubSectionPanel isDark={isDark} accent="teal">
      <BlockCard
        variant="embed"
        icon={ClipboardList}
        title="Your DQ progress"
        description="Same checklist employers see. MVR and PSP stay on your file for every employer."
      >
        <DqFileSection
          dqFile={dqFile}
          embedded
          title="Your DQ progress"
          description="Your portable DQ progress — screenings travel with you."
        />
      </BlockCard>
    </HubSectionPanel>
  )
}
