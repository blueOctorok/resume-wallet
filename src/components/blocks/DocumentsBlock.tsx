'use client'

import { Files } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import BlockCard from '@/components/ui/BlockCard'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import DocumentsSection from '@/components/career-card/sections/DocumentsSection'
import { useTheme } from '@/contexts/ThemeContext'
import { getBlockDefinition } from '@/lib/block-registry'

const def = getBlockDefinition('driver-documents')

/**
 * Same upload area as the career card section, for the documents page.
 * Employers see the files on the card after they have this driver.
 */
export default function DocumentsBlock({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className='mx-auto max-w-2xl'>
      <BackToHubButton onClick={onBack} />
      <HubSectionPanel isDark={isDark} accent='teal'>
        <BlockCard
          variant='embed'
          icon={Files}
          title={def?.label ?? 'Documents'}
          description={def?.description ?? 'PDFs and photos an employer you are working with can open'}
        >
          <DocumentsSection data={{ files: [] }} mode='self' isDark={isDark} />
        </BlockCard>
      </HubSectionPanel>
    </div>
  )
}
