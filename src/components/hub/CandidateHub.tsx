'use client'

import { useEffect, useCallback, useState } from 'react'
import { Plus, Loader2, AlertCircle, X, Eye, Pencil, Check, QrCode, ShieldCheck, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
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
import AskAvaButton from '@/components/ui/AskAvaButton'
import AvatarUpload from '@/components/ui/AvatarUpload'
import STORMBalance from '@/components/STORMBalance'
import CandidateRequestsSection from '@/components/CandidateRequestsSection'
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
// Radial honeycomb: slot 0 = center (larger), slots 1–6 spiral around it.
// Max 7 per page; 8+ blocks get paginated.
//
// Two hex sizes: the center hex is bigger to create visual hierarchy.
// Ring hexes are spaced so edges never overlap — positions are calculated
// from the midpoint between center and ring hex radii plus a gap.

const SLOTS_PER_PAGE = 7
const HIVE_GAP = 10 // px between hex edges

// Hex tile dimensions — three tiers: phone (<400), tablet (400–639), desktop (640+)
// Center hex is always larger than ring hexes to create visual hierarchy.
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

// Returns [left, top] offset from container center for each of the 7 slots.
// Offsets point to the CENTER of each hex — the render loop subtracts half-size.
//
// Ring distance is measured edge-to-edge: half the center hex + gap + half the
// ring hex, in both horizontal and vertical directions. The vertical axis uses
// the pointy-top hex ratio (≈ 0.865 of height = tip-to-center).
function hiveSlotOffsets(m: HiveMetrics): [number, number][] {
  // Horizontal distance from center of center-hex to center of a ring-hex
  const dx = m.centerW / 2 + HIVE_GAP + m.ringW / 2
  // Vertical distance (hex pointy-top geometry: center-to-tip ≈ h/2)
  const dy = m.centerH / 2 + HIVE_GAP + m.ringH / 2
  // Half-horizontal for the staggered top/bottom pairs
  const halfDx = dx * 0.52

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

  const metrics: HiveMetrics = sizeClass === 'xs'
    ? { centerW: CENTER_W_XS, centerH: CENTER_H_XS, ringW: RING_W_XS, ringH: RING_H_XS }
    : sizeClass === 'sm'
      ? { centerW: CENTER_W_SM, centerH: CENTER_H_SM, ringW: RING_W_SM, ringH: RING_H_SM }
      : { centerW: CENTER_W_LG, centerH: CENTER_H_LG, ringW: RING_W_LG, ringH: RING_H_LG }

  const slots = hiveSlotOffsets(metrics)

  const totalPages = Math.max(1, Math.ceil(blocks.length / SLOTS_PER_PAGE))

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1))
  }, [totalPages, page])

  const pageBlocks = blocks.slice(page * SLOTS_PER_PAGE, (page + 1) * SLOTS_PER_PAGE)

  // Container sized to fit the outermost hex edges.
  // Horizontal: middle-left/right extend dx from center, plus half a ring hex on each side.
  const dx = metrics.centerW / 2 + HIVE_GAP + metrics.ringW / 2
  const containerW = 2 * (dx + metrics.ringW / 2) + 16 // 16px breathing room
  // Vertical: top/bottom extend dy*0.92 from center, plus half a ring hex on each side.
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
                  index={page * SLOTS_PER_PAGE + slotIdx}
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
        <AskAvaButton label='Ask AvA — What should I do next?' />
        <VerificationBar />

        {/* ── Block Hive ── */}
        <div>
          <div className='flex items-center justify-between mb-4'>
            <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              Block Hive
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
