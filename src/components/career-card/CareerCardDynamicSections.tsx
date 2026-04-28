'use client'

/**
 * Career card body: sections, optional multi-page flip (non-construct),
 * Construct-mode vertical stack with DnD reorder + per-block page move chips.
 *
 * Construct-mode UX goals:
 *  - Touch-friendly: long-press the grip on mobile to start dragging
 *    (TouchSensor delay) so scrolling a long card still works as expected.
 *  - Clear pickup feedback: a DragOverlay floats with the user's pointer/finger
 *    so it's obvious what's being moved. The original slot dims to a placeholder.
 *  - Per-block page moves: each non-core block exposes "Move to page N±1" chips
 *    so users don't have to think about dividers — it's labelled by block name.
 *  - Visible page dividers: when adjacent blocks land on different `cardPage`
 *    values we render a "── Page N ──" separator so the pagination is real, not
 *    a hidden flag.
 */

import type { ReactNode, TouchEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import type { CareerCardMode, CareerCardSection } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import { isCoreBlock, getBlockDefinition } from '@/lib/block-registry'
import { groupSectionsByCardPage, maxCardPageFromSections } from '@/lib/career-card-pages'
import { CARD_PAGE_MAX } from '@/lib/hub-block-config'
import type { HubDocumentsHandle } from '@/hooks/use-hub-documents'
import { pickHubDocForCareerBlock } from '@/lib/hub-document-types'
import ConstructSectionWrapper from '@/components/career-card/ConstructSectionWrapper'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'

function pageOf(section: CareerCardSection): number {
  return Math.min(CARD_PAGE_MAX, Math.max(1, section.cardPage ?? 1))
}

function blockLabel(blockType: string): string {
  return getBlockDefinition(blockType)?.label ?? blockType
}

interface SortableSectionShellProps {
  id: string
  disabled: boolean
  isDark: boolean
  children: (dragHandle: ReactNode, isDragging: boolean) => ReactNode
}

function SortableSectionShell({ id, disabled, isDark, children }: SortableSectionShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Tall, padded grip so it's easy to grab on mobile. The grip is the only
  // thing that activates a drag — the rest of the section stays scroll/tap
  // friendly. `touch-none` tells the browser not to scroll while the grip is
  // pressed (so the long-press → drag handoff feels right).
  const handle = (
    <button
      type='button'
      className={cn(
        'flex h-full min-h-[3.5rem] w-7 shrink-0 items-center justify-center rounded-md transition-colors touch-none select-none',
        disabled
          ? 'cursor-default opacity-25'
          : 'cursor-grab active:cursor-grabbing',
        isDark
          ? 'text-gray-500 hover:bg-gray-700/60 active:bg-gray-700'
          : 'text-slate-400 hover:bg-slate-100 active:bg-slate-200',
      )}
      aria-label={disabled ? 'Locked order' : 'Drag to reorder'}
      {...attributes}
      {...listeners}
    >
      <GripVertical className='h-5 w-5' aria-hidden />
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        // While being dragged, show a faint placeholder where the item lives.
        // The DragOverlay clone is what the user actually sees moving.
        isDragging && 'opacity-40',
      )}
    >
      {children(handle, isDragging)}
    </div>
  )
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
  /** Renders the inner section (ResumeSection, etc.) */
  renderSectionInner: (section: CareerCardSection, allowNav: boolean) => ReactNode
  /** After hub config / reorder — refetch projected card */
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
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const touchStartX = useRef<number | null>(null)
  const reorderBlocks = useHubBlocksStore((s) => s.reorderBlocks)
  const patchBlockConfig = useHubBlocksStore((s) => s.patchBlockConfig)
  const installedBlocks = useHubBlocksStore((s) => s.installedBlocks)

  useEffect(() => {
    if (activePage >= pages.length) setActivePage(Math.max(0, pages.length - 1))
  }, [activePage, pages.length])

  // Sensors:
  //  - Pointer (mouse / pen): tiny activation distance so dragging starts crisply.
  //  - Touch: 220ms long-press so the page can still scroll on a casual swipe.
  //  - Keyboard: a11y; uses arrow keys to reorder.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const flatIds = useMemo(
    () => sections.map((s) => s.hubBlockId).filter((id): id is string => Boolean(id)),
    [sections],
  )
  const sectionsById = useMemo(() => {
    const m = new Map<string, CareerCardSection>()
    for (const s of sections) if (s.hubBlockId) m.set(s.hubBlockId, s)
    return m
  }, [sections])

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null)
      if (!walletAddress || mode !== 'construct') return
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = flatIds.indexOf(String(active.id))
      const newIndex = flatIds.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return

      const stormFirst = sections[0]?.blockType === 'storm-resume'
      if (stormFirst && newIndex === 0 && sections[oldIndex]?.blockType !== 'storm-resume') return

      const reorderedSections = arrayMove(sections, oldIndex, newIndex)
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
    [walletAddress, mode, flatIds, sections, installedBlocks, reorderBlocks, onCardMutation],
  )

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null)
  }, [])

  const movePage = useCallback(
    async (section: CareerCardSection, delta: 1 | -1) => {
      if (!walletAddress || !section.hubBlockId) return
      if (isCoreBlock(section.blockType)) return
      const current = pageOf(section)
      const next = Math.min(CARD_PAGE_MAX, Math.max(1, current + delta))
      if (next === current) return
      await patchBlockConfig(section.hubBlockId, { cardPage: next }, walletAddress)
      onCardMutation?.()
    },
    [walletAddress, patchBlockConfig, onCardMutation],
  )

  const mergePageDownFrom = useCallback(
    async (fromPage: number) => {
      if (!walletAddress || fromPage < 2) return
      const toMerge = sections.filter(
        (s) => pageOf(s) === fromPage && s.hubBlockId && !isCoreBlock(s.blockType),
      )
      for (const s of toMerge) {
        const next = Math.max(1, fromPage - 1)
        await patchBlockConfig(s.hubBlockId!, { cardPage: next }, walletAddress)
      }
      onCardMutation?.()
    },
    [walletAddress, sections, patchBlockConfig, onCardMutation],
  )

  const renderInnerForSection = (section: CareerCardSection): ReactNode => {
    const resumeTypes = new Set(['storm-resume', 'driver-resume', 'developer-resume', 'general-resume'])
    const navAll = (selfSectionNav ?? 'all') === 'all' || mode === 'construct'
    const allowSectionNav =
      isCareerCardOwnerMode(mode) &&
      onNavigateToBlock &&
      (navAll || resumeTypes.has(section.blockType))
    return renderSectionInner(section, Boolean(allowSectionNav && onNavigateToBlock))
  }

  /**
   * Per-block "move to page N±1" chip row. Hidden for core blocks (storm-resume).
   * Shown only in construct, since only the owner can rearrange their card.
   */
  const renderPageChips = (section: CareerCardSection): ReactNode => {
    if (mode !== 'construct') return null
    if (!section.hubBlockId || isCoreBlock(section.blockType)) return null
    const cur = pageOf(section)
    const maxP = maxCardPageFromSections(sections)
    const canPrev = cur > 1
    // Allow moving to a brand-new page (cur+1) up to CARD_PAGE_MAX, even if
    // that page doesn't exist yet — it's auto-created.
    const canNext = cur < CARD_PAGE_MAX
    const label = blockLabel(section.blockType)

    const chip =
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40'
    const ghost = isDark
      ? 'bg-gray-700/70 text-gray-200 hover:bg-gray-700'
      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    const pageBadge = isDark
      ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30'
      : 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'

    return (
      <div className='mt-2 flex flex-wrap items-center gap-1.5 pl-1'>
        <span className={cn(chip, pageBadge)} aria-label={`Currently on page ${cur} of ${Math.max(maxP, cur)}`}>
          Page {cur}
        </span>
        <button
          type='button'
          className={cn(chip, ghost)}
          disabled={!canPrev}
          onClick={() => void movePage(section, -1)}
          aria-label={`Move ${label} to page ${cur - 1}`}
          title={`Move ${label} to page ${cur - 1}`}
        >
          <ArrowUp className='h-3 w-3' aria-hidden />
          Move {label} to page {Math.max(1, cur - 1)}
        </button>
        <button
          type='button'
          className={cn(chip, ghost)}
          disabled={!canNext}
          onClick={() => void movePage(section, +1)}
          aria-label={`Move ${label} to page ${cur + 1}`}
          title={`Move ${label} to page ${cur + 1}`}
        >
          <ArrowDown className='h-3 w-3' aria-hidden />
          Move {label} to page {Math.min(CARD_PAGE_MAX, cur + 1)}
        </button>
      </div>
    )
  }

  /**
   * Wraps a section in its construct chrome (or just the inner for non-construct).
   * `forOverlay` produces a borderless variant used inside the DragOverlay so the
   * floating clone doesn't double-render the wrapper border.
   */
  const renderWrappedSection = (
    section: CareerCardSection,
    dragHandle: ReactNode | null,
    opts?: { forOverlay?: boolean },
  ) => {
    const recentlyInstalled = Boolean(recentlyInstalledBlockIds?.includes(section.blockType))
    const inner = renderInnerForSection(section)

    if (mode === 'construct' && hubDocuments && onNavigateToBlock) {
      return (
        <div
          key={section.hubBlockId ?? section.blockType}
          className={cn(recentlyInstalled && !opts?.forOverlay && 'animate-card-settle')}
        >
          <div className='flex items-stretch gap-1 sm:gap-2'>
            {dragHandle ? <div className='shrink-0 self-stretch pt-1'>{dragHandle}</div> : null}
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
              {!opts?.forOverlay && renderPageChips(section)}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        key={section.hubBlockId ?? section.blockType}
        className={cn(recentlyInstalled && 'animate-card-settle')}
      >
        {inner}
      </div>
    )
  }

  /**
   * Visible "── Page N ──" divider drawn between two adjacent blocks when
   * their cardPage values differ. Makes the pagination plan obvious in
   * Construct without needing a separate flip animation.
   */
  const renderPageBoundary = (toPage: number) => (
    <div
      className={cn(
        'flex items-center gap-3 py-1',
        isDark ? 'text-gray-500' : 'text-slate-500',
      )}
      aria-hidden
    >
      <span className={cn('h-px flex-1', isDark ? 'bg-gray-700' : 'bg-slate-200')} />
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          isDark ? 'bg-gray-800 text-gray-400 ring-1 ring-gray-700' : 'bg-white text-slate-600 ring-1 ring-slate-200',
        )}
      >
        Page {toPage}
      </span>
      <span className={cn('h-px flex-1', isDark ? 'bg-gray-700' : 'bg-slate-200')} />
    </div>
  )

  const activeOverlaySection = activeDragId ? sectionsById.get(activeDragId) ?? null : null

  const constructScrollBody = (
    <div className='space-y-5'>
      {mode === 'construct' && walletAddress && flatIds.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
            {sections.map((section, idx) => {
              const id = section.hubBlockId
              const core = isCoreBlock(section.blockType)
              const next = sections[idx + 1]
              const showBoundary = next && pageOf(next) !== pageOf(section)
              return (
                <div key={id ?? section.blockType} className='space-y-3'>
                  <SortableSectionShell id={id!} disabled={core || !id} isDark={isDark}>
                    {(handle) => renderWrappedSection(section, core || !id ? null : handle)}
                  </SortableSectionShell>
                  {showBoundary && next ? renderPageBoundary(pageOf(next)) : null}
                </div>
              )
            })}
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeOverlaySection ? (
              <div
                className={cn(
                  'pointer-events-none rounded-xl shadow-2xl ring-2',
                  isDark ? 'ring-teal-400/60 shadow-black/60' : 'ring-teal-500/40 shadow-slate-900/15',
                )}
              >
                {renderWrappedSection(activeOverlaySection, null, { forOverlay: true })}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        sections.map((section) => (
          <div key={section.hubBlockId ?? section.blockType}>{renderWrappedSection(section, null)}</div>
        ))
      )}
    </div>
  )

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null || pages.length < 2) return
    const end = e.changedTouches[0]?.clientX ?? start
    const dx = end - start
    if (dx < -50) goPage(activePage + 1)
    else if (dx > 50) goPage(activePage - 1)
  }

  const flipBody =
    mode !== 'construct' && multiPage ? (
      <div
        className='relative min-h-[120px]'
        style={{ perspective: '1200px' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className={cn('card-flip-inner', flipOut && 'opacity-90')}
          style={{
            transformStyle: 'preserve-3d',
            transform: flipOut ? 'rotateY(-12deg)' : 'rotateY(0deg)',
          }}
        >
          <div className='space-y-5'>
            {pages[activePage]?.map((section) => (
              <div key={section.hubBlockId ?? section.blockType}>{renderWrappedSection(section, null)}</div>
            ))}
          </div>
        </div>
        <div className='flex items-center justify-center gap-3 pt-4 pb-1'>
          <span className={cn('text-xs tabular-nums', isDark ? 'text-gray-500' : 'text-slate-500')}>
            {activePage + 1} / {pages.length}
          </span>
          <div className='flex gap-1.5'>
            {pages.map((_, i) => (
              <button
                key={i}
                type='button'
                aria-label={`Page ${i + 1}`}
                aria-current={i === activePage ? 'true' : undefined}
                onClick={() => goPage(i)}
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition-transform',
                  i === activePage
                    ? 'scale-110 bg-teal-500 dark:bg-teal-400'
                    : isDark
                      ? 'bg-gray-600 hover:bg-gray-500'
                      : 'bg-slate-300 hover:bg-slate-400',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    ) : null

  const maxP = maxCardPageFromSections(sections)

  return (
    <div className='space-y-5 relative z-[1]'>
      {mode === 'construct' ? (
        constructScrollBody
      ) : multiPage ? (
        flipBody
      ) : (
        <div className='space-y-5'>
          {sections.map((section) => (
            <div key={section.hubBlockId ?? section.blockType}>{renderWrappedSection(section, null)}</div>
          ))}
        </div>
      )}

      {mode === 'construct' && multiPage && maxP > 1 && (
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border px-3 py-2 text-xs',
            isDark ? 'border-gray-700 bg-gray-800/40' : 'border-slate-200 bg-slate-50',
          )}
        >
          <span className={isDark ? 'text-gray-400' : 'text-slate-600'}>
            Page {maxP}: merge back into page {maxP - 1}?
          </span>
          <Button type='button' variant='secondary' size='sm' onClick={() => void mergePageDownFrom(maxP)}>
            Merge page {maxP}
          </Button>
        </div>
      )}

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
