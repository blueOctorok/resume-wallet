'use client'

/**
 * Composable hub entry for general-resume — universal Indeed-style resume block.
 */
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import { useAuthStore } from '@/stores'

const GeneralResumeBuilder = dynamic(
  () => import('@/components/GeneralResumeBuilder'),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading resume builder…' fullScreen={false} />,
  },
)

interface GeneralResumeBlockProps {
  user?: { address?: string } | null
  onBack: () => void
  existingResumeId?: string
  onSave?: () => void
}

export default function GeneralResumeBlock({
  user,
  onBack,
  existingResumeId,
  onSave,
}: GeneralResumeBlockProps) {
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const userAddress = (sessionUserId ?? sessionUserId ?? '').trim() || undefined

  return (
    <div className='max-w-4xl mx-auto space-y-6'>
      <GeneralResumeBuilder
        userAddress={userAddress}
        onBack={onBack}
        existingResumeId={existingResumeId}
        onSave={onSave ? () => onSave() : undefined}
      />
    </div>
  )
}
