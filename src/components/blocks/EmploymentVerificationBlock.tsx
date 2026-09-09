'use client'

import { ShieldCheck } from 'lucide-react'
import { useAuthStore, useUIStore } from '@/stores'
import { useEmploymentVerificationBlockStore } from '@/stores/employment-verification-block-store'
import { isDkimVerifiedRequest } from '@/lib/candidate-employment-verification'
import { getBlockDefinition } from '@/lib/block-registry'
import BackToHubButton from '@/components/ui/BackToHubButton'
import BlockCard from '@/components/ui/BlockCard'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import ErrorBoundary from '@/components/app/ErrorBoundary'
import CandidateEmploymentVerificationSection from '@/components/verification/CandidateEmploymentVerificationSection'

/**
 * Two pages per employer: authorization, then Safety Performance History.
 * Page 1 prefills from DOT (self-reported). Page 2 verifies only via DKIM.
 */
export default function EmploymentVerificationBlock() {
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const navigateToHub = useUIStore((s) => s.navigateToHub)
  const employments = useEmploymentVerificationBlockStore((s) => s.employments)
  const requests = useEmploymentVerificationBlockStore((s) => s.requests)
  const def = getBlockDefinition('general-employment-verification')
  const verified = requests.some((r) => isDkimVerifiedRequest(r))
  const pending = requests.some(
    (r) => r.status === 'VERIFICATION_REQUESTED' || r.status === 'VERIFICATION_IN_PROGRESS',
  )
  const status = verified ? 'complete' : pending || employments.length > 0 ? 'in-progress' : 'empty'

  return (
    <div className='mx-auto max-w-4xl space-y-4 px-4 py-6'>
      <BackToHubButton onClick={() => navigateToHub()} />
      <HubSectionPanel isDark={false} accent='teal'>
        <BlockCard
          variant='embed'
          paper
          icon={ShieldCheck}
          title={def?.label ?? 'Employment Verification'}
          description={
            def?.description ??
            'Sign an authorization, send the safety-performance packet, then review before sharing.'
          }
          status={status}
        >
          <ErrorBoundary section='Employment verification'>
            <CandidateEmploymentVerificationSection
              userAddress={sessionUserId}
              embedded
            />
          </ErrorBoundary>
        </BlockCard>
      </HubSectionPanel>
    </div>
  )
}
