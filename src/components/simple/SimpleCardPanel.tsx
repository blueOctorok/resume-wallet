'use client'

/**
 * SimpleCardPanel — the right column of the guided split view.
 *
 * Layout (top → bottom):
 *   1. Stormi next-step strip — compact violet card with one proactive CTA.
 *   2. ProjectedCareerCard — rendered directly; the card IS the container.
 *
 * No free-form chat here — Guided Mode is coach-driven. Stormi tells the user
 * what to do next via the strip; the full chat lives in Workspace/Hub for
 * users who want to dig deeper on their own.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import { useHubBlocksStore, useInstalledBlocks } from '@/stores/hub-blocks-store'
import { useSimpleModeStore } from '@/stores/simple-mode-store'
import { getBlockDefinition } from '@/lib/block-registry'
import { useUIModeStore } from '@/stores/ui-mode-store'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import ProjectedCareerCard, { type GhostSection } from '@/components/career-card/ProjectedCareerCard'
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

function useProjectedCard(walletAddress: string | null, lensId: string | null) {
  const [card, setCard] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const installedBlocks = useInstalledBlocks()
  const snap = useSimpleModeStore((s) => s.selectedJobSnapshot)
  const activeLensId = useSimpleModeStore((s) => s.activeLensId)
  const overrideAutoPick = useSimpleModeStore((s) => s.overrideAutoPick)
  const autoPickLens = useSimpleModeStore((s) => s.autoPickLens)
  const setActiveLens = useSimpleModeStore((s) => s.setActiveLens)
  const lenses = useLenses()
  const createLens = useCareerCardLensesStore((s) => s.createLens)
  const setUiMode = useUIModeStore((s) => s.setMode)

  const { card, loading, error } = useProjectedCard(walletAddress, activeLensId)
  const externalReqs = useExtractedRequirements(snap, walletAddress)

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

  const handleNavigateToBlock = useCallback(
    (blockType?: string) => {
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

  // Guided Mode has no chat — "deeper help" routes to Workspace where Stormi
  // chat lives. This keeps the two modes distinct: coach vs. self-service.
  const handleGoToWorkspace = useCallback(() => {
    setUiMode('hub')
  }, [setUiMode])

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

  const ghostSections: GhostSection[] = useMemo(() => {
    if (!fit) return []
    return fit.recommendedBlocks.map((block) => ({
      blockId: block.id,
      label: block.label,
      ctaLabel: `Add ${block.label.toLowerCase()}`,
      reason: snap ? `Helps you stand out for ${snap.title}` : undefined,
    }))
  }, [fit, snap])

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
    <div className='flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none'>
      {/* Stormi next-step — compact inline strip. She IS the guide here. */}
      <StormiNextStepCard
        snap={snap}
        fit={fit}
        installedCount={installedBlocks.length}
        onAddBlock={handleNavigateToBlock}
        onApply={handleApply}
        onGoToWorkspace={handleGoToWorkspace}
        lensPick={lensPick}
        onDraftLens={handleDraftLens}
        isDraftingLens={isDraftingLens}
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
          userAddress={walletAddress}
        />
      )}
    </div>
  )
}
