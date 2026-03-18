'use client'

import { useEffect, useCallback, useState } from 'react'
import Image from 'next/image'
import { Plus, Loader2, AlertCircle, X, Eye, Pencil, Check, QrCode, ShieldCheck, ExternalLink, ChevronLeft, ChevronRight, FileText, ClipboardCheck, MessageCircle, Car, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore, useJourneyStore, useJourneyProgress } from '@/stores'
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
import CandidateRequestsSection from '@/components/CandidateRequestsSection'
import HubOnboardingForm from './HubOnboardingForm'
import BlockPickerModal from './BlockPickerModal'
import MvrViewModal from '@/components/MvrViewModal'
import DotAppPreviewModal from '@/components/career-card/DotAppPreviewModal'
import ResumeFilePreviewModal from '@/components/hub/ResumeFilePreviewModal'
import { downloadDriverResumePdfFromStructured } from '@/lib/driver-resume-pdf-download'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import DeveloperResumePreviewModal from '@/components/DeveloperResumePreviewModal'
import type { DeveloperResumeData } from '@/components/DeveloperResumeBuilder'
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

// ── Hex clip-path for flat-top hexagon ────────────────────────────────────────
// Pointy-left/right hex: vertices at 0%/50%, 25%/0%, 75%/0%, 100%/50%, 75%/100%, 25%/100%
const HEX_CLIP = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'

// ── Block Tile (glassmorphic hex + 3D tilt) ──────────────────────────────────

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

  const tileContent = (
    <div
      className={cn(
        'relative w-full h-full select-none transition-all duration-300',
        isDragging && 'opacity-60 scale-105 z-20',
        isEditing && !isDragging && 'cursor-grab active:cursor-grabbing',
        isEditing && !isDragging && (index % 2 === 0
          ? '[animation:jiggle_0.3s_ease-in-out_infinite]'
          : '[animation:jiggle-alt_0.28s_ease-in-out_infinite]'
        ),
      )}
      style={{
        clipPath: HEX_CLIP,
        filter: (!isEditing && hasRoute)
          ? `drop-shadow(0 0 0px ${colors.glowColor})`
          : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isEditing && hasRoute) {
          (e.currentTarget as HTMLElement).style.filter = `drop-shadow(0 4px 16px ${colors.glowColor})`
        }
      }}
      onMouseLeave={(e) => {
        if (!isEditing && hasRoute) {
          (e.currentTarget as HTMLElement).style.filter = `drop-shadow(0 0 0px ${colors.glowColor})`
        }
      }}
    >
      {/* Hex border layer */}
      <div
        className={cn(
          'absolute inset-0',
          isDark ? 'bg-white/[0.08]' : 'bg-white/40',
          !isEditing && hasRoute && (isDark ? colors.borderHover.dark : colors.borderHover.light),
        )}
        style={{ clipPath: HEX_CLIP }}
      />
      {/* Inner hex fill (2px inset = visible border) */}
      <div
        className={cn(
          'absolute inset-[2px]',
          isDark ? 'bg-gray-900/80 backdrop-blur-md' : 'bg-white/70 backdrop-blur-md',
        )}
        style={{ clipPath: HEX_CLIP }}
      />

      {/* Remove badge (edit mode) */}
      {isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className='absolute top-2 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors'
          aria-label={`Remove ${block.definition?.label ?? block.blockType}`}
        >
          <X className='w-3.5 h-3.5 text-white' />
        </button>
      )}

      {/* Content — absolutely positioned + centered so it never affects hex size */}
      <div className='absolute inset-0 z-[1] flex flex-col items-center justify-center text-center overflow-hidden px-[20%] py-[18%]'>
        {/* Status badge */}
        {!isEditing && (
          <div className='flex-shrink-0'>
            {!hasRoute ? (
              <span className={cn(
                'text-[7px] font-semibold px-1.5 py-0.5 rounded-full',
                isDark ? 'bg-white/10 text-gray-500' : 'bg-gray-100 text-gray-400'
              )}>
                SOON
              </span>
            ) : (
              <div
                className={cn(
                  'w-2 h-2 rounded-full mx-auto [animation:status-pulse_2s_ease-in-out_infinite]',
                  colors.badgeColor,
                )}
              />
            )}
          </div>
        )}

        {/* Illustration — fixed size, never grows */}
        <div className='flex-shrink-0 my-1 [&_svg]:w-10 [&_svg]:h-10' data-atropos-offset='3'>
          <Illustration
            accentText={isDark ? colors.iconText.dark : colors.iconText.light}
            isDark={isDark}
          />
        </div>

        {/* Label — single line, truncate if long */}
        <p className={cn(
          'flex-shrink-0 text-[9px] font-bold tracking-wide uppercase leading-tight truncate w-full',
          isDark ? colors.iconText.dark : colors.iconText.light,
        )}>
          {block.definition?.label ?? block.blockType}
        </p>

        {/* Description — clamp to 2 lines max */}
        {block.definition?.description && (
          <p className={cn(
            'flex-shrink-0 text-[7px] leading-tight line-clamp-2 mt-0.5 w-full',
            isDark ? 'text-gray-500' : 'text-gray-400',
          )}>
            {block.definition.description}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'w-full h-full',
        !isEditing && hasRoute && 'cursor-pointer',
      )}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      {!isEditing && !isDragging ? (
        <Atropos
          className='w-full h-full'
          innerClassName='w-full h-full'
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

// ── Honeycomb Grid Layout ─────────────────────────────────────────────────────
// ── Block Hive layout ────────────────────────────────────────────────────────
// Radial honeycomb: slot 0 = center (larger), slots 1+ spiral around it.
//
// On mobile: 5 slots per page (no middle-left/right to avoid horizontal cutoff)
// On tablet/desktop: 7 slots per page (full ring)
//
// Two hex sizes: the center hex is bigger to create visual hierarchy.
// Ring hexes are spaced so edges never overlap.

const SLOTS_PER_PAGE_MOBILE = 5  // center + top pair + bottom pair
const SLOTS_PER_PAGE_DESKTOP = 7 // full ring
const HIVE_GAP = 10 // px between hex edges

// Hex tile dimensions — three tiers: phone (<400), tablet (400–639), desktop (640+)
const CENTER_W_XS = 120; const CENTER_H_XS = 138
const CENTER_W_SM = 190; const CENTER_H_SM = 218
const CENTER_W_LG = 220; const CENTER_H_LG = 253
const RING_W_XS   = 90;  const RING_H_XS   = 104
const RING_W_SM   = 150; const RING_H_SM   = 172
const RING_W_LG   = 170; const RING_H_LG   = 195

interface HiveMetrics {
  centerW: number; centerH: number
  ringW: number;   ringH: number
}

// Returns slot offsets for all 7 positions (desktop) or 5 positions (mobile).
// Mobile layout omits middle-left/right (indices 3,4) to fit narrow screens.
function hiveSlotOffsets(m: HiveMetrics, isMobile: boolean): [number, number][] {
  const dx = m.centerW / 2 + HIVE_GAP + m.ringW / 2
  const dy = m.centerH / 2 + HIVE_GAP + m.ringH / 2
  const halfDx = dx * 0.52

  if (isMobile) {
    // 5 slots: center, top-left, top-right, bottom-left, bottom-right
    return [
      [0, 0],                         // 0: center
      [-halfDx, -dy * 0.92],         // 1: top-left
      [halfDx,  -dy * 0.92],         // 2: top-right
      [-halfDx,  dy * 0.92],         // 3: bottom-left
      [halfDx,   dy * 0.92],         // 4: bottom-right
    ]
  }

  // 7 slots: full ring including middle-left/right
  return [
    [0, 0],                         // 0: center
    [-halfDx, -dy * 0.92],         // 1: top-left
    [halfDx,  -dy * 0.92],         // 2: top-right
    [-dx,      0],                  // 3: middle-left
    [dx,       0],                  // 4: middle-right
    [-halfDx,  dy * 0.92],         // 5: bottom-left
    [halfDx,   dy * 0.92],         // 6: bottom-right
  ]
}

function HoneycombGrid({
  blocks,
  isEditing,
  walletAddress,
  removeBlock,
  setCurrentPage,
}: {
  blocks: InstalledBlock[]
  isEditing: boolean
  walletAddress: string | null
  removeBlock: (id: string, wallet: string) => void
  setCurrentPage: (page: PageType) => void
}) {
  const [page, setPage] = useState(0)
  // 'xs' = phone (<400px), 'sm' = tablet (400–639), 'lg' = desktop (640+)
  const [sizeClass, setSizeClass] = useState<'xs' | 'sm' | 'lg'>('lg')

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      setSizeClass(w < 400 ? 'xs' : w < 640 ? 'sm' : 'lg')
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // 5-slot layout for anything under 640px (all phones including Plus/Max models).
  // Hex SIZE still uses three tiers (xs/sm/lg), but SLOT COUNT is a separate concern.
  const useCompactLayout = sizeClass === 'xs' || sizeClass === 'sm'
  const slotsPerPage = useCompactLayout ? SLOTS_PER_PAGE_MOBILE : SLOTS_PER_PAGE_DESKTOP

  const metrics: HiveMetrics = sizeClass === 'xs'
    ? { centerW: CENTER_W_XS, centerH: CENTER_H_XS, ringW: RING_W_XS, ringH: RING_H_XS }
    : sizeClass === 'sm'
      ? { centerW: CENTER_W_SM, centerH: CENTER_H_SM, ringW: RING_W_SM, ringH: RING_H_SM }
      : { centerW: CENTER_W_LG, centerH: CENTER_H_LG, ringW: RING_W_LG, ringH: RING_H_LG }

  const slots = hiveSlotOffsets(metrics, useCompactLayout)

  const totalPages = Math.max(1, Math.ceil(blocks.length / slotsPerPage))

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1))
  }, [totalPages, page])

  const pageBlocks = blocks.slice(page * slotsPerPage, (page + 1) * slotsPerPage)

  // Container width: on mobile, only need to fit the top/bottom stagger (halfDx).
  // On desktop, need to fit the full middle-left/right (dx).
  const dx = metrics.centerW / 2 + HIVE_GAP + metrics.ringW / 2
  const halfDx = dx * 0.52
  const containerW = useCompactLayout
    ? 2 * (halfDx + metrics.ringW / 2) + 16
    : 2 * (dx + metrics.ringW / 2) + 16
  const dy = (metrics.centerH / 2 + HIVE_GAP + metrics.ringH / 2) * 0.92
  const containerH = 2 * (dy + metrics.ringH / 2) + 16

  return (
    <div className='flex flex-col items-center'>
      <div className='relative' style={{ width: containerW, height: containerH }}>
        {pageBlocks.map((block, slotIdx) => {
          const isCenter = slotIdx === 0
          const w = isCenter ? metrics.centerW : metrics.ringW
          const h = isCenter ? metrics.centerH : metrics.ringH
          const [dx, dy] = slots[slotIdx]
          const left = containerW / 2 - w / 2 + dx
          const top = containerH / 2 - h / 2 + dy

          // On XS screens, hexes are smaller than the content was designed for.
          // Scale the tile visually to fit, keeping layout position unchanged.
          const scaleRatio = sizeClass === 'xs'
            ? (isCenter ? metrics.centerW / CENTER_W_SM : metrics.ringW / RING_W_SM)
            : 1

          return (
            <div
              key={block.id}
              className='absolute'
              style={{
                width: w,
                height: h,
                left,
                top,
                transition: 'left 0.3s ease, top 0.3s ease',
                zIndex: isCenter ? 2 : 1,
              }}
            >
              <div className='w-full h-full' style={scaleRatio < 1 ? {
                width: isCenter ? CENTER_W_SM : RING_W_SM,
                height: isCenter ? CENTER_H_SM : RING_H_SM,
                transform: `scale(${scaleRatio})`,
                transformOrigin: 'top left',
              } : undefined}>
                <BlockTile
                  block={block}
                  index={page * slotsPerPage + slotIdx}
                  isEditing={isEditing}
                  onRemove={() => walletAddress && removeBlock(block.id, walletAddress)}
                  onOpen={block.definition?.pageRoute
                    ? () => setCurrentPage(block.definition!.pageRoute as PageType)
                    : null
                  }
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center gap-3 mt-4'>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              page === 0
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            )}
          >
            <ChevronLeft className='w-5 h-5' />
          </button>

          {/* Page dots */}
          <div className='flex gap-1.5'>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i === page ? 'bg-teal-400' : 'bg-gray-600 hover:bg-gray-500'
                )}
              />
            ))}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              page === totalPages - 1
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            )}
          >
            <ChevronRight className='w-5 h-5' />
          </button>
        </div>
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
  const updateUserProfile = useHubBlocksStore((s) => s.updateUserProfile)
  const installedBlocks = useInstalledBlocks()

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [editHeadline, setEditHeadline] = useState('')
  const [saving, setSaving] = useState(false)

  const displayName = [userProfile?.firstName, userProfile?.lastName]
    .filter(Boolean)
    .join(' ') || 'New Candidate'

  // Prefer headline from user_profiles, fall back to onboarding occupation
  const headline = userProfile?.headline || onboarding?.occupation || null

  const startEditing = () => {
    setEditFirst(userProfile?.firstName || '')
    setEditLast(userProfile?.lastName || '')
    setEditHeadline(headline || '')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
  }

  const saveProfile = async () => {
    if (!editFirst.trim() || !editLast.trim()) return
    setSaving(true)
    try {
      // Save name + headline to user_profiles
      const res = await fetch('/api/user/profile-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress ?? '',
        },
        body: JSON.stringify({
          firstName: editFirst.trim(),
          lastName: editLast.trim(),
          headline: editHeadline.trim() || null,
        }),
      })
      if (res.ok) {
        updateUserProfile({
          firstName: editFirst.trim(),
          lastName: editLast.trim(),
          headline: editHeadline.trim() || null,
        })
        setIsEditing(false)
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setSaving(false)
    }
  }

  const cardClass = cn(
    'rounded-2xl border p-6',
    isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
  )

  const completionChecks = [
    !!userProfile?.firstName,
    !!headline,
    !!userProfile?.avatarUrl,
    installedBlocks.length > 0,
  ]
  const completeness = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)

  const inputClass = cn(
    'w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500',
    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
  )

  return (
    <div className={cardClass}>
      <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6'>
        <div className='flex items-center gap-4'>
          <AvatarUpload
            name={displayName}
            avatarUrl={userProfile?.avatarUrl ?? null}
            size='xl'
            color='teal'
            uploadEndpoint='/api/user/avatar'
            walletAddress={walletAddress ?? ''}
            onSuccess={updateAvatarUrl}
          />

          {isEditing ? (
            <div className='flex flex-col gap-2 min-w-0'>
              <div className='flex gap-2'>
                <input
                  value={editFirst}
                  onChange={(e) => setEditFirst(e.target.value)}
                  placeholder='First name'
                  className={inputClass}
                  autoFocus
                />
                <input
                  value={editLast}
                  onChange={(e) => setEditLast(e.target.value)}
                  placeholder='Last name'
                  className={inputClass}
                />
              </div>
              <input
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value)}
                placeholder='Headline (e.g. CDL-A Driver, Software Engineer)'
                className={inputClass}
              />
              <div className='flex gap-2'>
                <button
                  onClick={saveProfile}
                  disabled={saving || !editFirst.trim() || !editLast.trim()}
                  className='flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50 transition-colors'
                >
                  {saving ? <Loader2 className='w-3 h-3 animate-spin' /> : <Check className='w-3 h-3' />}
                  Save
                </button>
                <button
                  onClick={cancelEditing}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                    isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  )}
                >
                  <X className='w-3 h-3' />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className='flex items-center gap-2'>
                <h1 className={cn(
                  'text-2xl sm:text-3xl font-bold',
                  isDark ? 'text-white' : 'text-gray-900'
                )}>
                  {displayName}
                </h1>
                <button
                  onClick={startEditing}
                  className={cn(
                    'p-1 rounded-lg transition-colors',
                    isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  )}
                  title='Edit profile'
                >
                  <Pencil className='w-4 h-4' />
                </button>
              </div>
              {headline ? (
                <p className={cn('text-sm mt-1', isDark ? 'text-teal-400' : 'text-teal-600')}>
                  {headline}
                </p>
              ) : (
                <p className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Complete onboarding to set your role
                </p>
              )}
            </div>
          )}
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

// ── AvA + journey (hub) ─────────────────────────────────────────────────────
// Journey list mirrors AvA modal logic so candidates see status before opening chat.

function AvaBanner() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const openGuide = useJourneyStore((s) => s.openGuide)
  const progress = useJourneyProgress()
  const steps = progress.steps.filter((s) => s.status !== 'skipped')
  const doneCount = steps.filter((s) => s.status === 'complete').length

  return (
    <div className='ava-glow-border'>
      <div
        className={cn(
          'rounded-[14px] p-5 flex flex-col gap-4',
          isDark ? 'bg-gray-900' : 'bg-white',
        )}
      >
        <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
          <div className='flex gap-3 min-w-0'>
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden',
                // Asset is white-on-black: dark tile shows it raw; light tile inverts to dark-on-white
                isDark ? 'bg-zinc-950' : 'bg-white ring-1 ring-gray-200/80',
              )}
            >
              <Image
                src='/ava-robot.png'
                alt='AvA'
                width={40}
                height={40}
                className={cn('object-contain size-9', !isDark && 'invert')}
              />
            </div>
            <div className='min-w-0 space-y-2'>
              <p
                className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-900')}
              >
                AvA &amp; your journey
              </p>
              <p
                className={cn(
                  'text-xs leading-relaxed',
                  isDark ? 'text-gray-400' : 'text-gray-600',
                )}
              >
                <span className='font-medium text-gray-500 dark:text-gray-300'>
                  What it is:
                </span>{' '}
                A checklist tied to your blocks and what&apos;s already on file (resume, DOT,
                MVR, profile). It updates as you complete work.
              </p>
              <p
                className={cn(
                  'text-xs leading-relaxed',
                  isDark ? 'text-gray-400' : 'text-gray-600',
                )}
              >
                <span className='font-medium text-gray-500 dark:text-gray-300'>
                  Why it matters:
                </span>{' '}
                A finished journey usually means a stronger{' '}
                <span className='font-medium'>Career Card</span> for employers. AvA helps you
                decide what to tackle next—open the chat when you want coaching, not guesswork.
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={openGuide}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0 sm:self-start',
              isDark
                ? 'bg-violet-500 text-white hover:bg-violet-400'
                : 'bg-violet-600 text-white hover:bg-violet-500',
            )}
          >
            <MessageCircle className='w-4 h-4 shrink-0' aria-hidden />
            Ask AvA
          </button>
        </div>

        <div
          className={cn(
            'rounded-xl border p-4',
            isDark ? 'border-gray-700/80 bg-gray-800/50' : 'border-gray-200 bg-gray-50',
          )}
        >
          <div className='flex items-center justify-between gap-2 mb-2'>
            <span
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wide',
                isDark ? 'text-gray-500' : 'text-gray-500',
              )}
            >
              Journey at a glance
            </span>
            <span
              className={cn('text-xs font-semibold tabular-nums', isDark ? 'text-gray-300' : 'text-gray-700')}
            >
              {progress.overallProgress}% · {doneCount}/{steps.length} steps
            </span>
          </div>
          <div
            className={cn('h-1.5 rounded-full overflow-hidden mb-3', isDark ? 'bg-gray-700' : 'bg-gray-200')}
          >
            <div
              className='h-full rounded-full bg-violet-500 transition-all duration-500'
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>
          <ul className='space-y-2 max-h-44 overflow-y-auto pr-1 text-left' aria-label='Journey steps'>
            {steps.map((step) => (
              <li key={step.id} className='flex items-start gap-2.5 text-xs'>
                <span className='mt-0.5 shrink-0' aria-hidden>
                  {step.status === 'complete' ? (
                    <Check className='w-3.5 h-3.5 text-green-500' strokeWidth={2.5} />
                  ) : step.status === 'in_progress' ? (
                    <span className='flex h-3.5 w-3.5 items-center justify-center'>
                      <span className='h-2 w-2 rounded-full bg-amber-500' />
                    </span>
                  ) : (
                    <span className='flex h-3.5 w-3.5 items-center justify-center'>
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full border-2',
                          isDark ? 'border-gray-500' : 'border-gray-400',
                        )}
                      />
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'leading-snug',
                    step.status === 'complete' && (isDark ? 'text-gray-500' : 'text-gray-500'),
                    step.status === 'in_progress' &&
                      (isDark ? 'text-amber-200 font-medium' : 'text-amber-800 font-medium'),
                    step.status === 'pending' && (isDark ? 'text-gray-300' : 'text-gray-800'),
                  )}
                >
                  {step.label}
                  {step.isOptional ? (
                    <span className={cn('font-normal', isDark ? 'text-gray-500' : 'text-gray-500')}>
                      {' '}
                      (optional)
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
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

// ── My Files ──────────────────────────────────────────────────────────────────
// Started or completed files: View (read-only), Edit, Verify (until on-chain), Delete.

function myFilesResumeCanView(doc: {
  type: string
  ipfsHash?: string | null
  structuredData?: unknown | null
}) {
  if (doc.type !== 'resume') return false
  const h = doc.ipfsHash
  const ipfs = Boolean(h && !String(h).startsWith('built_'))
  const sd = doc.structuredData
  const built = sd != null && typeof sd === 'object' && Object.keys(sd as object).length > 0
  return ipfs || built
}

interface HubDocument {
  id: string
  type: 'resume' | 'dotapp' | 'mvr'
  title: string
  subtitle?: string
  createdAt?: string
  status: 'complete' | 'in-progress' | 'processing'
  verified: boolean
  txHash: string | null
  canVerify: boolean
  canDelete: boolean
  editPage: PageType | null
  ipfsHash?: string | null
  structuredData?: unknown | null
  resumeSourceRole?: 'driver' | 'developer'
}

function MyFilesSection({ refreshKey }: { refreshKey: number }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const setEditingResumeId = useUIStore((s) => s.setEditingResumeId)
  const installedBlocks = useInstalledBlocks()

  const [documents, setDocuments] = useState<HubDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  /** Completed MVR: open viewer modal instead of the order form. */
  const [mvrViewOrderId, setMvrViewOrderId] = useState<string | null>(null)
  /** Completed DOT app: preview modal (hub returns userId for dot-app API). */
  const [hubUserId, setHubUserId] = useState<string | null>(null)
  /** Specific DOT application row for My Files preview (multi-app safe) */
  const [dotAppPreviewApplicationId, setDotAppPreviewApplicationId] = useState<string | null>(null)
  const [driverResumePreview, setDriverResumePreview] = useState<{
    title: string
    structuredData: Record<string, unknown>
  } | null>(null)
  const [devResumePreview, setDevResumePreview] = useState<HubDocument | null>(null)
  const [resumeFilePreview, setResumeFilePreview] = useState<{ title: string; url: string } | null>(null)
  const [resumePdfLoading, setResumePdfLoading] = useState(false)

  const hasResumeBlock = installedBlocks.some((b) =>
    b.blockType === 'driver-resume' || b.blockType === 'developer-resume'
  )
  const hasDotAppBlock = installedBlocks.some((b) => b.blockType === 'driver-dot-application')
  const hasMvrBlock = installedBlocks.some((b) => b.blockType === 'driver-mvr')

  const fetchDocuments = useCallback(async () => {
    if (!walletAddress || (!hasResumeBlock && !hasDotAppBlock && !hasMvrBlock)) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/driver/hub', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (!response.ok) { setLoading(false); return }

      const data = await response.json()
      if (typeof data.userId === 'string') setHubUserId(data.userId)
      const docs: HubDocument[] = []

      const hasDriverResumeBlock = installedBlocks.some((b) => b.blockType === 'driver-resume')
      const hasDeveloperResumeBlock = installedBlocks.some((b) => b.blockType === 'developer-resume')

      if (hasResumeBlock && data.resumes) {
        for (const resume of data.resumes) {
          const role = resume.sourceRole as 'driver' | 'developer' | undefined
          if (role === 'driver' && !hasDriverResumeBlock) continue
          if (role === 'developer' && !hasDeveloperResumeBlock) continue
          if (role !== 'driver' && role !== 'developer') continue
          docs.push({
            id: resume.id,
            type: 'resume',
            title: resume.title || 'Resume',
            status: 'complete',
            createdAt: resume.createdAt,
            verified: !!resume.blockchainTxHash,
            txHash: resume.blockchainTxHash,
            canVerify: !resume.blockchainTxHash,
            canDelete: true,
            editPage: 'resume',
            ipfsHash: resume.ipfsHash ?? null,
            structuredData: resume.structuredData ?? null,
            resumeSourceRole: role,
          })
        }
      }

      if (hasDotAppBlock && data.dotApplications) {
        for (const app of data.dotApplications) {
          const complete = !!app.isComplete
          docs.push({
            id: app.id,
            type: 'dotapp',
            title: 'DOT Application',
            status: complete ? 'complete' : 'in-progress',
            verified: !!app.blockchainTxHash,
            txHash: app.blockchainTxHash,
            canVerify: !!complete && !app.blockchainTxHash,
            canDelete: !app.blockchainTxHash,
            // View = preview modal; Edit = form (same page for completed + in-progress)
            editPage: 'dotapp',
          })
        }
      }

      // MVR orders — processing until completed
      if (hasMvrBlock && data.mvrRecords) {
        for (const mvr of data.mvrRecords) {
          const isComplete = mvr.orderStatus === 'completed' || mvr.orderStatus === 'needs_review'
          docs.push({
            id: mvr.id,
            type: 'mvr',
            title: 'Motor Vehicle Record',
            subtitle: mvr.licenseState,
            status: isComplete ? 'complete' : 'processing',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            // Completed MVRs open MvrViewModal from My Files; form page is for new orders only
            editPage: isComplete ? null : 'mvr',
          })
        }
      }

      setDocuments(docs)
    } catch (err) {
      console.error('MyFilesSection fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [walletAddress, hasResumeBlock, hasDotAppBlock, hasMvrBlock, installedBlocks])

  // `refreshKey` is incremented externally to trigger a manual re-fetch
  useEffect(() => { fetchDocuments() }, [fetchDocuments, refreshKey])

  const handleVerify = async (doc: HubDocument) => {
    if (!walletAddress || !doc.canVerify) return
    setVerifying(doc.id)
    setMessage({ type: 'success', text: 'Submitting to blockchain...' })

    try {
      const endpoint = doc.type === 'resume'
        ? `/api/resumes/${doc.id}/verify`
        : `/api/driver-applications/${doc.id}/verify`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
      })
      const data = await response.json()

      if (!response.ok && response.status !== 409) {
        throw new Error(data.error || 'Verification failed')
      }

      const txHash = data.txHash || data.transactionHash
      setMessage({ type: 'success', text: txHash ? `Verified! Tx: ${txHash.slice(0, 10)}...` : 'Already verified on blockchain' })
      setDocuments((prev) => prev.map((d) =>
        d.id === doc.id ? { ...d, verified: true, canVerify: false, txHash: txHash || d.txHash } : d
      ))
      setTimeout(() => setMessage(null), 5000)
      void syncDriverHubFromApi(walletAddress)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Verification failed' })
    } finally {
      setVerifying(null)
    }
  }

  const handleDelete = async (doc: HubDocument) => {
    if (!walletAddress) return
    setDeleting(doc.id)
    setConfirmDelete(null)

    try {
      const endpoint = doc.type === 'resume'
        ? `/api/resumes/${doc.id}`
        : `/api/driver-applications/${doc.id}`

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'x-wallet-address': walletAddress },
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete')
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      void syncDriverHubFromApi(walletAddress)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' })
    } finally {
      setDeleting(null)
    }
  }

  if (!hasResumeBlock && !hasDotAppBlock && !hasMvrBlock) return null
  if (loading) return null
  if (documents.length === 0) return null

  return (
    <>
    <div className={cn(
      'rounded-2xl border p-4',
      isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200',
    )}>
      {/* Header */}
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <FileText className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
          <p className={cn('text-xs font-bold uppercase tracking-wide', isDark ? 'text-gray-300' : 'text-gray-600')}>
            My Files
          </p>
        </div>
        <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
          {documents.length} {documents.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {/* Status message */}
      {message && (
        <div className={cn(
          'mb-3 px-3 py-2 rounded-lg text-xs',
          message.type === 'success'
            ? isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
            : isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-700',
        )}>
          {message.text}
        </div>
      )}

      <div className='space-y-2'>
        {documents.map((doc) => (
          <div key={doc.id}>
            <div className={cn(
              'flex items-center gap-3 p-3 rounded-xl transition-colors',
              isDark ? 'bg-gray-800/50' : 'bg-gray-50',
            )}>
              {/* Icon + info */}
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                doc.verified ? 'bg-green-500/20'
                  : doc.status === 'complete' ? (isDark ? 'bg-teal-500/20' : 'bg-teal-100')
                  : doc.status === 'processing' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100')
                  : isDark ? 'bg-gray-700' : 'bg-gray-200',
              )}>
                {doc.type === 'resume' ? (
                  <FileText className={cn('w-4 h-4', doc.verified ? 'text-green-400' : isDark ? 'text-gray-400' : 'text-gray-500')} />
                ) : doc.type === 'mvr' ? (
                  <Car className={cn(
                    'w-4 h-4',
                    doc.status === 'complete' ? (isDark ? 'text-teal-400' : 'text-teal-600')
                      : doc.status === 'processing' ? (isDark ? 'text-blue-400' : 'text-blue-600')
                      : isDark ? 'text-gray-400' : 'text-gray-500'
                  )} />
                ) : (
                  <ClipboardCheck className={cn('w-4 h-4', doc.verified ? 'text-green-400' : isDark ? 'text-gray-400' : 'text-gray-500')} />
                )}
              </div>

              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <p className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-gray-900')}>
                    {doc.title}
                    {doc.subtitle && <span className={cn('ml-1 font-normal', isDark ? 'text-gray-500' : 'text-gray-400')}>({doc.subtitle})</span>}
                  </p>
                  {doc.status === 'in-progress' && (
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700')}>
                      In Progress
                    </span>
                  )}
                  {doc.status === 'processing' && (
                    <span className={cn('flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700')}>
                      <Loader2 className='w-2.5 h-2.5 animate-spin' /> Processing
                    </span>
                  )}
                  {doc.status === 'complete' && doc.type === 'mvr' && (
                    <span className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-700')}>
                      <Check className='w-2.5 h-2.5' /> Complete
                    </span>
                  )}
                  {doc.verified && (
                    <span className='flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-500/15 text-green-500'>
                      <Check className='w-2.5 h-2.5' /> On-Chain
                    </span>
                  )}
                </div>
                {doc.verified && doc.txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${doc.txHash}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn('text-[11px] hover:underline', isDark ? 'text-teal-400' : 'text-teal-600')}
                  >
                    View transaction →
                  </a>
                )}
                {doc.type === 'mvr' && doc.status === 'complete' && (
                  <p className={cn('text-[10px] mt-1.5 leading-snug', isDark ? 'text-gray-500' : 'text-gray-500')}>
                    MVR is provider-certified. On-chain options (e.g. hash attestation) are possible later; we avoid
                    putting full MVR payloads on a public chain for privacy/FCRA reasons.
                  </p>
                )}
              </div>

              {/* Actions: View | Edit | Verify (until on-chain) | Delete */}
              <div className='flex flex-wrap items-center justify-end gap-1 flex-shrink-0 max-w-[min(100%,14rem)] sm:max-w-none'>
                {doc.status !== 'processing' && doc.type === 'resume' && myFilesResumeCanView(doc) && (
                  <button
                    type='button'
                    onClick={() => {
                      const ipfs = doc.ipfsHash && !String(doc.ipfsHash).startsWith('built_')
                      if (ipfs) {
                        setResumeFilePreview({
                          title: doc.title,
                          url: `https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`,
                        })
                        return
                      }
                      if (doc.resumeSourceRole === 'developer' && doc.structuredData) {
                        setDevResumePreview(doc)
                        return
                      }
                      if (doc.structuredData) {
                        setDriverResumePreview({
                          title: doc.title,
                          structuredData: doc.structuredData as Record<string, unknown>,
                        })
                      }
                    }}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'resume' && doc.editPage && (
                  <button
                    type='button'
                    onClick={() => {
                      setEditingResumeId(doc.id)
                      setCurrentPage(doc.editPage)
                    }}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <Pencil className='w-3 h-3' /> Edit
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'dotapp' && doc.status === 'complete' && hubUserId && (
                  <button
                    type='button'
                    onClick={() => setDotAppPreviewApplicationId(doc.id)}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'dotapp' && doc.editPage && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage(doc.editPage)}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <Pencil className='w-3 h-3' /> {doc.status === 'complete' ? 'Edit' : 'Continue'}
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'mvr' && doc.status === 'complete' && (
                  <button
                    type='button'
                    onClick={() => setMvrViewOrderId(doc.id)}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </button>
                )}

                {doc.canVerify && (
                  <button
                    type='button'
                    onClick={() => handleVerify(doc)}
                    disabled={verifying === doc.id}
                    className='inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-teal-500 text-white hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {verifying === doc.id ? <Loader2 className='w-3 h-3 animate-spin' /> : <ShieldCheck className='w-3 h-3' />}
                    Verify
                  </button>
                )}

                {doc.canDelete ? (
                  <button
                    type='button'
                    onClick={() => setConfirmDelete(doc.id)}
                    disabled={deleting === doc.id}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-red-50 text-red-600 hover:bg-red-100',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {deleting === doc.id ? <Loader2 className='w-3 h-3 animate-spin' /> : <Trash2 className='w-3 h-3' />}
                    Delete
                  </button>
                ) : doc.type === 'dotapp' ? (
                  <button
                    type='button'
                    disabled
                    title='This DOT application is verified on-chain. It cannot be deleted (audit / FMCSA trail).'
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold cursor-not-allowed opacity-45',
                      isDark ? 'text-gray-500' : 'text-gray-400',
                    )}
                  >
                    <Trash2 className='w-3 h-3' /> Delete
                  </button>
                ) : null}
              </div>
            </div>

            {/* Inline delete confirmation */}
            {confirmDelete === doc.id && (
              <div className={cn(
                'flex items-center justify-between px-3 py-2 rounded-xl mt-1 text-xs',
                isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200',
              )}>
                <span className={isDark ? 'text-red-400' : 'text-red-600'}>
                  Delete this file? This cannot be undone.
                </span>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className={cn('px-2 py-1 rounded', isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    className='px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600'
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
    <MvrViewModal
               isOpen={mvrViewOrderId !== null}
               onClose={() => setMvrViewOrderId(null)}
               walletAddress={walletAddress}
               orderId={mvrViewOrderId}
             />
    <DotAppPreviewModal
      isOpen={dotAppPreviewApplicationId !== null}
      onClose={() => setDotAppPreviewApplicationId(null)}
      userId={hubUserId}
      walletAddress={walletAddress}
      isDark={isDark}
      applicationId={dotAppPreviewApplicationId}
    />
    {resumeFilePreview && (
      <ResumeFilePreviewModal
        isOpen
        onClose={() => setResumeFilePreview(null)}
        title={resumeFilePreview.title}
        ipfsUrl={resumeFilePreview.url}
        isDark={isDark}
      />
    )}
    {driverResumePreview && (
      <ResumePreviewModal
        title={driverResumePreview.title}
        structuredData={
          driverResumePreview.structuredData as Parameters<
            typeof ResumePreviewModal
          >[0]['structuredData']
        }
        onClose={() => setDriverResumePreview(null)}
        onDownload={async () => {
          setResumePdfLoading(true)
          try {
            await downloadDriverResumePdfFromStructured(
              driverResumePreview.structuredData,
              driverResumePreview.title || 'Resume',
            )
          } catch (e) {
            console.error(e)
          } finally {
            setResumePdfLoading(false)
          }
        }}
        isDownloading={resumePdfLoading}
        theme={isDark ? 'dark' : 'light'}
        zIndex={10100}
      />
    )}
    {devResumePreview && walletAddress && (
      <DeveloperResumePreviewModal
        viewOnly
        resume={{
          id: devResumePreview.id,
          title: devResumePreview.title,
          structured_data: devResumePreview.structuredData as DeveloperResumeData,
          verification_status: devResumePreview.verified ? 'VERIFIED' : 'PENDING',
          blockchain_tx_hash: devResumePreview.txHash ?? undefined,
          ipfs_hash: devResumePreview.ipfsHash ?? undefined,
          created_at: devResumePreview.createdAt ?? new Date().toISOString(),
        }}
        onClose={() => setDevResumePreview(null)}
        onEdit={() => {}}
        onVerify={() => {}}
        onDelete={() => {}}
        userAddress={walletAddress}
      />
    )}
    </>
  )
}

// ── CandidateHub ─────────────────────────────────────────────────────────────

export default function CandidateHub() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  const [refreshKey, setRefreshKey] = useState(0)

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
        <AvaBanner />
        <MyFilesSection refreshKey={refreshKey} />

        {/* ── Block Hive ── */}
        <div>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                Block Hive
              </h2>
              <button
                onClick={() => {
                  if (walletAddress) fetchHubData(walletAddress)
                  setRefreshKey((k) => k + 1)
                }}
                disabled={isLoading}
                title='Refresh hub'
                className={cn(
                  'p-1 rounded-lg transition-all',
                  isLoading ? 'opacity-50 cursor-not-allowed' : '',
                  isDark ? 'hover:bg-gray-700 text-gray-500 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
                )}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              </button>
            </div>
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
                <HoneycombGrid
                  blocks={installedBlocks}
                  isEditing={isEditing}
                  walletAddress={walletAddress}
                  removeBlock={removeBlock}
                  setCurrentPage={setCurrentPage}
                />
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* ── Employer Requests ── */}
        {walletAddress && (
          <div className='pt-4'>
            <CandidateRequestsSection
              userAddress={walletAddress}
              onNavigateToResume={() => setCurrentPage('resume')}
              onNavigateToDotApp={() => setCurrentPage('dotapp')}
            />
          </div>
        )}

        {/* ── STORM Token Footer ── */}
        {walletAddress && (
          <div className='pt-4'>
            <STORMBalance
              walletAddress={walletAddress}
              onReadWhitepaper={() => setCurrentPage('stormchain')}
            />
          </div>
        )}
      </div>
    </>
  )
}
