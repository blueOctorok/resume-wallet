'use client'

/**
 * Career card body — real pagination when multiple `cardPage` values exist.
 * One page visible at a time with prev/next + labeled page buttons + swipe.
 * Construct: ↑↓ reorders blocks on the hub (no drag-and-drop); per-block chips
 * move blocks between pages.
 */

import type { ReactNode, TouchEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import type { CareerCardMode, CareerCardSection } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import { isCoreBlock, getBlockDefinition } from '@/lib/block-registry'
import { groupSectionsByCardPage } from '@/lib/career-card-pages'
import { CARD_PAGE_MAX } from '@/lib/hub-block-config'
import type { HubDocumentsHandle } from '@/hooks/use-hub-documents'
import { pickHubDocForCareerBlock } from '@/lib/hub-document-types'
import ConstructSectionWrapper from '@/components/career-card/ConstructSectionWrapper'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'

function pageOf(s: CareerCardSection): number {
  return Math.min(CARD_PAGE_MAX, Math.max(1, s.cardPage ?? 1))
}

function blockLabel(blockType: string): string {
  return getBlockDefinition(blockType)?.label ?? blockType
}

/** Reorder array by moving item at oldIndex to newIndex (inclusive bounds). */
function arrayMove<T>(arr: T[], oldIndex: number, newIndex: number): T[] {
  const result = [...arr]
  if (oldIndex < 0 || oldIndex >= result.length || newIndex < 0 || newIndex >= result.length) return result
  const [removed] = result.splice(oldIndex, 1)
  result.splice(newIndex, 0, removed)
  return result
}

export interface CareerCardDynamicSectionsProps {
  sections: CareerCardSection[]
  mode: CareerCardMode
  isDark: boolean
  walletAddress?: string
  onNavigateToBlock?: (blockType: string) => void
  onAddBlock?: () => void
  hubDocuments?: HubDocumentsHandle
  selfSectionNav?: 'resume-only' | 'all'
  recentlyInstalledBlockIds?: string[]
  renderSectionInner: (section: CareerCardSection, allowNav: boolean) => ReactNode
  onCardMutation?: () => void
}

export default function CareerCardDynamicSections({
  sections,
  mode,
  isDark,
  walletAddress,
  onNavigateToBlock,
  onAddBlock,
  hubDocuments,
  selfSectionNav = 'all',
  recentlyInstalledBlockIds,
  renderSectionInner,
  onCardMutation,
}: CareerCardDynamicSectionsProps) {
  const pages = useMemo(() => groupSectionsByCardPage(sections), [sections])
  const multiPage = pages.length > 1
  const [activePage, setActivePage] = useState(0)
  const [flipOut, setFlipOut] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const reorderBlocks = useHubBlocksStore((s) => s.reorderBlocks)
  const patchBlockConfig = useHubBlocksStore((s) => s.patchBlockConfig)
  const installedBlocks = useHubBlocksStore((s) => s.installedBlocks)

  useEffect(() => {
    if (activePage >= pages.length) setActivePage(Math.max(0, pages.length - 1))
  }, [activePage, pages.length])

  const goPage = useCallback(
    (next: number) => {
      if (next === activePage || next < 0 || next >= pages.length) return
      setFlipOut(true)
      window.setTimeout(() => {
        setActivePage(next)
        setFlipOut(false)
      }, 280)
    },
    [activePage, pages.length],
  )

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }, [])
  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = touchStartX.current
      touchStartX.current = null
      if (start == null || pages.length < 2) return
      const end = e.changedTouches[0]?.clientX ?? start
      const dx = end - start
      if (dx < -50) goPage(activePage + 1)
      else if (dx > 50) goPage(activePage - 1)
    },
    [pages.length, goPage, activePage],
  )

  /** Global index in `sections` (hub order) for reorder. */
  const sectionGlobalIndex = useCallback(
    (section: CareerCardSection) =>
      sections.findIndex((s) => (s.hubBlockId && section.hubBlockId ? s.hubBlockId === section.hubBlockId : s.blockType === section.blockType)),
    [sections],
  )

  const moveSectionOrder = useCallback(
    (section: CareerCardSection, direction: 'up' | 'down') => {
      if (!walletAddress || mode !== 'construct' || isCoreBlock(section.blockType)) return
      const idx = sectionGlobalIndex(section)
      if (idx < 0) return
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= sections.length) return
      // Resume block stays first when present
      if (sections[0]?.blockType === 'storm-resume' && newIdx === 0 && section.blockType !== 'storm-resume') return

      const reorderedSections = arrayMove(sections, idx, newIdx)
      const typeOrder = reorderedSections.map((s) => s.blockType)
      const byType = new Map(installedBlocks.map((b) => [b.blockType, b]))
      const reordered = typeOrder
        .map((t) => byType.get(t))
        .filter((b): b is NonNullable<typeof b> => Boolean(b))
      if (reordered.length !== installedBlocks.length) return

      const storm = reordered.find((b) => b.blockType === 'storm-resume')
      const rest = reordered.filter((b) => b.blockType !== 'storm-resume')
      const finalOrder = storm ? [storm, ...rest] : reordered

      void reorderBlocks(finalOrder, walletAddress).then(() => onCardMutation?.())
    },
    [walletAddress, mode, sections, installedBlocks, reorderBlocks, onCardMutation, sectionGlobalIndex],
  )

  const moveBlockToCardPage = useCallback(
    async (section: CareerCardSection, delta: 1 | -1) => {
      if (!walletAddress || !section.hubBlockId || isCoreBlock(section.blockType)) return
      const current = pageOf(section)
      const next = Math.min(CARD_PAGE_MAX, Math.max(1, current + delta))
      if (next === current) return
      await patchBlockConfig(section.hubBlockId, { cardPage: next }, walletAddress)
      onCardMutation?.()
    },
    [walletAddress, patchBlockConfig, onCardMutation],
  )

  const renderInnerForSection = (section: CareerCardSection): ReactNode => {
    const resumeTypes = new Set(['storm-resume', 'driver-resume', 'developer-resume', 'general-resume'])
    const navAll = (selfSectionNav ?? 'all') === 'all' || mode === 'construct'
    const allowSectionNav =
      isCareerCardOwnerMode(mode) && onNavigateToBlock && (navAll || resumeTypes.has(section.blockType))
    return renderSectionInner(section, Boolean(allowSectionNav && onNavigateToBlock))
  }

  const renderOrderArrows = (section: CareerCardSection): ReactNode => {
    if (mode !== 'construct' || !walletAddress || isCoreBlock(section.blockType)) return null
    const idx = sectionGlobalIndex(section)
    if (idx < 0) return null
    const stormLocked = sections[0]?.blockType === 'storm-resume'
    const canUp = idx > 0 && !(stormLocked && idx === 1 && section.blockType !== 'storm-resume')
    const canDown = idx < sections.length - 1

    const btn =
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors disabled:opacity-30 disabled:pointer-events-none'
    const border = isDark ? 'border-gray-600 bg-gray-800/80 text-gray-200 hover:bg-gray-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'

    return (
      <div className='flex shrink-0 flex-col gap-1 self-start pt-1' aria-label='Reorder on card'>
        <button
          type='button'
          className={cn(btn, border)}
          disabled={!canUp}
          onClick={() => moveSectionOrder(section, 'up')}
          aria-label={`Move ${blockLabel(section.blockType)} up on the card`}
          title='Earlier on card'
        >
          <ArrowUp className='h-4 w-4' aria-hidden />
        </button>
        <button
          type='button'
          className={cn(btn, border)}
          disabled={!canDown}
          onClick={() => moveSectionOrder(section, 'down')}
          aria-label={`Move ${blockLabel(section.blockType)} down on the card`}
          title='Later on card'
        >
          <ArrowDown className='h-4 w-4' aria-hidden />
        </button>
      </div>
    )
  }

  const renderPageChips = (section: CareerCardSection): ReactNode => {
    if (mode !== 'construct' || !section.hubBlockId || isCoreBlock(section.blockType)) return null
    const cur = pageOf(section)
    const canPrev = cur > 1
    const canNext = cur < CARD_PAGE_MAX
    const label = blockLabel(section.blockType)
    const chip =
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors'
    const ghost = isDark ? 'bg-gray-700/70 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'

    return (
      <div className='mt-2 flex flex-wrap items-center gap-1.5 pl-1'>
        {canPrev && (
          <button type='button' className={cn(chip, ghost)} onClick={() => void moveBlockToCardPage(section, -1)} title={`Move ${label} to page ${cur - 1}`}>
            <ArrowUp className='h-3 w-3' aria-hidden /> Move {label} to page {cur - 1}
          </button>
        )}
        {canNext && (
          <button type='button' className={cn(chip, ghost)} onClick={() => void moveBlockToCardPage(section, +1)} title={`Move ${label} to page ${cur + 1}`}>
            <ArrowDown className='h-3 w-3' aria-hidden /> Move {label} to page {cur + 1}
          </button>
        )}
      </div>
    )
  }

  const renderWrappedSection = (section: CareerCardSection) => {
    const recentlyInstalled = Boolean(recentlyInstalledBlockIds?.includes(section.blockType))
    const inner = renderInnerForSection(section)

    if (mode === 'construct' && hubDocuments && onNavigateToBlock) {
      return (
        <div key={section.hubBlockId ?? section.blockType} className={cn(recentlyInstalled && 'animate-card-settle')}>
          <div className='flex items-stretch gap-2 sm:gap-3'>
            {renderOrderArrows(section)}
            <div className='min-w-0 flex-1'>
              <ConstructSectionWrapper
                blockType={section.blockType}
                isDark={isDark}
                doc={pickHubDocForCareerBlock(hubDocuments.documents, section.blockType)}
                hub={hubDocuments}
                onNavigateToBlock={onNavigateToBlock}
              >
                {inner}
              </ConstructSectionWrapper>
              {renderPageChips(section)}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div key={section.hubBlockId ?? section.blockType} className={cn(recentlyInstalled && 'animate-card-settle')}>
        {inner}
      </div>
    )
  }

  const currentPageSections = pages[activePage] ?? []

  const constructPageBody = (
    <div className='space-y-5'>
      {currentPageSections.map((section) => (
        <div key={section.hubBlockId ?? section.blockType}>{renderWrappedSection(section)}</div>
      ))}
    </div>
  )

  const readOnlyPageBody = (
    <div className='space-y-5'>
      {currentPageSections.map((section) => (
        <div key={section.hubBlockId ?? section.blockType}>{renderWrappedSection(section)}</div>
      ))}
    </div>
  )

  const pageNavRow = multiPage ? (
    <div
      className={cn(
        'mt-3 flex flex-col gap-3 rounded-xl border px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-3',
        isDark ? 'border-gray-700 bg-gray-800/50' : 'border-slate-200 bg-slate-50/90',
      )}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className='flex items-center justify-center gap-2 sm:justify-start'>
        <Button
          type='button'
          variant='secondary'
          size='sm'
          className='min-h-10 min-w-[7.5rem] gap-1.5 px-3'
          disabled={activePage <= 0}
          onClick={() => goPage(activePage - 1)}
          aria-label='Previous page'
        >
          <ChevronLeft className='h-4 w-4 shrink-0' aria-hidden />
          Previous
        </Button>
        <Button
          type='button'
          variant='secondary'
          size='sm'
          className='min-h-10 min-w-[7.5rem] gap-1.5 px-3'
          disabled={activePage >= pages.length - 1}
          onClick={() => goPage(activePage + 1)}
          aria-label='Next page'
        >
          Next
          <ChevronRight className='h-4 w-4 shrink-0' aria-hidden />
        </Button>
      </div>

      <div className='flex flex-wrap items-center justify-center gap-2 sm:flex-1 sm:px-2'>
        {pages.map((_, i) => (
          <button
            key={i}
            type='button'
            aria-label={`Open page ${i + 1}`}
            aria-current={i === activePage ? 'page' : undefined}
            onClick={() => goPage(i)}
            className={cn(
              'min-h-10 min-w-[4.5rem] rounded-lg px-3 text-sm font-semibold transition-colors',
              i === activePage
                ? isDark
                  ? 'bg-teal-500/25 text-teal-200 ring-2 ring-teal-400/50'
                  : 'bg-teal-100 text-teal-900 ring-2 ring-teal-400/60'
                : isDark
                  ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100',
            )}
          >
            Page {i + 1}
          </button>
        ))}
      </div>

      <p
        className={cn('text-center text-xs tabular-nums sm:min-w-[5rem] sm:text-right', isDark ? 'text-gray-400' : 'text-slate-500')}
        aria-live='polite'
      >
        {activePage + 1} of {pages.length}
      </p>
    </div>
  ) : null

  return (
    <div className='space-y-5 relative z-[1]'>
      <div
        className='relative min-h-[80px]'
        style={multiPage ? { perspective: '1200px' } : undefined}
        onTouchStart={multiPage ? onTouchStart : undefined}
        onTouchEnd={multiPage ? onTouchEnd : undefined}
      >
        <div
          className={cn('card-flip-inner', multiPage && flipOut && 'opacity-90')}
          style={
            multiPage
              ? { transformStyle: 'preserve-3d', transform: flipOut ? 'rotateY(-12deg)' : 'rotateY(0deg)' }
              : undefined
          }
        >
          {mode === 'construct' ? constructPageBody : readOnlyPageBody}
        </div>
      </div>

      {pageNavRow}

      {mode === 'construct' && onAddBlock && (
        <button
          type='button'
          onClick={onAddBlock}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-semibold transition-colors',
            isDark
              ? 'border-gray-600 text-gray-400 hover:border-teal-500/50 hover:text-teal-300 hover:bg-teal-500/5'
              : 'border-slate-300 text-slate-500 hover:border-teal-500/50 hover:text-teal-700 hover:bg-teal-50',
          )}
        >
          <Plus className='w-4 h-4' />
          Add block
        </button>
      )}
    </div>
  )
}
