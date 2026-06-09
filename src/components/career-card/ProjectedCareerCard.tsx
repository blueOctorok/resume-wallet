'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { MapPin, Calendar, Mail, Phone, Eye, Plus, ShieldCheck, Lock, ExternalLink, FileWarning } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Avatar from '@/components/ui/Avatar'
import AvatarUpload from '@/components/ui/AvatarUpload'
import Button from '@/components/ui/Button'
import VaultHorizontalVaultShell from '@/components/ui/VaultHorizontalVaultShell'
import type {
  ProjectedCareerCard as CardData,
  CareerCardMode,
  CareerCardSection,
  SectionBlockType,
} from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import type { HubDocumentsHandle } from '@/hooks/use-hub-documents'
import CareerCardDynamicSections from '@/components/career-card/CareerCardDynamicSections'
import type { ResumeData, DotAppData, MvrData, PspData, CdlData, PortfolioData, GitHubData, ProjectsData, ScreeningConsentData } from '@/types/career-card'

import { Sparkles } from 'lucide-react'
import {
  ResumeSection,
  DotAppSection,
  MvrSection,
  PspSection,
  CdlSection,
  PortfolioSection,
  GitHubSection,
  ProjectsSection,
  ScreeningConsentSection,
} from './sections'

/**
 * GhostSection — a placeholder for content the card *doesn't* have yet but
 * the selected job needs. Rendered after the real sections in `self` mode
 * with a dimmed outline and a Stormi-flavored CTA.
 */
export interface GhostSection {
  blockId: string
  label: string
  /** e.g. "Add work history — 2 min" */
  ctaLabel: string
  /** Optional one-liner explaining why this matters for the selected job */
  reason?: string
}

const BASE_SEPOLIA_TX = 'https://sepolia.basescan.org/tx'
const MAX_TRUST_STRIP_ITEMS = 3

function formatTrustDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Claimed job dates on the employment verification strip */
function formatClaimedJobRange(start: string, end: string | null): string {
  const s = start ? formatTrustDate(start) : '—'
  const e = end ? formatTrustDate(end) : 'Present'
  return `${s}–${e}`
}

function CareerCardStrengthRing({ score, isDark }: { score: number; isDark: boolean }) {
  const r = 17
  const circumference = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score))
  const offset = circumference - (pct / 100) * circumference
  return (
    <div className='relative w-[52px] h-[52px] shrink-0' aria-hidden>
      <svg width='52' height='52' viewBox='0 0 52 52' className={cn('rotate-[-90deg]', isDark ? 'text-gray-700' : 'text-gray-200')}>
        <circle cx='26' cy='26' r={r} fill='none' stroke='currentColor' strokeWidth='5' />
        <circle
          cx='26'
          cy='26'
          r={r}
          fill='none'
          className={isDark ? 'text-teal-400' : 'text-teal-600'}
          stroke='currentColor'
          strokeWidth='5'
          strokeLinecap='round'
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-[11px] font-bold',
          isDark ? 'text-white' : 'text-gray-900',
        )}
      >
        {pct}
      </span>
    </div>
  )
}

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
  sessionUserId?: string
  /** Employer talent modal: recruit / messaging row below sections */
  footerSlot?: ReactNode
  /**
   * Simple-mode "glowing gaps" — sections the card is missing but the
   * currently-selected job needs. Self mode only; ignored for public/employer.
   */
  ghostSections?: GhostSection[]
  /** Click handler for a ghost section's CTA. Falls back to onNavigateToBlock. */
  onGhostAction?: (blockId: string) => void
  /**
   * Block ids that just got installed — applies the `animate-card-settle`
   * keyframe to their freshly-rendered section so the user gets a moment of
   * visual confirmation. Self mode only.
   */
  recentlyInstalledBlockIds?: string[]
  /**
   * Career Card Lenses — subtle "Full profile · switch" chip in the header
   * top-right when the card is in self mode and the user has at least one
   * non-default lens. Clicking `switch` fires `onOpenLensPicker`. Entirely
   * presentational — this component does not fetch or mutate lenses.
   */
  activeLensName?: string | null
  showLensChip?: boolean
  onOpenLensPicker?: () => void
  /**
   * Ephemeral "Switched to X · undo" note shown in place of the chip for a
   * few seconds after Stormi auto-switches lenses. When set, `onUndoLensSwitch`
   * is the undo handler.
   */
  lensSwitchNote?: { toName: string } | null
  onUndoLensSwitch?: () => void
  /** Self mode: pinned top-right inside the vault header (e.g. Share + Edit). Sits above the lens chip when both exist. */
  selfHeaderActions?: ReactNode
  /**
   * Self mode: extra header content placed BELOW `selfHeaderActions` in the
   * top-right column. Used by Construct for the "Use this card to apply" CTA
   * so it shows up under Share / Edit without crowding the icon row.
   */
  selfHeaderActionsBelow?: ReactNode
  /** Self mode + wallet: after POST /api/user/avatar — parent refetches card / syncs hub store */
  onAvatarUploadSuccess?: (url: string) => void
  /**
   * Apply mode: only resume sections receive `onAction` (navigate to resume builder).
   * Other blocks are read-only until the user switches to Construct mode.
   */
  selfSectionNav?: 'resume-only' | 'all'
  /** Construct mode: hub document hook for inline verify / delete / preview */
  hubDocuments?: HubDocumentsHandle
  /** After reorder / card page patch — parent refetches projected card */
  onCardMutation?: () => void
  /** Employer talent modal: open full MVR the company purchased for this candidate */
  onEmployerViewCompanyMvr?: () => void
  /** Employer talent modal: open full PSP the company purchased for this candidate */
  onEmployerViewCompanyPsp?: () => void
  /**
   * When true (employer modal with CredentialFactsPanel), MVR/PSP company panels
   * collapse to document fallbacks — facts panel carries the trust signal.
   */
  demoteEmployerScreeningDetails?: boolean
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
  sessionUserId,
  footerSlot,
  ghostSections,
  onGhostAction,
  recentlyInstalledBlockIds,
  activeLensName,
  showLensChip = false,
  onOpenLensPicker,
  lensSwitchNote,
  onUndoLensSwitch,
  selfHeaderActions,
  selfHeaderActionsBelow,
  onAvatarUploadSuccess,
  selfSectionNav = 'all',
  hubDocuments,
  onCardMutation,
  onEmployerViewCompanyMvr,
  onEmployerViewCompanyPsp,
  demoteEmployerScreeningDetails = false,
}: ProjectedCareerCardProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const onChainList = data.onChainCredentials ?? []
  const onChainCount = data.onChainCredentialCount ?? onChainList.length
  const employerList = data.employerConfirmations ?? []
  const employerCount = data.employerConfirmedEmploymentCount ?? employerList.length

  const employerScreeningReady = (s: string | undefined) => {
    const v = String(s || '').toLowerCase()
    return v === 'completed' || v === 'needs_review'
  }

  const [showAllOnChain, setShowAllOnChain] = useState(false)
  const [showAllEmployer, setShowAllEmployer] = useState(false)

  const visibleOnChain =
    showAllOnChain || onChainList.length <= MAX_TRUST_STRIP_ITEMS
      ? onChainList
      : onChainList.slice(0, MAX_TRUST_STRIP_ITEMS)
  const visibleEmployer =
    showAllEmployer || employerList.length <= MAX_TRUST_STRIP_ITEMS
      ? employerList
      : employerList.slice(0, MAX_TRUST_STRIP_ITEMS)

  return (
    <VaultHorizontalVaultShell isDark={isDark} layout='nav' contentClassName='relative overflow-hidden'>
      {/* ── Profile header (no hero gradient — stays on vault face so block sections read as one surface) ── */}
      <div className='px-6 sm:px-8 pt-6 sm:pt-7 pb-5 relative z-[1]'>
          {/*
            Lens chip — deliberately subtle. Muted text, only "switch" is a
            link. Not bold, no chevron, no accent — sits in peripheral vision
            for the power users who want it.

            Auto-switch note takes priority when present — same spot, same
            typography, just "Switched to X · undo" for ~5s, then back to the
            regular chip.
          */}
          {(isCareerCardOwnerMode(mode) && (selfHeaderActions || selfHeaderActionsBelow)) ||
          (mode === 'self' && showLensChip && (activeLensName || lensSwitchNote)) ? (
            <div
              className={cn(
                'absolute top-3 right-4 z-[2] flex flex-col items-end gap-1.5 sm:right-6',
                'transition-opacity duration-300',
              )}
            >
              {isCareerCardOwnerMode(mode) && selfHeaderActions ? (
                <div className='flex shrink-0 items-center gap-0.5'>{selfHeaderActions}</div>
              ) : null}
              {isCareerCardOwnerMode(mode) && selfHeaderActionsBelow ? (
                <div className='flex shrink-0 items-center justify-end'>{selfHeaderActionsBelow}</div>
              ) : null}
              {mode === 'self' && showLensChip && (activeLensName || lensSwitchNote) ? (
                <div
                  className={cn(
                    'flex max-w-[min(100vw-5rem,18rem)] items-center gap-1 text-[11px] sm:max-w-[20rem]',
                    isDark ? 'text-gray-500' : 'text-gray-400',
                  )}
                >
                  {lensSwitchNote ? (
                    <>
                      <span className='truncate'>Switched to {lensSwitchNote.toName}</span>
                      <span>·</span>
                      <button
                        type='button'
                        onClick={onUndoLensSwitch}
                        className={cn(
                          'shrink-0 underline underline-offset-2 hover:text-current',
                          isDark ? 'hover:text-gray-300' : 'hover:text-gray-600',
                        )}
                      >
                        undo
                      </button>
                    </>
                  ) : (
                    <>
                      <span className='truncate'>{activeLensName}</span>
                      <span>·</span>
                      <button
                        type='button'
                        onClick={onOpenLensPicker}
                        className={cn(
                          'shrink-0 underline underline-offset-2 hover:text-current',
                          isDark ? 'hover:text-gray-300' : 'hover:text-gray-600',
                        )}
                      >
                        switch
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className='flex items-start gap-4'>
            {isCareerCardOwnerMode(mode) && sessionUserId && onAvatarUploadSuccess ? (
              /* AvatarUpload sits OUTSIDE overflow-hidden so the camera badge isn't clipped */
              <div className='relative shrink-0'>
                <div
                  className={cn(
                    'rounded-full p-[2px]',
                    'bg-teal-500/15 dark:bg-teal-400/10',
                    'ring-1 ring-teal-500/35 dark:ring-teal-400/25',
                  )}
                >
                  <AvatarUpload
                    name={data.name}
                    avatarUrl={data.avatarUrl}
                    size='2xl'
                    color='teal'
                    round
                    uploadEndpoint='/api/user/avatar'
                    sessionUserId={sessionUserId}
                    persistentUploadHint
                    onSuccess={onAvatarUploadSuccess}
                    title='Add or change profile photo'
                  />
                </div>
              </div>
            ) : (
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
            )}
            <div className='flex-1 min-w-0 pt-0.5 flex items-start gap-3'>
              <CareerCardStrengthRing score={data.careerCardScore ?? 0} isDark={isDark} />
              <div className='min-w-0 flex-1'>
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
              <p className={cn('text-[10px] mt-1', isDark ? 'text-gray-500' : 'text-gray-500')}>
                Card strength
              </p>
              </div>
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

          {onChainCount > 0 && (
            <div
              className={cn(
                'mt-4 rounded-xl border px-4 py-3',
                isDark ? 'border-teal-500/30 bg-teal-500/[0.07]' : 'border-teal-200 bg-teal-50/90',
              )}
            >
              <div className='flex items-start gap-2 min-w-0'>
                <ShieldCheck
                  className={cn('w-5 h-5 flex-shrink-0 mt-0.5', isDark ? 'text-teal-400' : 'text-teal-700')}
                  aria-hidden
                />
                <div className='min-w-0 flex-1'>
                  <p className={cn('text-sm font-semibold', isDark ? 'text-teal-100' : 'text-teal-900')}>
                    {onChainCount} credential{onChainCount === 1 ? '' : 's'} verified on-chain
                  </p>
                  <p className={cn('text-[11px] mt-1', isDark ? 'text-teal-200/70' : 'text-teal-800/80')}>
                    Base Sepolia — each row links to the transaction.
                  </p>
                  <ul className='mt-2 space-y-2'>
                    {visibleOnChain.map((c) => (
                      <li
                        key={`${c.blockType}-${c.txHash}`}
                        className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs'
                      >
                        <span className={cn('min-w-0', isDark ? 'text-teal-100/95' : 'text-teal-900')}>
                          <span className='font-medium'>{c.label}</span>
                          <span className={cn('ml-1.5', isDark ? 'text-teal-200/75' : 'text-teal-800/85')}>
                            — {formatTrustDate(c.verifiedAt)}
                          </span>
                        </span>
                        <a
                          href={`${BASE_SEPOLIA_TX}/${c.txHash}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className={cn(
                            'inline-flex items-center gap-1 font-semibold shrink-0',
                            isDark ? 'text-teal-300 hover:text-teal-200' : 'text-teal-700 hover:text-teal-800',
                          )}
                        >
                          View tx <ExternalLink className='w-3 h-3' />
                        </a>
                      </li>
                    ))}
                  </ul>
                  {!showAllOnChain && onChainList.length > MAX_TRUST_STRIP_ITEMS ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className={cn(
                        'mt-2 -ml-2 h-8',
                        isDark ? 'text-teal-300 hover:bg-teal-500/15' : 'text-teal-700 hover:bg-teal-100/80',
                      )}
                      onClick={() => setShowAllOnChain(true)}
                    >
                      Show all ({onChainList.length})
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

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
          {employerCount > 0 && (
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
              <div className='min-w-0 flex-1'>
                <p className={cn('text-sm font-semibold', isDark ? 'text-emerald-100' : 'text-emerald-900')}>
                  {employerCount} employer{employerCount === 1 ? '' : 's'} confirmed employment
                </p>
                <ul className='mt-2 space-y-2'>
                  {visibleEmployer.map((row, i) => (
                    <li
                      key={`${row.companyName}-${row.verifiedAt}-${i}`}
                      className='flex flex-col gap-0.5 text-xs sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3'
                    >
                      <span className={cn('min-w-0', isDark ? 'text-emerald-100/95' : 'text-emerald-900')}>
                        <span className='font-medium'>{row.companyName}</span>
                        <span className={cn('font-normal', isDark ? 'text-emerald-200/85' : 'text-emerald-800/90')}>
                          {' '}
                          — {row.position}{' '}
                          <span className={cn(isDark ? 'text-emerald-200/70' : 'text-emerald-800/75')}>
                            ({formatClaimedJobRange(row.startDate, row.endDate)})
                          </span>
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 font-medium whitespace-nowrap',
                          isDark ? 'text-emerald-300/90' : 'text-emerald-800',
                        )}
                      >
                        Confirmed {formatTrustDate(row.verifiedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
                {!showAllEmployer && employerList.length > MAX_TRUST_STRIP_ITEMS ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className={cn(
                      'mt-2 -ml-2 h-8',
                      isDark ? 'text-emerald-300 hover:bg-emerald-500/15' : 'text-emerald-800 hover:bg-emerald-100/90',
                    )}
                    onClick={() => setShowAllEmployer(true)}
                  >
                    Show all ({employerList.length})
                  </Button>
                ) : null}
              </div>
            </div>
          )}
      </div>

      {/* ── Dynamic Sections ── */}
      <div className='px-6 sm:px-8 pb-7 space-y-5 relative z-[1]'>
        {data.sections.length > 0 ? (
          <CareerCardDynamicSections
            sections={data.sections}
            mode={mode}
            isDark={isDark}
            sessionUserId={sessionUserId}
            onNavigateToBlock={onNavigateToBlock}
            onAddBlock={onAddBlock}
            hubDocuments={hubDocuments}
            selfSectionNav={selfSectionNav}
            recentlyInstalledBlockIds={recentlyInstalledBlockIds}
            onCardMutation={onCardMutation}
            renderSectionInner={(section, allowNav) => (
              <SectionRenderer
                section={section}
                mode={mode}
                isDark={isDark}
                userId={data.userId}
                sessionUserId={sessionUserId}
                shareToken={data.shareToken}
                onAction={
                  allowNav && onNavigateToBlock
                    ? () => {
                        if (
                          section.blockType === 'driver-mvr' &&
                          (section.data as MvrData).pendingEmployerRequest
                        ) {
                          onNavigateToBlock('driver-screening-consent')
                          return
                        }
                        if (
                          section.blockType === 'driver-psp' &&
                          (section.data as PspData).pendingEmployerRequest
                        ) {
                          onNavigateToBlock('driver-screening-consent')
                          return
                        }
                        onNavigateToBlock(section.blockType)
                      }
                    : undefined
                }
              />
            )}
          />
        ) : null}

        {/* ── Ghost sections — Simple mode "glowing gaps" ── */}
        {mode === 'self' && ghostSections && ghostSections.length > 0 && (
          <div className='space-y-3'>
            {ghostSections.map((ghost) => (
              <button
                key={`ghost-${ghost.blockId}`}
                type='button'
                onClick={() =>
                  onGhostAction
                    ? onGhostAction(ghost.blockId)
                    : onNavigateToBlock?.(ghost.blockId)
                }
                className={cn(
                  'w-full text-left rounded-2xl border-2 border-dashed p-4',
                  'transition-all hover:border-solid cursor-pointer',
                  'animate-ghost-pulse',
                  isDark
                    ? 'border-teal-400/30 bg-teal-400/[0.04] hover:bg-teal-400/[0.08]'
                    : 'border-teal-500/30 bg-teal-500/[0.04] hover:bg-teal-500/[0.08]',
                )}
                aria-label={`Add ${ghost.label}`}
              >
                <div className='flex items-start gap-3'>
                  <div
                    className={cn(
                      'shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
                      isDark ? 'bg-teal-500/15 text-teal-300' : 'bg-teal-100 text-teal-700',
                    )}
                  >
                    <Sparkles className='w-4 h-4' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        isDark ? 'text-teal-100' : 'text-teal-900',
                      )}
                    >
                      {ghost.label}
                    </p>
                    {ghost.reason && (
                      <p
                        className={cn(
                          'text-xs mt-0.5',
                          isDark ? 'text-teal-200/75' : 'text-teal-800/85',
                        )}
                      >
                        {ghost.reason}
                      </p>
                    )}
                    <p
                      className={cn(
                        'text-xs mt-1.5 font-semibold inline-flex items-center gap-1',
                        isDark ? 'text-teal-300' : 'text-teal-700',
                      )}
                    >
                      {ghost.ctaLabel} →
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Employer-only: company-paid MVR (never on candidate/public card) */}
        {mode === 'employer' && data.employerCompanyMvr && (
          <div
            className={cn(
              'rounded-xl border p-4',
              isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200',
            )}
          >
            <div className='mb-3 flex flex-wrap items-start justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <Lock className={cn('w-4 h-4', isDark ? 'text-amber-400' : 'text-amber-600')} aria-hidden />
                <div>
                  <h3 className={cn('text-sm font-semibold', isDark ? 'text-amber-200' : 'text-amber-900')}>
                    {demoteEmployerScreeningDetails ? 'MVR report (document fallback)' : 'MVR — private to your company'}
                  </h3>
                  {demoteEmployerScreeningDetails && (
                    <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-500' : 'text-gray-600')}>
                      Full Accio report — use when you need the underlying document.
                    </p>
                  )}
                </div>
              </div>
              {employerScreeningReady(data.employerCompanyMvr.orderStatus) && onEmployerViewCompanyMvr && (
                <Button
                  type='button'
                  variant={demoteEmployerScreeningDetails ? 'ghost' : 'secondary'}
                  size='sm'
                  onClick={onEmployerViewCompanyMvr}
                >
                  <Eye className='mr-1 h-4 w-4' aria-hidden />
                  View full report
                </Button>
              )}
            </div>
            {!demoteEmployerScreeningDetails && (
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm'>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>Status</p>
                  <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    {data.employerCompanyMvr.results?.licenseStatus || 'Pending'}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>Class</p>
                  <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    {data.employerCompanyMvr.results?.licenseClass || '—'}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>Points</p>
                  <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    {data.employerCompanyMvr.results?.totalPoints ?? '—'}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>Violations</p>
                  <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    {data.employerCompanyMvr.results?.violationCount ?? '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'employer' && data.employerCompanyPsp && (
          <div
            className={cn(
              'rounded-xl border p-4',
              isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200',
            )}
          >
            <div className='mb-3 flex flex-wrap items-start justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <FileWarning className={cn('h-4 w-4', isDark ? 'text-amber-400' : 'text-amber-600')} aria-hidden />
                <div>
                  <h3 className={cn('text-sm font-semibold', isDark ? 'text-amber-200' : 'text-amber-900')}>
                    {demoteEmployerScreeningDetails ? 'PSP report (document fallback)' : 'PSP — private to your company'}
                  </h3>
                  {demoteEmployerScreeningDetails && (
                    <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-500' : 'text-gray-600')}>
                      Full FMCSA PSP document — secondary to verified facts above.
                    </p>
                  )}
                </div>
              </div>
              {employerScreeningReady(data.employerCompanyPsp.orderStatus) && onEmployerViewCompanyPsp && (
                <Button
                  type='button'
                  variant={demoteEmployerScreeningDetails ? 'ghost' : 'secondary'}
                  size='sm'
                  onClick={onEmployerViewCompanyPsp}
                >
                  <Eye className='mr-1 h-4 w-4' aria-hidden />
                  View full report
                </Button>
              )}
            </div>
            {!demoteEmployerScreeningDetails && (
              <div className='grid grid-cols-2 gap-3 text-sm sm:grid-cols-3'>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>Order status</p>
                  <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    {data.employerCompanyPsp.orderStatus}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>DL state</p>
                  <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    {data.employerCompanyPsp.licenseState}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>Vendor</p>
                  <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    {data.employerCompanyPsp.resultSummary?.resultStatus ?? 'Pending'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state (self / construct) ── */}
        {(mode === 'self' || mode === 'construct') && data.sections.length === 0 && (
          <div
            className={cn(
              'rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center',
              'border-teal-500/25 dark:border-teal-400/20',
              'bg-gradient-to-b from-teal-500/[0.04] to-transparent dark:from-teal-400/[0.06]',
            )}
          >
            <p className={cn('text-sm font-semibold mb-1', isDark ? 'text-white' : 'text-gray-900')}>
              {selfSectionNav === 'resume-only' ? 'Add credentials in Construct mode' : 'Your career card is ready to build'}
            </p>
            <p className={cn('text-xs mb-5 max-w-xs mx-auto', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {selfSectionNav === 'resume-only'
                ? 'Specialized blocks (DOT, MVR, portfolio, etc.) are added in Construct — your resume stays here in Apply.'
                : 'Add blocks — they appear here in the order you install them. Each block is a capability employers can discover.'}
            </p>
            {onAddBlock && (
              <Button type='button' variant='primary' size='sm' onClick={onAddBlock}>
                <Plus className='w-4 h-4' />
                {selfSectionNav === 'resume-only' ? 'Open Construct mode' : 'Add blocks'}
              </Button>
            )}
          </div>
        )}

        {/* ── Empty state: employer viewing candidate with no hub blocks on card ── */}
        {mode === 'employer' &&
          data.sections.length === 0 &&
          !data.employerCompanyMvr &&
          !data.employerCompanyPsp && (
          <div
            className={cn(
              'rounded-2xl border border-dashed p-8 text-center',
              isDark ? 'border-gray-600/60 bg-gray-800/30 text-gray-400' : 'border-gray-300/80 bg-slate-50/80 text-gray-500',
            )}
          >
            <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
              No career card blocks yet
            </p>
            <p className='text-xs mt-1.5 max-w-sm mx-auto'>
              This candidate has not added any blocks that appear on a shared career card.
            </p>
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

      {footerSlot ? (
        <div
          className={cn(
            'px-6 sm:px-8 pb-7 pt-2 border-t relative z-[1]',
            isDark ? 'border-gray-700/80' : 'border-gray-200/90',
          )}
        >
          <div
            className='h-px w-full mb-5 bg-gradient-to-r from-transparent via-teal-400/30 to-transparent dark:via-teal-400/20'
            aria-hidden
          />
          <div className='flex flex-wrap gap-3'>{footerSlot}</div>
        </div>
      ) : null}
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
  sessionUserId,
  shareToken,
}: {
  section: CareerCardSection
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
  userId?: string
  sessionUserId?: string
  shareToken?: string | null
}) {
  switch (section.blockType as SectionBlockType) {
    case 'storm-resume':
    case 'driver-resume':
    case 'developer-resume':
    case 'general-resume':
      return (
        <ResumeSection
          data={section.data as ResumeData}
          mode={mode}
          isDark={isDark}
          onAction={onAction}
          sessionUserId={sessionUserId}
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
          sessionUserId={sessionUserId}
        />
      )
    case 'driver-screening-consent':
      return (
        <ScreeningConsentSection
          data={section.data as ScreeningConsentData}
          mode={mode}
          isDark={isDark}
          onAction={onAction}
        />
      )
    case 'driver-mvr':
      return (
        <MvrSection
          data={section.data as MvrData}
          mode={mode}
          isDark={isDark}
          sessionUserId={sessionUserId}
          onNavigateToOrder={isCareerCardOwnerMode(mode) && onAction ? onAction : undefined}
        />
      )
    case 'driver-psp':
      return (
        <PspSection
          data={section.data as PspData}
          mode={mode}
          isDark={isDark}
          sessionUserId={sessionUserId}
          onNavigateToOrder={isCareerCardOwnerMode(mode) && onAction ? onAction : undefined}
        />
      )
    case 'driver-cdl-credentials':
      return <CdlSection data={section.data as CdlData} mode={mode} isDark={isDark} onAction={onAction} />
    case 'developer-portfolio':
      return <PortfolioSection data={section.data as PortfolioData} mode={mode} isDark={isDark} onAction={onAction} />
    case 'developer-github':
      return <GitHubSection data={section.data as GitHubData} mode={mode} isDark={isDark} shareToken={shareToken} sessionUserId={sessionUserId} onAction={onAction} />
    case 'developer-projects':
      return <ProjectsSection data={section.data as ProjectsData} mode={mode} isDark={isDark} onAction={onAction} />
    default:
      return null
  }
}
