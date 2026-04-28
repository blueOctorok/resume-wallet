'use client'

/**
 * Career card body: sections, optional multi-page flip (non-construct),
 * Construct-mode vertical stack with DnD reorder + page break controls.
 */

import type { ReactNode, TouchEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import type { CareerCardMode, CareerCardSection } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import { isCoreBlock } from '@/lib/block-registry'
import { groupSectionsByCardPage, maxCardPageFromSections } from '@/lib/career-card-pages'
import { CARD_PAGE_MAX } from '@/lib/hub-block-config'
import type { HubDocumentsHandle } from '@/hooks/use-hub-documents'
import { pickHubDocForCareerBlock } from '@/lib/hub-document-types'
import ConstructSectionWrapper from '@/components/career-card/ConstructSectionWrapper'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'

const MIN_SECTIONS_FOR_PAGE_CONTROLS = 3

function SortableSectionShell({
  id,
  disabled,
  isDark,
  children,
}: {
  id: string
  disabled: boolean
  isDark: boolean
  children: (dragHandle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }
  const handle = (
    <button
      type='button'
      className={cn(
        'touch-none rounded-md p-1 -ml-1',
        disabled ? 'cursor-default opacity-30' : 'cursor-grab active:cursor-grabbing',
        isDark ? 'text-gray-500 hover:bg-gray-700' : 'text-slate-400 hover:bg-slate-100',
      )}
      aria-label={disabled ? 'Locked order' : 'Drag to reorder'}
      {...attributes}
      {...listeners}
    >
      <GripVertical className='h-4 w-4' />
    </button>
  )
  return (
    <div ref={setNodeRef} style={style} className='relative'>
      {children(handle)}
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
  const touchStartX = useRef<number | null>(null)
  const reorderBlocks = useHubBlocksStore((s) => s.reorderBlocks)
  const patchBlockConfig = useHubBlocksStore((s) => s.patchBlockConfig)
  const installedBlocks = useHubBlocksStore((s) => s.installedBlocks)

  useEffect(() => {
    if (activePage >= pages.length) setActivePage(Math.max(0, pages.length - 1))
  }, [activePage, pages.length])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const flatIds = useMemo(
    () => sections.map((s) => s.hubBlockId).filter((id): id is string => Boolean(id)),
    [sections],
  )

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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
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
      const reordered = typeOrder.map((t) => byType.get(t)).filter((b): b is NonNullable<typeof b> => Boolean(b))
      if (reordered.length !== installedBlocks.length) return

      const storm = reordered.find((b) => b.blockType === 'storm-resume')
      const rest = reordered.filter((b) => b.blockType !== 'storm-resume')
      const finalOrder = storm ? [storm, ...rest] : reordered

      void reorderBlocks(finalOrder, walletAddress).then(() => onCardMutation?.())
    },
    [walletAddress, mode, flatIds, sections, installedBlocks, reorderBlocks, onCardMutation],
  )

  const insertPageBreakAfter = useCallback(
    async (afterFlatIndex: number) => {
      if (!walletAddress) return
      const toBump = sections.slice(afterFlatIndex + 1).filter((s) => s.hubBlockId && !isCoreBlock(s.blockType))
      for (const s of toBump) {
        const next = Math.min(CARD_PAGE_MAX, (s.cardPage ?? 1) + 1)
        await patchBlockConfig(s.hubBlockId!, { cardPage: next }, walletAddress)
      }
      onCardMutation?.()
    },
    [walletAddress, sections, patchBlockConfig, onCardMutation],
  )

  const mergePageDownFrom = useCallback(
    async (fromPage: number) => {
      if (!walletAddress || fromPage < 2) return
      const toMerge = sections.filter(
        (s) => (s.cardPage ?? 1) === fromPage && s.hubBlockId && !isCoreBlock(s.blockType),
      )
      for (const s of toMerge) {
        const next = Math.max(1, fromPage - 1)
        await patchBlockConfig(s.hubBlockId!, { cardPage: next }, walletAddress)
      }
      onCardMutation?.()
    },
    [walletAddress, sections, patchBlockConfig, onCardMutation],
  )

  const renderWrappedSection = (section: CareerCardSection, dragHandle: ReactNode | null) => {
    const recentlyInstalled = Boolean(recentlyInstalledBlockIds?.includes(section.blockType))
    const resumeTypes = new Set(['storm-resume', 'driver-resume', 'developer-resume', 'general-resume'])
    const navAll = (selfSectionNav ?? 'all') === 'all' || mode === 'construct'
    const allowSectionNav =
      isCareerCardOwnerMode(mode) &&
      onNavigateToBlock &&
      (navAll || resumeTypes.has(section.blockType))

    const inner = renderSectionInner(section, Boolean(allowSectionNav && onNavigateToBlock))

    return (
      <div key={section.hubBlockId ?? section.blockType} className={cn(recentlyInstalled && 'animate-card-settle')}>
        {mode === 'construct' && hubDocuments && onNavigateToBlock ? (
          <div className='flex gap-1 sm:gap-2'>
            {dragHandle ? <div className='shrink-0 pt-2'>{dragHandle}</div> : null}
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
            </div>
          </div>
        ) : (
          inner
        )}
      </div>
    )
  }

  const showPageControls = mode === 'construct' && sections.length >= MIN_SECTIONS_FOR_PAGE_CONTROLS

  const constructScrollBody = (
    <div className='space-y-5'>
      {mode === 'construct' && walletAddress && flatIds.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
            {sections.map((section, idx) => {
              const id = section.hubBlockId
              const core = isCoreBlock(section.blockType)
              return (
                <div key={id ?? section.blockType} className='space-y-3'>
                  <SortableSectionShell id={id!} disabled={core || !id} isDark={isDark}>
                    {(handle) => renderWrappedSection(section, core || !id ? null : handle)}
                  </SortableSectionShell>
                  {showPageControls && idx < sections.length - 1 ? (
                    <div
                      className={cn(
                        'flex flex-col items-center gap-1 py-1 border-t border-dashed',
                        isDark ? 'border-gray-600' : 'border-slate-300',
                      )}
                    >
                      <span
                        className={cn('text-[10px] uppercase tracking-wide', isDark ? 'text-gray-500' : 'text-slate-500')}
                      >
                        Page {(section.cardPage ?? 1) < (sections[idx + 1]?.cardPage ?? 1) ? 'break' : 'flow'}
                      </span>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='text-xs'
                        onClick={() => void insertPageBreakAfter(idx)}
                      >
                        <Plus className='w-3 h-3' /> Move blocks below to next page
                      </Button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </SortableContext>
        </DndContext>
      ) : (
        sections.map((section) => <div key={section.hubBlockId ?? section.blockType}>{renderWrappedSection(section, null)}</div>)
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
          className={cn(
            'card-flip-inner',
            flipOut && 'opacity-90',
          )}
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
            Page {maxP}: merge back into previous page?
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
