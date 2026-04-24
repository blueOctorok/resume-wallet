'use client'

/**
 * SimpleCardPanel — the right side of the split view.
 *
 * Layout:
 *   1. Stormi "Do this next" card (violet accent, top) — proactive coach.
 *   2. Live projected Career Card (teal accent, middle) — the user's canvas.
 *   3. Collapsed "Ask Stormi anything" drawer (bottom) — for open-ended chat.
 *
 * All three use the shared hub shell (`HubSectionPanel` + `BlockCard` embed)
 * so Simple Mode feels like the same vault as the Hub, not a different app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, IdCard, Loader2 } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import {
  useHubBlocksStore,
  useInstalledBlocks,
  useStormiAutoWelcomeCandidateDone,
} from '@/stores/hub-blocks-store'
import { useHubContext } from '@/lib/ava-chat'
import type { SimpleModeContext } from '@/lib/ava-context'
import { useSimpleModeStore } from '@/stores/simple-mode-store'
import { getBlockDefinition } from '@/lib/block-registry'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import ProjectedCareerCard, { type GhostSection } from '@/components/career-card/ProjectedCareerCard'
import StormiChatPanel from '@/components/stormi/StormiChatPanel'
import StormiNextStepCard from './StormiNextStepCard'
import LensPickerPopover from '@/components/career-card/LensPickerPopover'
import LensManageModal from '@/components/career-card/LensManageModal'
import { useCareerCardLensesStore, useLenses } from '@/stores/career-card-lenses-store'
import type { ProjectedCareerCard as CardData } from '@/types/career-card'
import { computeJobFit, pickBestLens } from '@/lib/job-fit'
import { useExtractedRequirements } from '@/hooks/use-extracted-requirements'

const ApplyWithStormChainModal = dynamic(
  () => import('@/components/ApplyWithStormChainModal'),
  { ssr: false },
)

/**
 * Tiny hook — keeps the card data alongside installed-block changes. Uses the
 * same endpoint as `CareerCardView` so there's one source of truth.
 */
function useProjectedCard(walletAddress: string | null, lensId: string | null) {
  const [card, setCard] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Re-project when hub blocks change so new installs visibly populate the card
  const installedBlocks = useInstalledBlocks()

  const refresh = useCallback(async () => {
    if (!walletAddress) return
    setLoading(true)
    setError(null)
    try {
      const qs = lensId ? `?lens=${encodeURIComponent(lensId)}` : ''
      const res = await fetch(`/api/career-card${qs}`, {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (!res.ok) throw new Error('Failed to load career card')
      const json = await res.json()
      setCard(json.card ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [walletAddress, lensId])

  useEffect(() => {
    if (!walletAddress) return
    void refresh()
  }, [walletAddress, refresh, installedBlocks.length])

  return { card, loading, error, refresh }
}

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

export default function SimpleCardPanel() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const hubContext = useHubContext()
  const stormiAutoWelcomeCandidateDone = useStormiAutoWelcomeCandidateDone()
  const setStormiAutoWelcomeCandidateDone = useHubBlocksStore(
    (s) => s.setStormiAutoWelcomeCandidateDone,
  )
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const installedBlocks = useInstalledBlocks()
  const snap = useSimpleModeStore((s) => s.selectedJobSnapshot)
  const activeLensId = useSimpleModeStore((s) => s.activeLensId)
  const overrideAutoPick = useSimpleModeStore((s) => s.overrideAutoPick)
  const autoPickLens = useSimpleModeStore((s) => s.autoPickLens)
  const setActiveLens = useSimpleModeStore((s) => s.setActiveLens)
  const lenses = useLenses()
  const createLens = useCareerCardLensesStore((s) => s.createLens)

  const { card, loading, error } = useProjectedCard(walletAddress, activeLensId)
  const externalReqs = useExtractedRequirements(snap, walletAddress)

  // UI state for the collapsible chat drawer. Bootstrap autofire still runs
  // silently in the background via StormiChatPanel even while collapsed, so
  // the chat is pre-warmed the first time the user expands it.
  const [chatOpen, setChatOpen] = useState(false)
  /** One-shot preset message to send into the chat when a NextStep CTA asks Stormi something. */
  const [chatPreset, setChatPreset] = useState<string | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  /** Small anchored popover triggered by the "switch" link on the lens chip. */
  const [lensPickerOpen, setLensPickerOpen] = useState(false)
  const [lensManageOpen, setLensManageOpen] = useState(false)
  /** Quiet undo note for auto-switched lenses. Fades after ~5s. */
  const [autoSwitchNote, setAutoSwitchNote] = useState<{
    toId: string | null
    toName: string
    fromId: string | null
  } | null>(null)
  /**
   * Stormi-drafted lens awaiting user confirmation. We render it in a small
   * non-blocking card below the career card — NOT a modal — so the user can
   * keep scanning the job while deciding.
   */
  const [draftLens, setDraftLens] = useState<{
    name: string
    visibleBlockTypes: string[]
    emphasizedBlockTypes: string[]
    summary: string | null
  } | null>(null)
  const [isDraftingLens, setIsDraftingLens] = useState(false)

  const handleNavigateToBlock = useCallback(
    (blockType?: string) => {
      // Open the picker; if a specific block was requested we could navigate
      // directly later, but picker lets the user see context + decline.
      if (blockType) getBlockDefinition(blockType)
      openPicker()
    },
    [openPicker],
  )

  const handleApply = useCallback(() => {
    if (!snap) return
    if (snap.isStormChain) {
      setApplyOpen(true)
    } else if (snap.redirectUrl) {
      window.open(snap.redirectUrl, '_blank', 'noopener,noreferrer')
    }
  }, [snap])

  // Expand the drawer. If caller passes a preset, stash it so the chat panel
  // can pick it up once the drawer is open.
  const handleAskStormi = useCallback((preset: string | null) => {
    setChatPreset(preset)
    setChatOpen(true)
  }, [])

  const handleDraftLens = useCallback(async () => {
    if (!walletAddress || !snap) return
    setIsDraftingLens(true)
    try {
      const res = await fetch('/api/ai/draft-lens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
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
  }, [walletAddress, snap])

  // Save the current draft as a real lens, then activate it for this job.
  // We intentionally skip the auto-picker after this by toggling overrideAutoPick
  // through `setActiveLens` so Stormi doesn't immediately swap it out.
  const handleSaveDraft = useCallback(async () => {
    if (!walletAddress || !draftLens) return
    const created = await createLens(walletAddress, {
      name: draftLens.name,
      visibleBlockTypes: draftLens.visibleBlockTypes,
      emphasizedBlockTypes: draftLens.emphasizedBlockTypes,
      customSummary: draftLens.summary,
    })
    if (created) {
      setActiveLens(created.id)
      setDraftLens(null)
    }
  }, [walletAddress, draftLens, createLens, setActiveLens])

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

  // Lens auto-picker — when a new job is selected and the user hasn't
  // manually chosen a lens this session, score each lens against the job and
  // switch to the best. Silent; the only surface is the chip on the card.
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
    // Default lens in the store is represented as `null` (so the server picks
    // it). Map the default lens id back to null so we don't pin a uuid and
    // accidentally drift if the default ever gets renamed.
    const defaultId = lenses.find((l) => l.isDefault)?.id
    const newActive = desired === defaultId ? null : desired
    autoPickLens(newActive)
    setAutoSwitchNote({
      toId: newActive,
      toName: lensPick.best.lensName,
      fromId: activeLensId,
    })
  }, [lensPick, overrideAutoPick, activeLensId, lenses, autoPickLens])

  // Auto-hide the "Switched to X · undo" note after 5s. Clearing the note
  // doesn't change the pick — the user has to click undo to revert.
  useEffect(() => {
    if (!autoSwitchNote) return
    const t = setTimeout(() => setAutoSwitchNote(null), 5000)
    return () => clearTimeout(t)
  }, [autoSwitchNote])

  // Stale drafts from a previous job are never what we want to show.
  useEffect(() => {
    setDraftLens(null)
  }, [snap?.id])

  const ghostSections: GhostSection[] = useMemo(() => {
    if (!fit) return []
    return fit.recommendedBlocks.map((block) => ({
      blockId: block.id,
      label: block.label,
      ctaLabel: `Add ${block.label.toLowerCase()}`,
      reason: snap ? `Helps you stand out for ${snap.title}` : undefined,
    }))
  }, [fit, snap])

  const simpleModeContext: SimpleModeContext | null = useMemo(() => {
    if (!snap || !fit) return null
    const raw = snap.description ?? ''
    const excerpt =
      raw.length > 0
        ? raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)
        : null
    return {
      job: {
        id: snap.id,
        title: snap.title,
        company: snap.company,
        location: snap.location,
        descriptionExcerpt: excerpt,
        isStormChain: snap.isStormChain,
      },
      fit: {
        score: fit.score,
        label: fit.label,
        toneBand: fit.toneBand,
        matchedRequirements: fit.matchedRequirements.map((r) => r.label),
        missingRequirements: fit.missingRequirements.map((r) => r.label),
      },
    }
  }, [snap, fit])

  // Friendly card description that pulls double-duty as the targeting ribbon —
  // keeps the block chrome (icon + title + description) doing the work so we
  // don't need a separate teal banner above it anymore.
  const careerCardDescription = useMemo(() => {
    if (!snap) {
      return installedBlocks.length === 0
        ? 'Pick a job and I\u2019ll start shaping your card around it.'
        : `${installedBlocks.length} block${installedBlocks.length === 1 ? '' : 's'} installed \u2014 ready when you find a target.`
    }
    if (fit) {
      return `Targeting ${snap.title} \u00b7 ${snap.company} \u2014 ${fit.score}% requirements coverage`
    }
    return `Targeting ${snap.title} \u00b7 ${snap.company}`
  }, [snap, fit, installedBlocks.length])

  if (!walletAddress) {
    return (
      <HubSectionPanel isDark={isDark}>
        <BlockCard
          variant='embed'
          headerIconSlot={
            <Image
              src='/ava-robot.png'
              alt=''
              width={36}
              height={36}
              className={cn('object-contain', !isDark && 'invert')}
            />
          }
          title='Connect your wallet'
          description='Your career card lives on-chain. Connect to start building alongside this job.'
        />
      </HubSectionPanel>
    )
  }

  return (
    <div className='h-full min-h-0 flex flex-col gap-3 overflow-y-auto pr-1 scrollbar-none'>
      {/* 1. Stormi next-step — violet, top, proactive */}
      <HubSectionPanel isDark={isDark} accent='violet'>
        <BlockCard
          variant='embed'
          headerIconSlot={
            <Image
              src='/ava-robot.png'
              alt=''
              width={36}
              height={36}
              className={cn('object-contain', !isDark && 'invert')}
            />
          }
          title='Stormi'
          description='Your job-first co-pilot. One step at a time.'
        >
          <StormiNextStepCard
            snap={snap}
            fit={fit}
            installedCount={installedBlocks.length}
            onAddBlock={handleNavigateToBlock}
            onApply={handleApply}
            onAskStormi={handleAskStormi}
            lensPick={lensPick}
            onDraftLens={handleDraftLens}
            isDraftingLens={isDraftingLens}
          />
        </BlockCard>
      </HubSectionPanel>

      {/* 2. Career card — teal, middle (scrolls with parent when content overflows) */}
      <HubSectionPanel isDark={isDark} accent='teal'>
        <BlockCard
          variant='embed'
          icon={IdCard}
          title='Career card'
          description={careerCardDescription}
        >
          {loading && !card ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className={cn('w-5 h-5 animate-spin', isDark ? 'text-gray-400' : 'text-slate-500')} />
            </div>
          ) : error ? (
            <p className={cn('text-xs text-center py-8', isDark ? 'text-red-400' : 'text-red-600')}>
              {error}
            </p>
          ) : card ? (
            <div className='relative'>
              <ProjectedCareerCard
                data={card}
                mode='self'
                onNavigateToBlock={handleNavigateToBlock}
                onAddBlock={openPicker}
                walletAddress={walletAddress}
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
            </div>
          ) : null}
        </BlockCard>
      </HubSectionPanel>

      {lensManageOpen && <LensManageModal onClose={() => setLensManageOpen(false)} />}

      {draftLens && (
        <HubSectionPanel isDark={isDark} accent='violet'>
          <BlockCard
            variant='embed'
            headerIconSlot={
              <Image
                src='/ava-robot.png'
                alt=''
                width={32}
                height={32}
                className={cn('object-contain', !isDark && 'invert')}
              />
            }
            title={`Draft: ${draftLens.name} lens`}
            description={`Tailored from ${draftLens.visibleBlockTypes.length} of your blocks for this role.`}
          >
            <div className='flex flex-col gap-3'>
              {draftLens.summary && (
                <p
                  className={cn(
                    'text-xs leading-relaxed italic',
                    isDark ? 'text-gray-300' : 'text-slate-600',
                  )}
                >
                  &ldquo;{draftLens.summary}&rdquo;
                </p>
              )}
              <div className='flex flex-wrap gap-1.5'>
                {draftLens.visibleBlockTypes.map((bt) => {
                  const def = getBlockDefinition(bt)
                  const emph = draftLens.emphasizedBlockTypes.includes(bt)
                  return (
                    <span
                      key={bt}
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-medium',
                        emph
                          ? isDark
                            ? 'bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/40'
                            : 'bg-violet-100 text-violet-800 ring-1 ring-violet-300'
                          : isDark
                            ? 'bg-gray-800 text-gray-300'
                            : 'bg-slate-100 text-slate-700',
                      )}
                    >
                      {def?.label ?? bt}
                      {emph ? ' \u2605' : ''}
                    </span>
                  )
                })}
              </div>
              <div className='flex flex-wrap gap-2'>
                <button
                  type='button'
                  onClick={handleSaveDraft}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                    isDark
                      ? 'bg-violet-500 text-white hover:bg-violet-400'
                      : 'bg-violet-600 text-white hover:bg-violet-500',
                  )}
                >
                  Save and use for this job
                </button>
                <button
                  type='button'
                  onClick={() => setDraftLens(null)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer',
                    isDark
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  Discard
                </button>
              </div>
            </div>
          </BlockCard>
        </HubSectionPanel>
      )}

      {/* 3. Collapsible chat drawer — hidden by default; expands for open-ended Q&A */}
      {chatOpen ? (
        <HubSectionPanel isDark={isDark} accent='violet'>
          <BlockCard
            variant='embed'
            headerIconSlot={
              <Image
                src='/ava-robot.png'
                alt=''
                width={36}
                height={36}
                className={cn('object-contain', !isDark && 'invert')}
              />
            }
            title='Ask Stormi anything'
            description='Open chat for follow-up questions. Your next-step card stays live above.'
            headerActions={
              <button
                type='button'
                onClick={() => setChatOpen(false)}
                className={cn(
                  'p-1 rounded-md transition-colors cursor-pointer',
                  isDark
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
                )}
                aria-label='Collapse chat'
              >
                <ChevronDown className='w-4 h-4' />
              </button>
            }
          >
            {chatPreset && (
              <div
                className={cn(
                  'mb-3 rounded-lg border p-2.5 text-xs flex items-start gap-2',
                  isDark
                    ? 'bg-violet-500/10 border-violet-400/30 text-violet-100'
                    : 'bg-violet-50 border-violet-200 text-violet-800',
                )}
              >
                <span className='font-semibold whitespace-nowrap'>Suggested:</span>
                <span className='flex-1 italic'>{chatPreset}</span>
                <button
                  type='button'
                  onClick={() => setChatPreset(null)}
                  className='font-semibold hover:underline'
                >
                  dismiss
                </button>
              </div>
            )}
            <StormiChatPanel
              mode='candidate'
              walletAddress={walletAddress}
              hubContext={hubContext}
              candidateEmptyHub={installedBlocks.length === 0}
              stormiAutoWelcomeCandidateDone={stormiAutoWelcomeCandidateDone}
              onStormiAutoWelcomeSynced={() => setStormiAutoWelcomeCandidateDone(true)}
              simpleModeContext={simpleModeContext}
              hubEmbedSurface
            />
          </BlockCard>
        </HubSectionPanel>
      ) : (
        <button
          type='button'
          onClick={() => setChatOpen(true)}
          className={cn(
            'w-full rounded-xl border px-4 py-2.5 flex items-center justify-between gap-2 text-sm font-medium transition-colors cursor-pointer',
            isDark
              ? 'bg-gray-900/40 border-gray-700 text-gray-300 hover:border-violet-400/60 hover:text-violet-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-violet-500/60 hover:text-violet-700 shadow-sm',
          )}
        >
          <span className='inline-flex items-center gap-2'>
            <Image
              src='/ava-robot.png'
              alt=''
              width={18}
              height={18}
              className={cn('object-contain', !isDark && 'invert')}
            />
            Ask Stormi anything
          </span>
          <ChevronDown className='w-4 h-4 rotate-180' />
        </button>
      )}

      {snap?.isStormChain && (
        <ApplyWithStormChainModal
          isOpen={applyOpen}
          onClose={() => setApplyOpen(false)}
          job={toApplyModalJob(snap)}
          userAddress={walletAddress}
        />
      )}
    </div>
  )
}
