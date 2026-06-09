'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * SimpleCardPanel — the right column of the guided split view.
 *
 * Layout (top → bottom):
 *   1. Stormi next-step strip — compact violet card with one proactive CTA.
 *   2. ProjectedCareerCard — rendered directly; the card IS the container.
 *
 * No free-form chat here — Guided Mode is coach-driven. Stormi tells the user
 * what to do next via the strip; the full chat lives in Construct mode / Hub for
 * users who want to dig deeper on their own.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Compass, CreditCard, Loader2 } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import { useHubBlocksStore, useInstalledBlocks } from '@/stores/hub-blocks-store'
import { useSimpleModeStore } from '@/stores/simple-mode-store'
import { getBlockDefinition } from '@/lib/block-registry'
import { useUIModeStore } from '@/stores/ui-mode-store'
import type { PageType } from '@/stores/types'
import type { ResumeData } from '@/types/career-card'
import Button from '@/components/ui/Button'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import ProjectedCareerCard, { type GhostSection } from '@/components/career-card/ProjectedCareerCard'
import StormiNextStepCard from './StormiNextStepCard'
import LensPickerPopover from '@/components/career-card/LensPickerPopover'
import LensManageModal from '@/components/career-card/LensManageModal'
import { useCareerCardLensesStore, useLenses } from '@/stores/career-card-lenses-store'
import type { ProjectedCareerCard as CardData } from '@/types/career-card'
import { computeJobFit, pickBestLens } from '@/lib/job-fit'
import { computeReorderSuggestion } from '@/lib/card-reorder-suggestions'
import { useExtractedRequirements } from '@/hooks/use-extracted-requirements'
import { useProjectedCareerCard } from '@/hooks/use-projected-career-card'

const RESUME_BLOCK_TYPES = new Set([
  'storm-resume',
  'driver-resume',
  'developer-resume',
  'general-resume',
])

const ApplyWithStormChainModal = dynamic(
  () => import('@/components/ApplyWithStormChainModal'),
  { ssr: false },
)

const StormApplyBridge = dynamic(
  () => import('@/components/apply/StormApplyBridge'),
  { ssr: false },
)

function toApplyModalJob(snap: NonNullable<ReturnType<typeof useSimpleModeStore.getState>['selectedJobSnapshot']>) {
  return {
    id: snap.id,
    title: snap.title,
    company: snap.company,
    location: snap.location,
    salary: snap.salary ?? undefined,
    description: snap.description ?? undefined,
    redirect_url: snap.redirectUrl ?? undefined,
    salary_min: snap.salaryMin ?? undefined,
    salary_max: snap.salaryMax ?? undefined,
    is_external: !snap.isStormChain,
  }
}

/**
 * Stormi hint shown to guests — same visual chrome as `StormiNextStepCard` but
 * static copy. Branches on whether a job is selected so the message stays
 * concrete without needing real fit data.
 */
function GuestStormiHint({
  snap,
  isDark,
}: {
  snap: ReturnType<typeof useSimpleModeStore.getState>['selectedJobSnapshot']
  isDark: boolean
}) {
  const title = snap ? 'Sign in to build for this job' : 'Pick a job that interests you'
  const body = snap
    ? `I\u2019ll show you the exact blocks \u201c${snap.title}\u201d needs once you connect.`
    : 'Browse the rail. Sign in when you\u2019re ready to start your career card.'

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border px-3 py-2.5',
        isDark
          ? 'border-violet-400/20 bg-violet-500/5'
          : 'border-violet-200/60 bg-violet-50/40 shadow-sm',
      )}
    >
      <div className='flex items-start gap-2'>
        <div
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg',
            isDark
              ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30'
              : 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
          )}
        >
          <Compass className='size-3' />
        </div>
        <div className='min-w-0 flex-1'>
          <p
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider',
              isDark ? 'text-violet-300/80' : 'text-violet-600',
            )}
          >
            Stormi
          </p>
          <p
            className={cn(
              'text-[13px] font-semibold leading-snug',
              isDark ? 'text-white' : 'text-slate-900',
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              'mt-0.5 text-[11px] leading-relaxed',
              isDark ? 'text-gray-300' : 'text-slate-600',
            )}
          >
            {body}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SimpleCardPanel() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const user = useAuthStore((s) => s.user)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  // sessionStorage may hold a stale user snapshot after sign-out. Guard against it:
  // treat as guest if there's no live Supabase session (not wallet — auth users
  // use auth:<uuid> placeholder in sessionUserId).
  const isGuest = !user || !sessionUserId
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const updateAvatarUrl = useHubBlocksStore((s) => s.updateAvatarUrl)
  const reorderBlocks = useHubBlocksStore((s) => s.reorderBlocks)
  const installedBlocks = useInstalledBlocks()
  const [reorderDismissed, setReorderDismissed] = useState(false)
  const snap = useSimpleModeStore((s) => s.selectedJobSnapshot)
  const activeLensId = useSimpleModeStore((s) => s.activeLensId)
  const overrideAutoPick = useSimpleModeStore((s) => s.overrideAutoPick)
  const autoPickLens = useSimpleModeStore((s) => s.autoPickLens)
  const setActiveLens = useSimpleModeStore((s) => s.setActiveLens)
  const lenses = useLenses()
  const createLens = useCareerCardLensesStore((s) => s.createLens)
  const setUiMode = useUIModeStore((s) => s.setMode)
  const setReturnToApply = useUIModeStore((s) => s.setReturnToApply)
  const setOpenPickerAfterHub = useUIModeStore((s) => s.setOpenPickerAfterHub)

  const { card, loading, error, refresh } = useProjectedCareerCard(sessionUserId, {
    lensId: activeLensId,
    installedBlockCount: installedBlocks.length,
  })
  const externalReqs = useExtractedRequirements(snap, sessionUserId)

  const [applyOpen, setApplyOpen] = useState(false)
  const [lensPickerOpen, setLensPickerOpen] = useState(false)
  const [lensManageOpen, setLensManageOpen] = useState(false)
  const [autoSwitchNote, setAutoSwitchNote] = useState<{
    toId: string | null
    toName: string
    fromId: string | null
  } | null>(null)
  const [draftLens, setDraftLens] = useState<{
    name: string
    visibleBlockTypes: string[]
    emphasizedBlockTypes: string[]
    summary: string | null
  } | null>(null)
  const [isDraftingLens, setIsDraftingLens] = useState(false)

  const resumeNeedsStart = useMemo(() => {
    if (!card) return true
    const sec = card.sections.find((s) => RESUME_BLOCK_TYPES.has(s.blockType))
    if (!sec) return true
    const d = sec.data as ResumeData
    if (d.id === '__storm_resume_placeholder__') return true
    if (
      String(d.verificationStatus || '').toUpperCase() === 'EMPTY' &&
      !d.title?.trim() &&
      !d.filename?.trim()
    )
      return true
    return false
  }, [card])

  const handleAddBlockFromApply = useCallback(() => {
    setReturnToApply(true)
    setUiMode('hub')
    setOpenPickerAfterHub(true)
  }, [setReturnToApply, setUiMode, setOpenPickerAfterHub])

  const handleNavigateToBlock = useCallback(
    (blockType?: string) => {
      const bt = blockType ?? 'storm-resume'
      if (RESUME_BLOCK_TYPES.has(bt)) {
        const route = getBlockDefinition(bt)?.pageRoute
        if (route) setCurrentPage(route as PageType)
        return
      }
      setReturnToApply(true)
      setUiMode('hub')
      const route = getBlockDefinition(bt)?.pageRoute
      if (route) queueMicrotask(() => setCurrentPage(route as PageType))
      else setOpenPickerAfterHub(true)
    },
    [setReturnToApply, setUiMode, setCurrentPage, setOpenPickerAfterHub],
  )

  const handleApply = useCallback(() => {
    if (!snap) return
    setApplyOpen(true)
  }, [snap])

  // Apply mode has no chat — "deeper help" routes to Construct mode where Stormi
  // chat lives. This keeps the two modes distinct: coach vs. self-service.
  const handleGoToWorkspace = useCallback(() => {
    setUiMode('hub')
  }, [setUiMode])

  const handleDraftLens = useCallback(async () => {
    if (!sessionUserId || !snap) return
    setIsDraftingLens(true)
    try {
      const res = await fetch('/api/ai/draft-lens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: snap.id,
          source: snap.isStormChain ? 'stormchain' : 'adzuna',
          title: snap.title,
          description: snap.description ?? '',
        }),
      })
      const body = (await res.json()) as {
        draft?: { name: string; visibleBlockTypes: string[]; emphasizedBlockTypes: string[]; summary: string | null }
        error?: string
      }
      if (!res.ok || !body.draft) {
        console.error('[draft-lens] failed:', body.error)
        return
      }
      setDraftLens(body.draft)
    } catch (err) {
      console.error('[draft-lens]:', err)
    } finally {
      setIsDraftingLens(false)
    }
  }, [sessionUserId, snap])

  const handleSaveDraft = useCallback(async () => {
    if (!sessionUserId || !draftLens) return
    const created = await createLens(sessionUserId, {
      name: draftLens.name,
      visibleBlockTypes: draftLens.visibleBlockTypes,
      emphasizedBlockTypes: draftLens.emphasizedBlockTypes,
      customSummary: draftLens.summary,
    })
    if (created) {
      setActiveLens(created.id)
      setDraftLens(null)
    }
  }, [sessionUserId, draftLens, createLens, setActiveLens])

  const installedBlockTypes = useMemo(
    () => installedBlocks.map((b) => b.blockType),
    [installedBlocks],
  )

  const fit = useMemo(() => {
    if (!snap) return null
    return computeJobFit({
      job: snap,
      installedBlockTypes,
      card,
      externalRequirements: externalReqs,
    })
  }, [snap, installedBlockTypes, card, externalReqs])

  const incompleteBlocks = useMemo(() => {
    if (!card) return []
    return card.sections
      .filter((s) => s.needsSetup)
      .map((s) => ({ blockType: s.blockType, label: s.label }))
  }, [card])

  const lensPick = useMemo(() => {
    if (!snap || lenses.length <= 1) return null
    return pickBestLens({
      lenses,
      installedBlockTypes,
      job: snap,
      externalRequirements: externalReqs,
    })
  }, [snap, lenses, installedBlockTypes, externalReqs])

  useEffect(() => {
    if (!lensPick?.best || overrideAutoPick) return
    const desired = lensPick.best.lensId
    const currentResolved = activeLensId ?? lenses.find((l) => l.isDefault)?.id ?? null
    if (desired === currentResolved) return
    const defaultId = lenses.find((l) => l.isDefault)?.id
    const newActive = desired === defaultId ? null : desired
    autoPickLens(newActive)
    setAutoSwitchNote({
      toId: newActive,
      toName: lensPick.best.lensName,
      fromId: activeLensId,
    })
  }, [lensPick, overrideAutoPick, activeLensId, lenses, autoPickLens])

  useEffect(() => {
    if (!autoSwitchNote) return
    const t = setTimeout(() => setAutoSwitchNote(null), 5000)
    return () => clearTimeout(t)
  }, [autoSwitchNote])

  useEffect(() => {
    setDraftLens(null)
  }, [snap?.id])

  useEffect(() => {
    setReorderDismissed(false)
  }, [snap?.id])

  const reorderSuggestion = useMemo(() => {
    if (!card || !fit || reorderDismissed) return null
    return computeReorderSuggestion(card.sections, fit)
  }, [card, fit, reorderDismissed])

  const handleApplyReorder = useCallback(() => {
    if (!sessionUserId || !reorderSuggestion) return
    const byType = new Map(installedBlocks.map((b) => [b.blockType, b]))
    const ordered = reorderSuggestion.suggestedBlockTypes
      .map((t) => byType.get(t))
      .filter((b): b is (typeof installedBlocks)[number] => Boolean(b))
    if (ordered.length !== installedBlocks.length) return
    void reorderBlocks(ordered, sessionUserId).then(() => refresh())
  }, [sessionUserId, reorderSuggestion, installedBlocks, reorderBlocks, refresh])

  const ghostSections: GhostSection[] = useMemo(() => {
    if (!fit) return []
    return fit.recommendedBlocks.map((block) => ({
      blockId: block.id,
      label: block.label,
      ctaLabel: `Add ${block.label.toLowerCase()}`,
      reason: snap ? `Helps you stand out for ${snap.title}` : undefined,
    }))
  }, [fit, snap])

  // Guest variant: same right-column shape (Stormi strip on top, card below) but
  // both are read-only teasers. No fit logic, no lens auto-pick, no API calls —
  // those are gated above by `sessionUserId` checks. The "Connect a wallet" CTA
  // jumps straight to the sign-in page so the user can come back and start building.
  if (isGuest) {
    return (
      <div className='flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none'>
        <GuestStormiHint snap={snap} isDark={isDark} />
        <div className='relative min-h-0 flex-1'>
          <HubSectionPanel isDark={isDark} accent='teal' contentClassName='p-6 sm:p-8'>
            <div className='text-center'>
              <div
                className={cn(
                  'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ring-1',
                  isDark
                    ? 'bg-teal-500/15 text-teal-300 ring-teal-400/30'
                    : 'bg-teal-50 text-teal-700 ring-teal-200',
                )}
              >
                <CreditCard className='h-5 w-5' />
              </div>
              <h3 className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                Your career card lives here.
              </h3>
              <p className={cn('mt-2 text-sm leading-relaxed', isDark ? 'text-gray-400' : 'text-slate-600')}>
                Sign in to start building it block by block. Verified credentials, tailored framings, owned by you.
              </p>
              <Button
                variant='primary'
                size='md'
                onClick={() => setCurrentPage('signin')}
                className='mt-5'
              >
                Connect a wallet
                <ArrowRight className='size-4' />
              </Button>
              <ul
                className={cn(
                  'mx-auto mt-6 max-w-xs space-y-2 text-left text-xs',
                  isDark ? 'text-gray-400' : 'text-slate-600',
                )}
              >
                {[
                  'Build with composable blocks',
                  'Share verified credentials with employers',
                  'Apply with a tailored lens',
                ].map((line) => (
                  <li key={line} className='flex gap-2'>
                    <CheckCircle2
                      className={cn('mt-0.5 size-3 shrink-0', isDark ? 'text-teal-300' : 'text-teal-600')}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </HubSectionPanel>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none'>
      {/* Stormi next-step — compact inline strip. She IS the guide here. */}
      <StormiNextStepCard
        snap={snap}
        fit={fit}
        resumeNeedsStart={resumeNeedsStart}
        onAddBlock={handleNavigateToBlock}
        onApply={handleApply}
        onGoToWorkspace={handleGoToWorkspace}
        lensPick={lensPick}
        onDraftLens={handleDraftLens}
        isDraftingLens={isDraftingLens}
        reorderSuggestion={reorderSuggestion}
        onApplyReorder={handleApplyReorder}
        onDismissReorder={() => setReorderDismissed(true)}
        incompleteBlocks={incompleteBlocks}
        isCardLoading={loading && !card}
      />

      {/* Career card — rendered directly, the card IS the container */}
      <div className='relative min-h-0 flex-1'>
        {loading && !card ? (
          <div className='flex items-center justify-center py-16'>
            <Loader2 className={cn('size-5 animate-spin', isDark ? 'text-gray-400' : 'text-slate-500')} />
          </div>
        ) : error ? (
          <p className={cn('py-8 text-center text-xs', isDark ? 'text-red-400' : 'text-red-600')}>
            {error}
          </p>
        ) : card ? (
          <>
            <ProjectedCareerCard
              data={card}
              mode='self'
              selfSectionNav='resume-only'
              onNavigateToBlock={handleNavigateToBlock}
              onAddBlock={handleAddBlockFromApply}
              sessionUserId={sessionUserId}
              onCardMutation={() => void refresh()}
              onAvatarUploadSuccess={(url) => {
                updateAvatarUrl(url)
                void refresh()
              }}
              ghostSections={ghostSections}
              onGhostAction={handleNavigateToBlock}
              showLensChip={lenses.length > 0}
              activeLensName={card.activeLens?.name ?? null}
              onOpenLensPicker={() => setLensPickerOpen(true)}
              lensSwitchNote={autoSwitchNote}
              onUndoLensSwitch={() => {
                if (!autoSwitchNote) return
                setActiveLens(autoSwitchNote.fromId)
                setAutoSwitchNote(null)
              }}
            />
            {lensPickerOpen && (
              <LensPickerPopover
                onClose={() => setLensPickerOpen(false)}
                onManage={() => setLensManageOpen(true)}
              />
            )}
          </>
        ) : null}
      </div>

      {lensManageOpen && <LensManageModal onClose={() => setLensManageOpen(false)} />}

      {draftLens && (
        <div
          className={cn(
            'rounded-xl border p-3 space-y-2',
            isDark ? 'border-violet-400/30 bg-violet-500/5' : 'border-violet-200 bg-violet-50/60',
          )}
        >
          <div className='flex items-center gap-2'>
            <Image
              src='/ava-robot.png'
              alt=''
              width={20}
              height={20}
              className={cn('object-contain', !isDark && 'invert')}
            />
            <p className={cn('text-xs font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
              Draft: {draftLens.name}
            </p>
          </div>
          {draftLens.summary && (
            <p className={cn('text-[11px] leading-relaxed italic', isDark ? 'text-gray-300' : 'text-slate-600')}>
              &ldquo;{draftLens.summary}&rdquo;
            </p>
          )}
          <div className='flex flex-wrap gap-1'>
            {draftLens.visibleBlockTypes.map((bt) => {
              const def = getBlockDefinition(bt)
              const emph = draftLens.emphasizedBlockTypes.includes(bt)
              return (
                <span
                  key={bt}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                    emph
                      ? isDark
                        ? 'bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/40'
                        : 'bg-violet-100 text-violet-800 ring-1 ring-violet-300'
                      : isDark
                        ? 'bg-gray-800 text-gray-300'
                        : 'bg-slate-100 text-slate-700',
                  )}
                >
                  {def?.label ?? bt}{emph ? ' \u2605' : ''}
                </span>
              )
            })}
          </div>
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={handleSaveDraft}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer',
                isDark ? 'bg-violet-500 text-white hover:bg-violet-400' : 'bg-violet-600 text-white hover:bg-violet-500',
              )}
            >
              Use this lens
            </button>
            <button
              type='button'
              onClick={() => setDraftLens(null)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-medium cursor-pointer',
                isDark ? 'text-gray-400 hover:text-gray-200' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {snap?.isStormChain && (
        <ApplyWithStormChainModal
          isOpen={applyOpen}
          onClose={() => setApplyOpen(false)}
          job={toApplyModalJob(snap)}
          userAddress={sessionUserId}
        />
      )}

      {snap && !snap.isStormChain && (
        <StormApplyBridge
          isOpen={applyOpen}
          onClose={() => setApplyOpen(false)}
          job={toApplyModalJob(snap)}
          userAddress={sessionUserId}
        />
      )}
    </div>
  )
}
