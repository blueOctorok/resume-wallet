'use client'

import { MapPin, Calendar, Mail, Phone, Eye, Plus, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import VaultHorizontalVaultShell from '@/components/ui/VaultHorizontalVaultShell'
import type { ProjectedCareerCard as CardData, CareerCardMode, CareerCardSection, SectionBlockType } from '@/types/career-card'
import type { ResumeData, DotAppData, MvrData, CdlData, PortfolioData, GitHubData, ProjectsData } from '@/types/career-card'

import {
  ResumeSection,
  DotAppSection,
  MvrSection,
  CdlSection,
  PortfolioSection,
  GitHubSection,
  ProjectsSection,
} from './sections'

interface ProjectedCareerCardProps {
  data: CardData
  mode: CareerCardMode
  /** Navigate to a block's page (self mode only) */
  onNavigateToBlock?: (blockType: string) => void
  /** Open the block picker to add missing blocks (self mode only) */
  onAddBlock?: () => void
  /** Connect action (public mode) */
  onConnect?: () => void
  /** Used by DotAppSection to fetch the full DOT preview (self mode only) */
  walletAddress?: string
}

/**
 * ProjectedCareerCard — renders the career card dynamically from hub block sections.
 *
 * Instead of role-branching (isDriver / isDeveloper), it iterates over the
 * sections array and renders the appropriate section component for each.
 * Sections are ordered by the user's block arrangement in their hub.
 */
export default function ProjectedCareerCard({
  data,
  mode,
  onNavigateToBlock,
  onAddBlock,
  onConnect,
  walletAddress,
}: ProjectedCareerCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <VaultHorizontalVaultShell isDark={isDark} layout='nav' contentClassName='relative overflow-hidden'>
      {/* ── Profile header (no hero gradient — stays on vault face so block sections read as one surface) ── */}
      <div className='px-6 sm:px-8 pt-6 sm:pt-7 pb-5 relative z-[1]'>
          <div className='flex items-start gap-4'>
            <div
              className={cn(
                'rounded-full p-[2px] shrink-0',
                'bg-teal-500/15 dark:bg-teal-400/10',
                'ring-1 ring-teal-500/35 dark:ring-teal-400/25',
              )}
            >
              <div
                className={cn(
                  'rounded-full overflow-hidden border-[3px]',
                  isDark ? 'border-gray-900/90' : 'border-white',
                )}
              >
                <Avatar name={data.name} avatarUrl={data.avatarUrl} size='2xl' color='teal' round />
              </div>
            </div>
            <div className='flex-1 min-w-0 pt-0.5'>
              <p
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.2em] mb-0.5',
                  isDark ? 'text-teal-300/85' : 'text-teal-800/75',
                )}
              >
                Career card
              </p>
              <h1
                className={cn(
                  'text-xl sm:text-2xl font-bold tracking-tight truncate',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                {data.name}
              </h1>
              {data.occupation && (
                <p className={cn('text-sm font-medium mt-0.5', isDark ? 'text-teal-300' : 'text-teal-700')}>
                  {data.occupation}
                </p>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className='flex flex-wrap gap-4 mt-4'>
            {data.location && (
              <span className={cn('flex items-center gap-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                <MapPin className='w-3 h-3' /> {data.location}
              </span>
            )}
            <span className={cn('flex items-center gap-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
              <Calendar className='w-3 h-3' /> Member since {new Date(data.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            {data.viewCount !== undefined && (
              <span className={cn('flex items-center gap-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                <Eye className='w-3 h-3' /> {data.viewCount} views
              </span>
            )}
          </div>

          {/* Contact info (visible based on settings) */}
          {data.contact && (data.contact.email || data.contact.phone) && (
            <div className='flex flex-wrap gap-4 mt-3'>
              {data.contact.email && (
                <a href={`mailto:${data.contact.email}`}
                  className={cn('flex items-center gap-1 text-xs', isDark ? 'text-gray-400 hover:text-teal-400' : 'text-gray-500 hover:text-teal-600')}>
                  <Mail className='w-3 h-3' /> {data.contact.email}
                </a>
              )}
              {data.contact.phone && (
                <a href={`tel:${data.contact.phone}`}
                  className={cn('flex items-center gap-1 text-xs', isDark ? 'text-gray-400 hover:text-teal-400' : 'text-gray-500 hover:text-teal-600')}>
                  <Phone className='w-3 h-3' /> {data.contact.phone}
                </a>
              )}
            </div>
          )}

          {/* Professional summary */}
          {data.professionalSummary && (
            <p className={cn('text-sm mt-4 leading-relaxed', isDark ? 'text-gray-300' : 'text-gray-700')}>
              {data.professionalSummary}
            </p>
          )}

          {/* Employer-confirmed employment — trust signal for shared / public card */}
          {data.employerConfirmedEmploymentCount > 0 && (
            <div
              className={cn(
                'mt-4 flex items-start gap-3 rounded-xl border px-4 py-3',
                isDark
                  ? 'border-emerald-500/35 bg-emerald-500/[0.08]'
                  : 'border-emerald-200 bg-emerald-50/90',
              )}
            >
              <ShieldCheck
                className={cn('w-5 h-5 flex-shrink-0 mt-0.5', isDark ? 'text-emerald-400' : 'text-emerald-600')}
                aria-hidden
              />
              <div className='min-w-0'>
                <p className={cn('text-sm font-semibold', isDark ? 'text-emerald-100' : 'text-emerald-900')}>
                  {data.employerConfirmedEmploymentCount} employer
                  {data.employerConfirmedEmploymentCount === 1 ? '' : 's'} confirmed employment
                </p>
                <p className={cn('text-xs mt-0.5', isDark ? 'text-emerald-200/80' : 'text-emerald-800/80')}>
                  Past employers verified roles and dates on file.
                </p>
              </div>
            </div>
          )}
      </div>

      {/* ── Dynamic Sections ── */}
      <div className='px-6 sm:px-8 pb-7 space-y-5 relative z-[1]'>
        {data.sections.map((section) => (
          <SectionRenderer
            key={section.blockType}
            section={section}
            mode={mode}
            isDark={isDark}
            userId={data.userId}
            walletAddress={walletAddress}
            shareToken={data.shareToken}
            onAction={mode === 'self' && onNavigateToBlock
              ? () => onNavigateToBlock(section.blockType)
              : undefined
            }
          />
        ))}

        {/* ── Empty state for self mode ── */}
        {mode === 'self' && data.sections.length === 0 && (
          <div
            className={cn(
              'rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center',
              'border-teal-500/25 dark:border-teal-400/20',
              'bg-gradient-to-b from-teal-500/[0.04] to-transparent dark:from-teal-400/[0.06]',
            )}
          >
            <p className={cn('text-sm font-semibold mb-1', isDark ? 'text-white' : 'text-gray-900')}>
              Your career card is empty
            </p>
            <p className={cn('text-xs mb-5 max-w-xs mx-auto', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Add blocks to your hub — they appear here in the order you arrange them.
            </p>
            {onAddBlock && (
              <Button type="button" variant="primary" size="sm" onClick={onAddBlock}>
                <Plus className="w-4 h-4" />
                Add blocks
              </Button>
            )}
          </div>
        )}

        {/* ── Connect CTA (public mode) ── */}
        {mode === 'public' && data.settings.allowConnect && onConnect && (
          <div className='pt-2 text-center'>
            <Button type="button" variant="primary" size="md" onClick={onConnect}>
              Connect with {data.name.split(' ')[0]}
            </Button>
          </div>
        )}
      </div>
    </VaultHorizontalVaultShell>
  )
}

// ── Section dispatcher ──────────────────────────────────────────────────────

function SectionRenderer({
  section,
  mode,
  isDark,
  onAction,
  userId,
  walletAddress,
  shareToken,
}: {
  section: CareerCardSection
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
  userId?: string
  walletAddress?: string
  shareToken?: string | null
}) {
  switch (section.blockType as SectionBlockType) {
    case 'driver-resume':
    case 'developer-resume':
    case 'general-resume':
      return (
        <ResumeSection
          data={section.data as ResumeData}
          mode={mode}
          isDark={isDark}
          onAction={onAction}
          walletAddress={walletAddress}
        />
      )
    case 'driver-dot-application':
      return (
        <DotAppSection
          data={section.data as DotAppData}
          mode={mode}
          isDark={isDark}
          onAction={onAction}
          userId={userId}
          walletAddress={walletAddress}
        />
      )
    case 'driver-mvr':
      return (
        <MvrSection
          data={section.data as MvrData}
          mode={mode}
          isDark={isDark}
          walletAddress={walletAddress}
          onNavigateToOrder={mode === 'self' && onAction ? onAction : undefined}
        />
      )
    case 'driver-cdl-credentials':
      return <CdlSection data={section.data as CdlData} mode={mode} isDark={isDark} />
    case 'developer-portfolio':
      return <PortfolioSection data={section.data as PortfolioData} mode={mode} isDark={isDark} onAction={onAction} />
    case 'developer-github':
      return <GitHubSection data={section.data as GitHubData} mode={mode} isDark={isDark} shareToken={shareToken} walletAddress={walletAddress} />
    case 'developer-projects':
      return <ProjectsSection data={section.data as ProjectsData} mode={mode} isDark={isDark} />
    default:
      return null
  }
}
