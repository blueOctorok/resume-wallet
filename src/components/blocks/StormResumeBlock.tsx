'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * STORM Resume — one shell for upload + career-path guided builders.
 * Add new career tabs by extending `CAREER_TABS` and the panel switch below.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from '@/contexts/ThemeContext'
import { Upload, Briefcase, Truck, Code2, Sparkles } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import BlockCard, { type BlockStatus } from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
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

const CAREER_TABS: { id: Exclude<StormResumePanel, 'upload'>; label: string; Icon: typeof Briefcase }[] = [
  /** "General" = universal / non-CDL / non-dev resume — not a tier above Driver or Developer */
  { id: 'general', label: 'General', Icon: Briefcase },
  { id: 'driver', label: 'Driver', Icon: Truck },
  { id: 'developer', label: 'Developer', Icon: Code2 },
]

function readInitialPanelFromStore(): StormResumePanel {
  const p = useUIStore.getState().stormResumeInitialPanel
  if (p === 'upload' || p === 'general' || p === 'driver' || p === 'developer') return p
  return 'general'
}

interface StormResumeBlockProps {
  user?: { address?: string } | null
  onBack: () => void
}

export default function StormResumeBlock({ user, onBack }: StormResumeBlockProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const resumes = useResumes()
  const blockStatus: BlockStatus = resumes.length > 0 ? 'complete' : 'empty'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const userAddress = (user?.address ?? walletAddress ?? '').trim() || undefined
  const editingResumeId = useUIStore((s) => s.editingResumeId)
  const setEditingResumeId = useUIStore((s) => s.setEditingResumeId)
  const setStormResumeInitialPanel = useUIStore((s) => s.setStormResumeInitialPanel)

  const [panel, setPanel] = useState<StormResumePanel>(() => readInitialPanelFromStore())
  const didMountClearInitial = useRef(false)

  useEffect(() => {
    if (didMountClearInitial.current) return
    didMountClearInitial.current = true
    setStormResumeInitialPanel(null)
  }, [setStormResumeInitialPanel])

  const afterHubMutation = useCallback(async () => {
    const wa = useAuthStore.getState().walletAddress
    if (wa) await syncDriverHubFromApi(wa)
  }, [])

  const selectPanel = useCallback(
    (next: StormResumePanel) => {
      if (next !== panel) setEditingResumeId(undefined)
      setPanel(next)
    },
    [panel, setEditingResumeId],
  )

  return (
    <div className='max-w-4xl mx-auto space-y-6 px-2 sm:px-0'>
      <BackToHubButton onClick={onBack} />

      <HubSectionPanel isDark={isDark} accent='teal'>
        <BlockCard
          variant='embed'
          icon={Sparkles}
          title='STORM Resume'
          description='Upload a file or build for General, Driver, or Developer roles'
          status={blockStatus}
        >
        <div className='flex flex-wrap gap-1.5 p-1 rounded-xl border border-slate-300/90 dark:border-gray-700/50 bg-slate-50/90 dark:bg-gray-900/40 -mt-1 mb-4 sm:mb-5'>
          <Button
            type='button'
            variant={panel === 'upload' ? 'primary' : 'ghost'}
            size='sm'
            className='flex-1 min-w-[5.5rem] sm:flex-none'
            onClick={() => selectPanel('upload')}
          >
            <Upload className='w-4 h-4 shrink-0 sm:mr-1.5' />
            <span className='hidden sm:inline'>Upload</span>
          </Button>
          {CAREER_TABS.map(({ id, label, Icon }) => (
            <Button
              key={id}
              type='button'
              variant={panel === id ? 'primary' : 'ghost'}
              size='sm'
              className='flex-1 min-w-[5.5rem] sm:flex-none'
              onClick={() => selectPanel(id)}
            >
              <Icon className='w-4 h-4 shrink-0 sm:mr-1.5' />
              <span className='hidden sm:inline'>{label}</span>
            </Button>
          ))}
        </div>

        {panel === 'upload' && (
          <ResumeUploadWithVerification
            user={user}
            embedInParent
            onUploadComplete={() => {
              void afterHubMutation()
            }}
          />
        )}

        {panel === 'driver' && (
          <div className='-mx-5 -mb-6 sm:-mx-6 sm:-mb-7 overflow-hidden border-t border-slate-200/80 dark:border-gray-700/50'>
            <ResumeBuilder
              user={user}
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
