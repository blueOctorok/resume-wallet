'use client'

import { useAuthStore, useUIStore } from '@/stores'
import BackToHubButton from '@/components/ui/BackToHubButton'
import ErrorBoundary from '@/components/app/ErrorBoundary'
import CandidateEmploymentVerificationSection from '@/components/verification/CandidateEmploymentVerificationSection'

/**
 * Optional hub block: voluntary date confirmation emails to past employers.
 * Work history is merged from driver/DOT employment, developer profile, and general resume.
 */
export default function EmploymentVerificationBlock() {
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const navigateToHub = useUIStore((s) => s.navigateToHub)

  return (
    <div className='max-w-3xl mx-auto space-y-6 px-4 py-6'>
      <div className='flex items-center gap-3'>
        <BackToHubButton onClick={() => navigateToHub()} />
      </div>
      <ErrorBoundary section='Employment verification'>
        <CandidateEmploymentVerificationSection userAddress={sessionUserId} />
      </ErrorBoundary>
    </div>
  )
}
