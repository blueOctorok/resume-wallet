'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * Resume page. Upload is the driver entry. Builder panels stay only when an
 * existing resume's Edit action asks for one.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from '@/contexts/ThemeContext'
import { Sparkles } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import BlockCard, { type BlockStatus } from '@/components/ui/BlockCard'
import LoadingScreen from '@/components/LoadingScreen'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import ResumeUploadWithVerification from '@/components/ResumeUploadWithVerification'
import { useAuthStore, useResumes, useUIStore } from '@/stores'
import type { StormResumePanel } from '@/stores/ui-store'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'

const ResumeBuilder = dynamic(() => import('@/components/ResumeBuilder'), {
  ssr: false,
  loading: () => <LoadingScreen message='Loading driver resume…' fullScreen={false} />,
})

const GeneralResumeBuilder = dynamic(() => import('@/components/GeneralResumeBuilder'), {
  ssr: false,
  loading: () => <LoadingScreen message='Loading resume builder…' fullScreen={false} />,
})

const DeveloperResumeBuilder = dynamic(() => import('@/components/DeveloperResumeBuilder'), {
  ssr: false,
  loading: () => <LoadingScreen message='Loading developer resume…' fullScreen={false} />,
})

function readInitialPanelFromStore(): StormResumePanel {
  const p = useUIStore.getState().stormResumeInitialPanel
  if (p === 'upload' || p === 'general' || p === 'driver' || p === 'developer') return p
  return 'upload'
}

interface StormResumeBlockProps {
  onBack: () => void
}

export default function StormResumeBlock({ onBack }: StormResumeBlockProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const resumes = useResumes()
  const blockStatus: BlockStatus = resumes.length > 0 ? 'complete' : 'empty'
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const userAddress = (sessionUserId ?? sessionUserId ?? '').trim() || undefined
  const editingResumeId = useUIStore((s) => s.editingResumeId)
  const setStormResumeInitialPanel = useUIStore((s) => s.setStormResumeInitialPanel)

  const [panel] = useState<StormResumePanel>(() => readInitialPanelFromStore())
  const didMountClearInitial = useRef(false)

  useEffect(() => {
    if (didMountClearInitial.current) return
    didMountClearInitial.current = true
    setStormResumeInitialPanel(null)
  }, [setStormResumeInitialPanel])

  const afterHubMutation = useCallback(async () => {
    const wa = useAuthStore.getState().sessionUserId
    if (wa) await syncDriverHubFromApi(wa)
  }, [])

  return (
    <div className='max-w-4xl mx-auto space-y-6 px-2 sm:px-0'>
      <BackToHubButton onClick={onBack} />

      <HubSectionPanel isDark={isDark} accent='teal'>
        <BlockCard
          variant='embed'
          icon={Sparkles}
          title='Resume'
          description='Upload a PDF. Your Provven resume is generated from your license, MVR, and DOT application.'
          status={blockStatus}
        >
        {panel === 'upload' && (
          <ResumeUploadWithVerification
            embedInParent
            onUploadComplete={() => {
              void afterHubMutation()
            }}
          />
        )}

        {panel === 'driver' && (
          <div className='-mx-5 -mb-6 sm:-mx-6 sm:-mb-7 overflow-hidden border-t border-slate-200/80 dark:border-gray-700/50'>
            <ResumeBuilder
              onBack={onBack}
              existingResumeId={editingResumeId}
              hideHubBackButton
              onSave={() => {
                void afterHubMutation()
              }}
            />
          </div>
        )}

        {panel === 'general' && (
          <GeneralResumeBuilder
            userAddress={userAddress}
            onBack={onBack}
            existingResumeId={editingResumeId}
            hideHubBackButton
            onSave={() => {
              void afterHubMutation()
            }}
          />
        )}

        {panel === 'developer' && (
          <div className='-mx-5 -mb-6 sm:-mx-6 sm:-mb-7 overflow-hidden border-t border-slate-200/80 dark:border-gray-700/50'>
            <DeveloperResumeBuilder
              userAddress={userAddress}
              onBack={onBack}
              existingResumeId={editingResumeId}
              hideHubBackButton
              onSave={() => {
                void afterHubMutation()
              }}
            />
          </div>
        )}
        </BlockCard>
      </HubSectionPanel>
    </div>
  )
}
