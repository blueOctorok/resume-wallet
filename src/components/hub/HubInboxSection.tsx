'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, type ReactNode } from 'react'
import { Inbox, Bell, Building2, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useUIStore } from '@/stores'
import type { PageType } from '@/stores/types'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import JobAlertsHubSection from '@/components/hub/JobAlertsHubSection'
import CandidateRequestsSection from '@/components/CandidateRequestsSection'

type InboxTab = 'alerts' | 'requests' | 'applications'

export interface HubInboxSectionProps {
  sessionUserId: string | null
  onNavigateToResume: (targetBlockType: string | null) => void
  onNavigateToDotApp: () => void
}

function TabButton({
  active,
  onClick,
  children,
  isDark,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  isDark: boolean
}) {
  return (
    <Button
      type='button'
      variant={active ? 'primary' : 'secondary'}
      size='sm'
      className={cn(
        'shrink-0 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm',
        !active &&
          isDark &&
          'border-amber-400/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15',
        !active && !isDark && 'border-amber-200/80 bg-amber-50/80 text-amber-900 hover:bg-amber-100',
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/**
 * Tabbed inbox: job alerts, employer requests, and a shortcut to applications.
 * Child sections keep their own vault chrome; this wrapper only supplies the tab rail.
 */
export default function HubInboxSection({
  sessionUserId,
  onNavigateToResume,
  onNavigateToDotApp,
}: HubInboxSectionProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const [tab, setTab] = useState<InboxTab>('alerts')

  return (
    <HubSectionPanel isDark={isDark} accent='amber'>
      <BlockCard
        variant='embed'
        icon={Inbox}
        title='Inbox'
        description='Job alerts, employer outreach, and your applications.'
        headerActions={
          <div className='flex flex-wrap items-center justify-end gap-1.5 sm:gap-2'>
            <TabButton active={tab === 'alerts'} onClick={() => setTab('alerts')} isDark={isDark}>
              <span className='inline-flex items-center gap-1'>
                <Bell className='h-3.5 w-3.5 shrink-0' />
                <span className='hidden sm:inline'>Alerts</span>
              </span>
            </TabButton>
            <TabButton active={tab === 'requests'} onClick={() => setTab('requests')} isDark={isDark}>
              <span className='inline-flex items-center gap-1'>
                <Building2 className='h-3.5 w-3.5 shrink-0' />
                <span className='hidden sm:inline'>Requests</span>
              </span>
            </TabButton>
            <TabButton active={tab === 'applications'} onClick={() => setTab('applications')} isDark={isDark}>
              <span className='inline-flex items-center gap-1'>
                <Briefcase className='h-3.5 w-3.5 shrink-0' />
                <span className='hidden sm:inline'>Applications</span>
              </span>
            </TabButton>
          </div>
        }
      >
        <div className='min-h-0 min-w-0'>
          {tab === 'alerts' ? <JobAlertsHubSection embedded /> : null}
          {tab === 'requests' && sessionUserId ? (
            <CandidateRequestsSection
              userAddress={sessionUserId}
              onNavigateToResume={onNavigateToResume}
              onNavigateToDotApp={onNavigateToDotApp}
            />
          ) : null}
          {tab === 'requests' && !sessionUserId ? (
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>Sign in to see employer requests.</p>
          ) : null}
          {tab === 'applications' ? (
            <div
              className={cn(
                'rounded-xl border p-4 sm:p-5',
                isDark ? 'border-gray-700/60 bg-gray-800/40' : 'border-slate-200 bg-slate-50/90',
              )}
            >
              <p className={cn('text-sm', isDark ? 'text-gray-300' : 'text-slate-700')}>
                Track applications you&apos;ve submitted to ZKnight employers and follow up from one place.
              </p>
              <Button
                type='button'
                variant='primary'
                size='sm'
                className='mt-4'
                onClick={() => setCurrentPage('applications' as PageType)}
              >
                <Briefcase className='mr-1.5 h-3.5 w-3.5' />
                Open applications
              </Button>
            </div>
          ) : null}
        </div>
      </BlockCard>
    </HubSectionPanel>
  )
}
