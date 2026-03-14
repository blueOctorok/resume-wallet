'use client'

import { useEffect, useCallback } from 'react'
import { Plus, Loader2, AlertCircle, X, Eye, Pencil, Check, QrCode, ShieldCheck, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import {
  useHubBlocksStore,
  useInstalledBlocks,
  useNeedsOnboarding,
  useIsEditMode,
} from '@/stores/hub-blocks-store'
import type { InstalledBlock } from '@/stores/hub-blocks-store'
import type { PageType } from '@/stores/types'
import { getBlockColor } from '@/lib/block-registry'
import { getBlockIllustration } from './BlockIllustrations'
import Button from '@/components/ui/Button'
import AvatarUpload from '@/components/ui/AvatarUpload'
import STORMBalance from '@/components/STORMBalance'
import HubOnboardingForm from './HubOnboardingForm'
import BlockPickerModal from './BlockPickerModal'
import Atropos from 'atropos/react'
import 'atropos/css'

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
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Block Tile (glassmorphic + 3D tilt) ──────────────────────────────────────

interface BlockTileProps {
  block: InstalledBlock
  index: number
  isEditing: boolean
  onRemove: () => void
  onOpen: (() => void) | null
}

function BlockTile({ block, index, isEditing, onRemove, onOpen }: BlockTileProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const colors = getBlockColor(block.blockType)
  const hasRoute = !!block.definition?.pageRoute
  const Illustration = getBlockIllustration(block.blockType)

  const handleClick = () => {
    if (isEditing || !onOpen) return
    onOpen()
  }

  // The inner card content — shared between Atropos-wrapped and plain modes
  const tileContent = (
    <div
      className={cn(
        'relative h-full rounded-2xl border flex flex-col p-4 select-none transition-all duration-300 overflow-hidden',
        // Glass effect
        isDark
          ? 'bg-white/[0.04] border-white/[0.08] backdrop-blur-md'
          : 'bg-white/60 border-white/40 backdrop-blur-md',
        // Hover glow (non-edit mode only)
        !isEditing && hasRoute && (isDark ? colors.borderHover.dark : colors.borderHover.light),
        isDragging && 'opacity-60 scale-105 z-20',
        isEditing && !isDragging && 'cursor-grab active:cursor-grabbing',
        isEditing && !isDragging && (index % 2 === 0
          ? '[animation:jiggle_0.3s_ease-in-out_infinite]'
          : '[animation:jiggle-alt_0.28s_ease-in-out_infinite]'
        ),
      )}
      style={{
        // Per-block accent glow on hover via box-shadow
        ...((!isEditing && hasRoute) ? {
          boxShadow: `0 0 0 0 ${colors.glowColor}`,
        } : {}),
      }}
      onMouseEnter={(e) => {
        if (!isEditing && hasRoute) {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${colors.glowColor}, 0 0 0 1px ${colors.glowColor}`
        }
      }}
      onMouseLeave={(e) => {
        if (!isEditing && hasRoute) {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${colors.glowColor}`
        }
      }}
    >
      {/* Remove badge (edit mode only) */}
      {isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className='absolute -top-1.5 -left-1.5 z-10 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors'
          aria-label={`Remove ${block.definition?.label ?? block.blockType}`}
        >
          <X className='w-3.5 h-3.5 text-white' />
        </button>
      )}

      {/* Header: label + status badge */}
      <div className='flex items-center justify-between mb-auto'>
        <p className={cn(
          'text-xs font-bold tracking-wide uppercase truncate',
          isDark ? colors.iconText.dark : colors.iconText.light,
        )}>
          {block.definition?.label ?? block.blockType}
        </p>

        {!isEditing && (
          <div className='flex-shrink-0 ml-1.5'>
            {!hasRoute ? (
              <span className={cn(
                'text-[8px] font-semibold px-1.5 py-0.5 rounded-full',
                isDark ? 'bg-white/10 text-gray-500' : 'bg-gray-100 text-gray-400'
              )}>
                SOON
              </span>
            ) : (
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full [animation:status-pulse_2s_ease-in-out_infinite]',
                  colors.badgeColor,
                )}
                style={{ color: colors.glowColor }}
              />
            )}
          </div>
        )}
      </div>

      {/* Center: styled placeholder illustration */}
      <div className='flex-1 flex items-center justify-center'>
        <div data-atropos-offset='3'>
          <Illustration
            accentText={isDark ? colors.iconText.dark : colors.iconText.light}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Bottom: description teaser */}
      {block.definition?.description && (
        <p className={cn(
          'text-[10px] leading-snug line-clamp-2 mt-auto',
          isDark ? 'text-gray-500' : 'text-gray-400',
        )}>
          {block.definition.description}
        </p>
      )}

      {/* Subtle gradient overlay at bottom for depth */}
      <div className={cn(
        'absolute inset-x-0 bottom-0 h-12 rounded-b-2xl pointer-events-none',
        isDark
          ? 'bg-gradient-to-t from-black/20 to-transparent'
          : 'bg-gradient-to-t from-white/30 to-transparent',
      )} />
    </div>
  )

  // Sortable wrapper (always needed for dnd-kit)
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'aspect-square',
        !isEditing && hasRoute && 'cursor-pointer',
      )}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      {/* Atropos 3D tilt — only in normal mode, not during edit/drag */}
      {!isEditing && !isDragging ? (
        <Atropos
          className='h-full'
          innerClassName='h-full'
          rotateXMax={8}
          rotateYMax={8}
          shadow={false}
          highlight={false}
          rotateTouch={false}
        >
          {tileContent}
        </Atropos>
      ) : (
        tileContent
      )}
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

// ── Career Card banner ───────────────────────────────────────────────────────

/**
 * Maps block types to their on-chain verifiable document label.
 * Only blocks that produce a verifiable PDF/doc appear here.
 * This is intentionally open-ended — any future role's documents
 * just need an entry here to show up in the verification bar.
 */
const VERIFIABLE_BLOCKS: Record<string, string> = {
  'driver-resume':          'Resume',
  'developer-resume':       'Resume',
  'driver-dot-application': 'DOT Application',
  'driver-mvr':             'MVR Report',
}

function CareerCardBanner() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  return (
    <div className={cn(
      'rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
      isDark
        ? 'bg-gradient-to-r from-teal-500/10 via-gray-800/50 to-gray-800/50 border-teal-500/20'
        : 'bg-gradient-to-r from-teal-50 via-white/70 to-white/70 border-teal-200/60',
    )}>
      <div className='flex items-center gap-3'>
        <div className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
          isDark ? 'bg-teal-500/20' : 'bg-teal-100'
        )}>
          <Eye className={cn('w-5 h-5', isDark ? 'text-teal-400' : 'text-teal-600')} />
        </div>
        <div>
          <p className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            Career Card
          </p>
          <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Your public professional profile built from your hub
          </p>
        </div>
      </div>

      <div className='flex items-center gap-2 sm:flex-shrink-0'>
        <button
          onClick={() => setCurrentPage('career-card' as PageType)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors',
            isDark
              ? 'bg-teal-500 text-white hover:bg-teal-400'
              : 'bg-teal-600 text-white hover:bg-teal-500',
          )}
        >
          <ExternalLink className='w-3.5 h-3.5' />
          View Career Card
        </button>
        <button
          onClick={() => setCurrentPage('career-card' as PageType)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
            isDark
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          <QrCode className='w-3.5 h-3.5' />
          QR Code
        </button>
      </div>
    </div>
  )
}

// ── On-chain verification bar ────────────────────────────────────────────────

function VerificationBar() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const installedBlocks = useInstalledBlocks()

  // Dynamically determine which installed blocks can be verified on-chain
  const verifiableItems = installedBlocks
    .filter((b) => VERIFIABLE_BLOCKS[b.blockType])
    .map((b) => ({
      id: b.blockType,
      label: VERIFIABLE_BLOCKS[b.blockType],
      verified: false, // TODO: wire to actual on-chain verification status
    }))

  if (verifiableItems.length === 0) return null

  return (
    <div className={cn(
      'rounded-2xl border p-4',
      isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200',
    )}>
      <div className='flex items-center gap-2 mb-3'>
        <ShieldCheck className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
        <p className={cn('text-xs font-bold uppercase tracking-wide', isDark ? 'text-gray-300' : 'text-gray-600')}>
          On-Chain Verification
        </p>
      </div>

      <div className='flex flex-wrap gap-2'>
        {verifiableItems.map((item) => (
          <button
            key={item.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              item.verified
                ? isDark
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-green-50 text-green-700 border border-green-200'
                : isDark
                  ? 'bg-gray-700/80 text-gray-400 hover:bg-gray-600 border border-gray-600'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200',
            )}
          >
            <ShieldCheck className={cn(
              'w-3 h-3',
              item.verified
                ? 'text-green-500'
                : isDark ? 'text-gray-500' : 'text-gray-400',
            )} />
            {item.label}
            {item.verified ? (
              <Check className='w-3 h-3 text-green-500' />
            ) : (
              <span className={cn(
                'text-[9px] px-1 py-0.5 rounded',
                isDark ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-500',
              )}>
                Verify
              </span>
            )}
          </button>
        ))}
      </div>
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
  const setEditMode = useHubBlocksStore((s) => s.setEditMode)

  const installedBlocks = useInstalledBlocks()
  const needsOnboarding = useNeedsOnboarding()
  const isEditing = useIsEditMode()

  useEffect(() => {
    if (walletAddress) fetchHubData(walletAddress)
  }, [walletAddress, fetchHubData])

  // Exit edit mode on Escape
  useEffect(() => {
    if (!isEditing) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditMode(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isEditing, setEditMode])

  // Desktop drag: distance-based activation
  const desktopSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })

  // Mobile long-press: delay-based activation (enters edit mode + starts drag)
  const mobileSensor = useSensor(PointerSensor, {
    activationConstraint: { delay: 500, tolerance: 5 },
  })

  const sensors = useSensors(
    isEditing ? desktopSensor : mobileSensor
  )

  const handleDragStart = useCallback(() => {
    // Long-press drag on mobile automatically enters edit mode
    if (!isEditing) setEditMode(true)
  }, [isEditing, setEditMode])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !walletAddress) return

    const oldIndex = installedBlocks.findIndex((b) => b.id === active.id)
    const newIndex = installedBlocks.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(installedBlocks, oldIndex, newIndex)
    reorderBlocks(reordered, walletAddress)
  }, [installedBlocks, walletAddress, reorderBlocks])

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
        <HubProfileHeader />
        <CareerCardBanner />
        <VerificationBar />

        {/* ── Block Grid (iPhone home screen) ── */}
        <div>
          <div className='flex items-center justify-between mb-4'>
            <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              My Blocks
            </h2>
            <div className='flex items-center gap-2'>
              {/* Edit / Done toggle — desktop entry point for jiggle mode */}
              {installedBlocks.length > 0 && (
                <button
                  onClick={() => setEditMode(!isEditing)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isEditing
                      ? 'bg-teal-500 text-white hover:bg-teal-600'
                      : isDark
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {isEditing ? <Check className='w-3.5 h-3.5' /> : <Pencil className='w-3.5 h-3.5' />}
                  {isEditing ? 'Done' : 'Edit'}
                </button>
              )}
              <Button variant='primary' size='sm' onClick={openPicker}>
                <Plus className='w-4 h-4' />
                Add
              </Button>
            </div>
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={installedBlocks.map((b) => b.id)}
                strategy={rectSortingStrategy}
              >
                <div className='grid grid-cols-2 gap-4'>
                  {installedBlocks.map((block, idx) => (
                    <BlockTile
                      key={block.id}
                      block={block}
                      index={idx}
                      isEditing={isEditing}
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
