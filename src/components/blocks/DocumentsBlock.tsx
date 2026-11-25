'use client'

import BackToHubButton from '@/components/ui/BackToHubButton'
import DocumentsSection from '@/components/career-card/sections/DocumentsSection'

/**
 * Same upload area as the career card section, for the documents page.
 * Employers see the files on the card after they have this driver.
 */
export default function DocumentsBlock({ onBack }: { onBack: () => void }) {
  return (
    <div className='mx-auto max-w-2xl'>
      <BackToHubButton onClick={onBack} />
      <DocumentsSection data={{ files: [] }} mode='self' isDark={false} paper />
    </div>
  )
}
