'use client'

/**
 * Composable hub entry for the developer-resume block.
 * Wraps DeveloperResumeBuilder (SWE-focused flow) — separate from driver ResumeBuilder.
 */
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import { useAuthStore } from '@/stores'

const DeveloperResumeBuilder = dynamic(
  () => import('@/components/DeveloperResumeBuilder'),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading developer resume…' fullScreen={false} />,
  },
)

interface DeveloperResumeBlockProps {
  user?: { address?: string } | null
  onBack: () => void
  existingResumeId?: string
  onSave?: () => void
}

export default function DeveloperResumeBlock({
  user,
  onBack,
  existingResumeId,
  onSave,
}: DeveloperResumeBlockProps) {
  const walletAddress = useAuthStore((s) => s.walletAddress)
  // Match ResumeBuilder: Alchemy `user.address` can lag behind the wallet store
  const userAddress = (user?.address ?? walletAddress ?? '').trim() || undefined

  return (
    <div className='max-w-4xl mx-auto space-y-6'>
      <DeveloperResumeBuilder
        userAddress={userAddress}
        onBack={onBack}
        existingResumeId={existingResumeId}
        onSave={onSave ? () => onSave() : undefined}
      />
    </div>
  )
}
