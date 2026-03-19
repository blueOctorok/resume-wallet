'use client'

import { MapPin, Calendar, Mail, Phone, Eye, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Avatar from '@/components/ui/Avatar'
import type { ProjectedCareerCard as CardData, CareerCardMode, CareerCardSection, SectionBlockType } from '@/types/career-card'
import type { ResumeData, DotAppData, MvrData, CdlData, PortfolioData, GitHubData, ProjectsData, SkillsData, WorkHistoryData } from '@/types/career-card'

import {
  ResumeSection,
  DotAppSection,
  MvrSection,
  CdlSection,
  PortfolioSection,
  GitHubSection,
  ProjectsSection,
  SkillsSection,
  WorkHistorySection,
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

  // Neumorphic shadow: dark shadow (bottom-right) + light shadow (top-left)
  // creates a "raised from the surface" 3D illusion via pure CSS.
  const cardShadow = isDark
    ? '20px 20px 60px #0d1117, -20px -20px 60px #374151'
    : '20px 20px 60px #bebebe, -20px -20px 60px #ffffff'

  return (
    <div
      className={cn(
        'max-w-2xl mx-auto rounded-[2.5rem] overflow-hidden',
        isDark ? 'bg-gray-800' : 'bg-[#e0e0e0]'
      )}
      style={{ boxShadow: cardShadow }}
    >
      {/* ── Profile Header ── */}
      <div>
        <div className={cn(
          'h-20',
          isDark
            ? 'bg-gradient-to-r from-teal-900/40 to-gray-700'
            : 'bg-gradient-to-r from-teal-100 to-gray-200'
        )} />
        <div className='px-6 pb-5 -mt-10'>
          <div className='flex items-end gap-4'>
            <div className={cn(
              'rounded-full border-4',
              isDark ? 'border-gray-800' : 'border-white'
            )}>
              <Avatar
                name={data.name}
                avatarUrl={data.avatarUrl}
                size='xl'
                color='teal'
              />
            </div>
            <div className='flex-1 min-w-0 pb-1'>
              <h1 className={cn('text-xl font-bold truncate', isDark ? 'text-white' : 'text-gray-900')}>
                {data.name}
              </h1>
              {data.occupation && (
                <p className={cn('text-sm', isDark ? 'text-teal-400' : 'text-teal-600')}>
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
        </div>
      </div>

      {/* ── Dynamic Sections ── */}
      <div className='px-6 pb-6 space-y-5'>
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
          <div className={cn(
            'rounded-xl border-2 border-dashed p-8 text-center',
            isDark ? 'border-gray-600' : 'border-gray-400/50'
          )}>
            <p className={cn('text-sm mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Your career card is empty
            </p>
            <p className={cn('text-xs mb-4', isDark ? 'text-gray-500' : 'text-gray-500')}>
              Add blocks to your hub to build your professional profile
            </p>
            {onAddBlock && (
              <button
                onClick={onAddBlock}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isDark
                    ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
                    : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                )}
              >
                <Plus className='w-4 h-4' /> Add Blocks
              </button>
            )}
          </div>
        )}

        {/* ── Connect CTA (public mode) ── */}
        {mode === 'public' && data.settings.allowConnect && onConnect && (
          <div className='pt-4 text-center'>
            <button
              onClick={onConnect}
              className='px-6 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors'
            >
              Connect with {data.name.split(' ')[0]}
            </button>
          </div>
        )}
      </div>
    </div>
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
      return <ResumeSection data={section.data as ResumeData} mode={mode} isDark={isDark} onAction={onAction} />
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
      return <GitHubSection data={section.data as GitHubData} mode={mode} isDark={isDark} shareToken={shareToken} />
    case 'developer-projects':
      return <ProjectsSection data={section.data as ProjectsData} mode={mode} isDark={isDark} />
    case 'general-skills':
      return <SkillsSection data={section.data as SkillsData} mode={mode} isDark={isDark} />
    case 'general-work-history':
      return <WorkHistorySection data={section.data as WorkHistoryData} mode={mode} isDark={isDark} />
    default:
      return null
  }
}
