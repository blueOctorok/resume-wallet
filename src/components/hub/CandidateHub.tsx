'use client'

import { useEffect } from 'react'
import { Plus, Loader2, AlertCircle, GripVertical, Trash2, ChevronRight, Eye } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import {
  useHubBlocksStore,
  useInstalledBlocks,
  useNeedsOnboarding,
} from '@/stores/hub-blocks-store'
import type { InstalledBlock } from '@/stores/hub-blocks-store'
import type { PageType } from '@/stores/types'
import { BLOCK_DEFINITIONS } from '@/lib/block-registry'
import Button from '@/components/ui/Button'
import AvatarUpload from '@/components/ui/AvatarUpload'
import STORMBalance from '@/components/STORMBalance'
import HubOnboardingForm from './HubOnboardingForm'
import BlockPickerModal from './BlockPickerModal'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function resolveIcon(name: string) {
  const Icon = (LucideIcons as Record<string, LucideIcons.LucideIcon>)[name]
  return Icon ?? LucideIcons.Box
}

// ── Sortable block card ──────────────────────────────────────────────────────

interface SortableBlockCardProps {
  block: InstalledBlock
  onRemove: () => void
  onOpen: (() => void) | null
}

function SortableBlockCard({ block, onRemove, onOpen }: SortableBlockCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const Icon = block.definition ? resolveIcon(block.definition.icon) : LucideIcons.Box
  const isClickable = !!onOpen

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 rounded-xl border p-4 transition-all',
        isDark
          ? 'bg-gray-800/60 border-gray-700 hover:border-gray-600'
          : 'bg-white border-gray-200 hover:border-gray-300',
        isClickable && 'cursor-pointer',
        isDragging && 'opacity-50 shadow-lg scale-[1.02]'
      )}
      onClick={onOpen ?? undefined}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded',
          isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500'
        )}
        aria-label='Drag to reorder'
      >
        <GripVertical className='w-4 h-4' />
      </button>

      <div className={cn(
        'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
        isDark ? 'bg-gray-700' : 'bg-gray-100'
      )}>
        <Icon className={cn('w-5 h-5', isDark ? 'text-gray-300' : 'text-gray-600')} />
      </div>

      <div className='flex-1 min-w-0'>
        <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
          {block.definition?.label ?? block.blockType}
        </p>
        {block.definition?.description && (
          <p className={cn('text-xs truncate', isDark ? 'text-gray-500' : 'text-gray-400')}>
            {block.definition.description}
          </p>
        )}
      </div>

      {isClickable ? (
        <ChevronRight className={cn(
          'w-4 h-4 flex-shrink-0',
          isDark ? 'text-gray-500' : 'text-gray-400'
        )} />
      ) : (
        <span className={cn(
          'text-[10px] flex-shrink-0 px-2 py-0.5 rounded-full',
          isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
        )}>
          Soon
        </span>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className={cn(
          'flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity',
          isDark
            ? 'text-gray-500 hover:text-red-400 hover:bg-gray-700'
            : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
        )}
        aria-label={`Remove ${block.definition?.label ?? block.blockType}`}
      >
        <Trash2 className='w-4 h-4' />
      </button>
    </div>
  )
}

// ── Profile header ───────────────────────────────────────────────────────────

function HubProfileHeader() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const onboarding = useHubBlocksStore((s) => s.onboarding)
  const updateAvatarUrl = useHubBlocksStore((s) => s.updateAvatarUrl)
  const installedBlocks = useInstalledBlocks()

  const displayName = [userProfile?.firstName, userProfile?.lastName]
    .filter(Boolean)
    .join(' ') || 'New Candidate'

  const occupation = onboarding?.occupation

  const cardClass = cn(
    'rounded-2xl border p-6',
    isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
  )

  // Profile completeness: has name, has occupation, has avatar, has at least one block
  const completionChecks = [
    !!userProfile?.firstName,
    !!occupation,
    !!userProfile?.avatarUrl,
    installedBlocks.length > 0,
  ]
  const completeness = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)

  return (
    <div className={cardClass}>
      <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6'>
        {/* Avatar + name + occupation */}
        <div className='flex items-center gap-4'>
          <AvatarUpload
            name={displayName}
            avatarUrl={userProfile?.avatarUrl ?? null}
            size='xl'
            color='teal'
            uploadEndpoint='/api/driver/avatar'
            walletAddress={walletAddress ?? ''}
            onSuccess={updateAvatarUrl}
          />
          <div>
            <h1 className={cn(
              'text-2xl sm:text-3xl font-bold',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              {displayName}
            </h1>
            {occupation ? (
              <p className={cn('text-sm mt-1', isDark ? 'text-teal-400' : 'text-teal-600')}>
                {occupation}
              </p>
            ) : (
              <p className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Complete onboarding to set your role
              </p>
            )}
          </div>
        </div>

        {/* Profile completeness bar */}
        <div className='flex-shrink-0 w-full lg:w-72'>
          <div className='flex items-center justify-between mb-2'>
            <span className={cn('text-sm font-semibold', isDark ? 'text-gray-300' : 'text-gray-600')}>
              Profile Completeness
            </span>
            <span className={cn(
              'text-lg font-bold',
              completeness >= 75 ? 'text-green-500'
                : completeness >= 50 ? 'text-yellow-500'
                : isDark ? 'text-gray-400' : 'text-gray-500'
            )}>
              {completeness}%
            </span>
          </div>
          <div className={cn('h-3 rounded-full overflow-hidden', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                completeness >= 75 ? 'bg-gradient-to-r from-green-500 to-green-400'
                  : completeness >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                  : 'bg-teal-500/50'
              )}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Quick stats ──────────────────────────────────────────────────────────────

function HubQuickStats() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const installedBlocks = useInstalledBlocks()
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  const stats = [
    {
      label: 'Blocks Added',
      value: installedBlocks.length,
      total: BLOCK_DEFINITIONS.length,
      color: 'teal',
    },
    {
      label: 'Verified Docs',
      value: 0, // TODO: count verified blocks once verification is wired up
      color: 'green',
    },
  ]

  const cardClass = cn(
    'rounded-2xl border p-5',
    isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
  )

  return (
    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
      {stats.map((stat) => (
        <div key={stat.label} className={cardClass}>
          <p className={cn('text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {stat.label}
          </p>
          <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {stat.value}
            {stat.total !== undefined && (
              <span className={cn('text-sm font-normal ml-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                / {stat.total}
              </span>
            )}
          </p>
        </div>
      ))}

      {/* Career card quick action */}
      <button
        onClick={() => setCurrentPage('career-card' as PageType)}
        className={cn(
          cardClass,
          'flex items-center gap-3 text-left cursor-pointer hover:border-teal-500/50 transition-colors'
        )}
      >
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          isDark ? 'bg-teal-500/20' : 'bg-teal-50'
        )}>
          <Eye className={cn('w-5 h-5', isDark ? 'text-teal-400' : 'text-teal-600')} />
        </div>
        <div>
          <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            Career Card
          </p>
          <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
            View your public profile
          </p>
        </div>
      </button>
    </div>
  )
}

// ── CandidateHub ─────────────────────────────────────────────────────────────

export default function CandidateHub() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  const isLoading = useHubBlocksStore((s) => s.isLoading)
  const fetchError = useHubBlocksStore((s) => s.fetchError)
  const fetchHubData = useHubBlocksStore((s) => s.fetchHubData)
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const removeBlock = useHubBlocksStore((s) => s.removeBlock)
  const reorderBlocks = useHubBlocksStore((s) => s.reorderBlocks)

  const installedBlocks = useInstalledBlocks()
  const needsOnboarding = useNeedsOnboarding()

  useEffect(() => {
    if (walletAddress) fetchHubData(walletAddress)
  }, [walletAddress, fetchHubData])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !walletAddress) return

    const oldIndex = installedBlocks.findIndex((b) => b.id === active.id)
    const newIndex = installedBlocks.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(installedBlocks, oldIndex, newIndex)
    reorderBlocks(reordered, walletAddress)
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-gray-400' : 'text-gray-500')} />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className={cn(
        'rounded-xl border p-6 text-center max-w-md mx-auto',
        isDark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <AlertCircle className='w-8 h-8 text-red-500 mx-auto mb-3' />
        <p className={cn('text-sm font-medium mb-1', isDark ? 'text-white' : 'text-gray-900')}>
          Failed to load your hub
        </p>
        <p className={cn('text-xs mb-4', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {fetchError}
        </p>
        <Button variant='secondary' size='sm' onClick={() => walletAddress && fetchHubData(walletAddress)}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <>
      {needsOnboarding && <HubOnboardingForm />}
      <BlockPickerModal />

      <div className='max-w-3xl mx-auto space-y-6'>
        {/* ── Profile Header ── */}
        <HubProfileHeader />

        {/* ── Quick Stats + Career Card ── */}
        <HubQuickStats />

        {/* ── Block Grid ── */}
        <div>
          <div className='flex items-center justify-between mb-3'>
            <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              My Blocks
            </h2>
            <Button variant='primary' size='sm' onClick={openPicker}>
              <Plus className='w-4 h-4' />
              Add Blocks
            </Button>
          </div>

          {installedBlocks.length === 0 ? (
            <div className={cn(
              'rounded-2xl border-2 border-dashed p-12 text-center',
              isDark ? 'border-gray-700' : 'border-gray-300'
            )}>
              <div className='inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-500/10 mb-4'>
                <Plus className='w-6 h-6 text-teal-500' />
              </div>
              <p className={cn('text-sm font-medium mb-1', isDark ? 'text-white' : 'text-gray-900')}>
                Your hub is empty
              </p>
              <p className={cn('text-xs mb-4', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Add blocks to build your professional profile
              </p>
              <Button variant='secondary' size='sm' onClick={openPicker}>
                Browse Blocks
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={installedBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className='space-y-2'>
                  {installedBlocks.map((block) => (
                    <SortableBlockCard
                      key={block.id}
                      block={block}
                      onRemove={() => walletAddress && removeBlock(block.id, walletAddress)}
                      onOpen={block.definition?.pageRoute
                        ? () => setCurrentPage(block.definition!.pageRoute as PageType)
                        : null
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* ── STORM Token Footer ── */}
        {walletAddress && (
          <div className='pt-4'>
            <STORMBalance walletAddress={walletAddress} />
          </div>
        )}
      </div>
    </>
  )
}
