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
import type { ProjectedCareerCard as CardData } from '@/types/career-card'
import { computeJobFit } from '@/lib/job-fit'
import { useExtractedRequirements } from '@/hooks/use-extracted-requirements'

const ApplyWithStormChainModal = dynamic(
  () => import('@/components/ApplyWithStormChainModal'),
  { ssr: false },
)

/**
 * Tiny hook — keeps the card data alongside installed-block changes. Uses the
 * same endpoint as `CareerCardView` so there's one source of truth.
 */
function useProjectedCard(walletAddress: string | null) {
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
      const res = await fetch('/api/career-card', {
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
  }, [walletAddress])

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

  const { card, loading, error } = useProjectedCard(walletAddress)
  const externalReqs = useExtractedRequirements(snap, walletAddress)

  // UI state for the collapsible chat drawer. Bootstrap autofire still runs
  // silently in the background via StormiChatPanel even while collapsed, so
  // the chat is pre-warmed the first time the user expands it.
  const [chatOpen, setChatOpen] = useState(false)
  /** One-shot preset message to send into the chat when a NextStep CTA asks Stormi something. */
  const [chatPreset, setChatPreset] = useState<string | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)

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
            <ProjectedCareerCard
              data={card}
              mode='self'
              onNavigateToBlock={handleNavigateToBlock}
              onAddBlock={openPicker}
              walletAddress={walletAddress}
              ghostSections={ghostSections}
              onGhostAction={handleNavigateToBlock}
            />
          ) : null}
        </BlockCard>
      </HubSectionPanel>

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
