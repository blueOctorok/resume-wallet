'use client'

import Image from 'next/image'
import {
  useEffect,
  useCallback,
  useState,
  useRef,
  useMemo,
  useLayoutEffect,
  type ReactNode,
} from 'react'
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  Eye,
  Pencil,
  Check,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  ClipboardCheck,
  Car,
  Trash2,
  Globe,
  Github,
  Compass,
  Sparkles,
  LayoutGrid,
  Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore, useJourneyStore, usePreferencesStore } from '@/stores'
import type { PageType } from '@/stores/types'
import {
  useHubBlocksStore,
  useInstalledBlocks,
  useNeedsOnboarding,
  useIsEditMode,
  useStormiAutoWelcomeCandidateDone,
  useHubOnboarding,
} from '@/stores/hub-blocks-store'
import type { InstalledBlock } from '@/stores/hub-blocks-store'
import { getBlockColor, getBlockDefinition } from '@/lib/block-registry'
import { getBlockIllustration } from './BlockIllustrations'
import Button from '@/components/ui/Button'
import BlockCard from '@/components/ui/BlockCard'
import Card from '@/components/ui/Card'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import AvatarUpload from '@/components/ui/AvatarUpload'
import Avatar from '@/components/ui/Avatar'
import STORMBalance from '@/components/STORMBalance'
import CandidateRequestsSection from '@/components/CandidateRequestsSection'
import HubOnboardingForm from './HubOnboardingForm'
import BlockPickerModal from './BlockPickerModal'
import StormiWalkthrough from './StormiWalkthrough'
import StormiContextModal from './StormiContextModal'
import { candidateHubStaticSteps, type WalkthroughStep } from '@/lib/walkthrough-config'
import { fetchStormiWelcomeStep, WALKTHROUGH_AI_LOADING_STEP } from '@/lib/walkthrough-ai'
import MvrViewModal from '@/components/MvrViewModal'
import DotAppPreviewModal from '@/components/career-card/DotAppPreviewModal'
import ResumeFilePreviewModal from '@/components/hub/ResumeFilePreviewModal'
import { downloadDriverResumePdfFromStructured } from '@/lib/driver-resume-pdf-download'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { useHubContext } from '@/lib/ava-chat'
import { isSimpleModeEnabled } from '@/lib/feature-flags'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import ReferralBanner from './ReferralBanner'
import JobAlertsHubSection from './JobAlertsHubSection'
import StormiChatPanel from '@/components/stormi/StormiChatPanel'
import StormiNudgeBanner from '@/components/stormi/StormiNudgeBanner'
import CareerCardInsightsStrip from '@/components/hub/CareerCardInsightsStrip'
import CareerCardShareModal from '@/components/hub/CareerCardShareModal'
import HubSidebar from '@/components/hub/HubSidebar'
import DeveloperResumePreviewModal from '@/components/DeveloperResumePreviewModal'
import type { DeveloperResumeData } from '@/components/DeveloperResumeBuilder'
import { isLiveResumeIpfsHash } from '@/lib/resume-ipfs-guards'
import Atropos from 'atropos/react'
import {
  VaultCredentialChrome,
  vaultSlotForIndex,
  VAULT_SLOT_GRID_CLASS,
} from '@/components/hub/HubBlockVault'
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

// ── Block Tile — vault credential silhouette (chamfer + rim + sigil); accent from block registry ──

interface BlockTileProps {
  block: InstalledBlock
  index: number
  isEditing: boolean
  onRemove: () => void
  onOpen: (() => void) | null
  /** Center grid cell is larger (visual hierarchy). */
  slotIsCenter: boolean
}

function BlockTile({ block, index, isEditing, onRemove, onOpen, slotIsCenter }: BlockTileProps) {
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
  const label = block.definition?.label ?? block.blockType
  const description = block.definition?.description
  const tileTooltip = description ? `${label} — ${description}` : label

  const handleClick = () => {
    if (isEditing || !onOpen) return
    onOpen()
  }

  const defaultLightShadow =
    'drop-shadow(0 6px 18px rgba(15,23,42,0.12)) drop-shadow(0 0 28px rgba(13,148,136,0.2)) drop-shadow(0 0 48px rgba(91,33,182,0.1))'
  const defaultDarkShadow = 'drop-shadow(0 4px 18px rgba(0,0,0,0.45))'
  const [tileFilter, setTileFilter] = useState<string | undefined>(() =>
    !isEditing ? (isDark ? defaultDarkShadow : defaultLightShadow) : undefined,
  )

  useEffect(() => {
    if (!isEditing) setTileFilter(isDark ? defaultDarkShadow : defaultLightShadow)
    else setTileFilter(undefined)
  }, [isDark, isEditing])

  const tileContent = (
    <div
      className={cn(
        'relative h-full w-full min-h-0 transition-all duration-300',
        isDragging && 'z-20 scale-105 opacity-60',
        isEditing && !isDragging && 'cursor-grab active:cursor-grabbing',
        isEditing &&
          !isDragging &&
          (index % 2 === 0
            ? '[animation:jiggle_0.3s_ease-in-out_infinite]'
            : '[animation:jiggle-alt_0.28s_ease-in-out_infinite]'),
      )}
    >
      <VaultCredentialChrome
        isDark={isDark}
        glowColor={colors.glowColor}
        hasRoute={hasRoute}
        className='h-full min-h-0'
        style={{ filter: tileFilter }}
        onMouseEnter={() => {
          if (!isEditing && hasRoute) {
            setTileFilter(
              isDark
                ? `drop-shadow(0 10px 28px ${colors.glowColor})`
                : `${defaultLightShadow}, drop-shadow(0 8px 24px ${colors.glowColor})`,
            )
          }
        }}
        onMouseLeave={() => {
          if (!isEditing) setTileFilter(isDark ? defaultDarkShadow : defaultLightShadow)
        }}
      >
        {isEditing && (
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className='absolute top-2 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-red-500 shadow-lg transition-colors hover:bg-red-600'
            aria-label={`Remove ${label}`}
          >
            <X className='h-3.5 w-3.5 text-white' />
          </button>
        )}

        <div className='flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-[10%] pb-[12%] pt-[18%] text-center sm:px-[9%] sm:pb-[11%] sm:pt-[16%]'>
          {!isEditing && (
            <div className='flex min-h-[14px] flex-shrink-0 items-center justify-center'>
              {!hasRoute ? (
                <span
                  className={cn(
                    'rounded-md border border-dashed border-slate-300/80 px-1.5 py-0.5 text-[8px] font-medium tracking-wide text-slate-500 dark:border-gray-600 dark:bg-white/[0.06] dark:text-gray-500',
                    'bg-slate-50/90',
                  )}
                >
                  Coming soon
                </span>
              ) : (
                <div
                  className={cn(
                    'mx-auto h-2 w-2 rounded-full [animation:status-pulse_2s_ease-in-out_infinite]',
                    colors.badgeColor,
                  )}
                />
              )}
            </div>
          )}

          <div
            className={cn(
              'my-0.5 flex-shrink-0 sm:my-1',
              slotIsCenter
                ? '[&_svg]:h-10 [&_svg]:w-10 sm:[&_svg]:h-[2.85rem] sm:[&_svg]:w-[2.85rem]'
                : '[&_svg]:h-8 [&_svg]:w-8 sm:[&_svg]:h-9 sm:[&_svg]:w-9',
            )}
            data-atropos-offset='3'
          >
            <Illustration
              accentText={isDark ? colors.iconText.dark : colors.iconText.light}
              isDark={isDark}
            />
          </div>

          <p
            className={cn(
              'w-full flex-shrink-0 truncate font-semibold leading-tight tracking-tight',
              slotIsCenter ? 'text-[11px] sm:text-xs' : 'text-[10px] sm:text-[11px]',
              isDark ? colors.iconText.dark : 'text-slate-800',
            )}
          >
            {label}
          </p>

          {description && (
            <p
              className={cn(
                'mt-0.5 line-clamp-2 w-full flex-shrink-0 leading-snug',
                slotIsCenter ? 'text-[9px] sm:text-[10px]' : 'text-[8px] sm:text-[9px]',
                isDark ? 'text-gray-500' : 'text-slate-600',
              )}
            >
              {description}
            </p>
          )}
        </div>
      </VaultCredentialChrome>
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
      title={!isEditing ? tileTooltip : undefined}
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

// ── Vault grid layout ─────────────────────────────────────────────────────────
// Center tile + ring (7 slots desktop, 5 on narrow viewports — no mid-left/right).
// Topology matches HomePage showcase so marketing and product feel like one system.

const SLOTS_PER_PAGE_MOBILE = 5
const SLOTS_PER_PAGE_DESKTOP = 7

/** Dashed slot when the hive has room for more blocks on this page — opens block picker */
function EmptyVaultSlot({
  isCenter,
  isDark,
  onAdd,
}: {
  isCenter: boolean
  isDark: boolean
  onAdd: () => void
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      onClick={onAdd}
      aria-label='Add a block to this space'
      className={cn(
        'w-full flex-col gap-1.5 rounded-2xl border-2 border-dashed !px-2 !py-3 font-medium',
        isCenter ? 'min-h-[9.25rem] sm:min-h-[10.75rem]' : 'min-h-[6.5rem] sm:min-h-[7.25rem]',
        isDark
          ? '!border-teal-400/22 bg-gray-800/20 hover:!bg-gray-800/50 hover:!border-teal-400/38 text-gray-400 hover:text-gray-200'
          : '!border-slate-300/75 bg-slate-50/60 hover:!bg-teal-50/90 hover:!border-teal-500/35 text-slate-500 hover:text-slate-800',
      )}
    >
      <Plus className={cn('opacity-50', isCenter ? 'h-6 w-6' : 'h-5 w-5')} aria-hidden />
      <span className='text-[10px] font-semibold uppercase tracking-wider opacity-70'>Add block</span>
    </Button>
  )
}

function VaultHubGrid({
  blocks,
  isEditing,
  isDark,
  walletAddress,
  removeBlock,
  setCurrentPage,
  onAddBlock,
}: {
  blocks: InstalledBlock[]
  isEditing: boolean
  isDark: boolean
  walletAddress: string | null
  removeBlock: (id: string, wallet: string) => void
  setCurrentPage: (page: PageType) => void
  onAddBlock: () => void
}) {
  const [page, setPage] = useState(0)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const slotsPerPage = narrow ? SLOTS_PER_PAGE_MOBILE : SLOTS_PER_PAGE_DESKTOP
  const totalPages = Math.max(1, Math.ceil(blocks.length / slotsPerPage))

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1))
  }, [totalPages, page])

  const pageBlocks = blocks.slice(page * slotsPerPage, (page + 1) * slotsPerPage)

  return (
    <div className='flex w-full flex-col items-center'>
      <div
        className={cn(
          // sm+ was max-w-xl — ring tiles (1 col each) felt tight vs the 2-col center; 2xl gives outer tiles more title room.
          'mx-auto grid w-full max-w-md grid-cols-2 grid-rows-[auto_auto_auto] gap-3 sm:max-w-2xl sm:grid-cols-4 sm:grid-rows-3 sm:gap-4',
        )}
      >
        {Array.from({ length: slotsPerPage }).map((_, slotIdx) => {
          const slotId = vaultSlotForIndex(slotIdx, narrow)
          if (!slotId) return null
          const block = pageBlocks[slotIdx]
          const isCenter = slotId === 'center'
          const slotClass = cn(
            VAULT_SLOT_GRID_CLASS[slotId],
            isCenter ? 'min-h-[9.25rem] sm:min-h-[10.75rem]' : 'min-h-[6.5rem] sm:min-h-[7.25rem]',
            'flex min-h-0 w-full flex-col',
          )
          return (
            <div
              key={block?.id ?? `hub-empty-slot-${page}-${slotIdx}`}
              className={slotClass}
            >
              {block ? (
                <BlockTile
                  block={block}
                  index={page * slotsPerPage + slotIdx}
                  isEditing={isEditing}
                  slotIsCenter={isCenter}
                  onRemove={() => walletAddress && removeBlock(block.id, walletAddress)}
                  onOpen={
                    block.definition?.pageRoute
                      ? () => setCurrentPage(block.definition!.pageRoute as PageType)
                      : null
                  }
                />
              ) : (
                <EmptyVaultSlot isCenter={isCenter} isDark={isDark} onAdd={onAddBlock} />
              )}
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className='mt-4 flex items-center gap-3'>
          <button
            type='button'
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              page === 0
                ? 'cursor-not-allowed text-gray-400 dark:text-gray-600'
                : 'text-slate-600 hover:bg-slate-200 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
            )}
          >
            <ChevronLeft className='h-5 w-5' />
          </button>

          <div className='flex gap-1.5'>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type='button'
                onClick={() => setPage(i)}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  i === page
                    ? 'bg-teal-500 dark:bg-teal-400'
                    : 'bg-slate-300 hover:bg-slate-400 dark:bg-gray-600 dark:hover:bg-gray-500',
                )}
              />
            ))}
          </div>

          <button
            type='button'
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              page === totalPages - 1
                ? 'cursor-not-allowed text-gray-400 dark:text-gray-600'
                : 'text-slate-600 hover:bg-slate-200 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
            )}
          >
            <ChevronRight className='h-5 w-5' />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Profile header ───────────────────────────────────────────────────────────

function HubMiniCredentialChip({
  icon,
  label,
  done,
  isDark,
}: {
  icon: ReactNode
  label: string
  done: boolean
  isDark: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        done
          ? isDark
            ? 'border-teal-500/45 bg-teal-500/15 text-teal-200'
            : 'border-teal-500/35 bg-teal-50 text-teal-900'
          : isDark
            ? 'border-gray-600/80 bg-gray-800/50 text-gray-500'
            : 'border-slate-200 bg-slate-100/90 text-slate-500',
      )}
    >
      {icon}
      {label}
      {done ? <Check className='h-3 w-3 shrink-0 text-emerald-400' aria-hidden /> : null}
    </span>
  )
}

function CareerCardMiniPreview({
  isDark,
  displayName,
  headline,
  avatarUrl,
  completeness,
  installedBlocks,
}: {
  isDark: boolean
  displayName: string
  headline: string | null
  avatarUrl: string | null
  completeness: number
  installedBlocks: InstalledBlock[]
}) {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const types = installedBlocks.map((b) => b.blockType)
  const hasResume = types.some((t) => t.includes('resume') || t === 'storm-resume')
  const hasDot = types.includes('driver-dot-application')
  const hasMvr = types.includes('driver-mvr')
  const blockCount = installedBlocks.length
  const hasBlocks = blockCount > 0

  return (
    <div className='flex w-full flex-col gap-4'>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border p-4 sm:p-5',
          'shadow-[0_0_48px_-16px_rgba(20,184,166,0.55)]',
          isDark
            ? 'border-teal-500/40 bg-gradient-to-br from-gray-900/95 via-gray-900/80 to-teal-950/25'
            : 'border-teal-400/35 bg-gradient-to-br from-white via-teal-50/50 to-slate-50/95 shadow-sm',
        )}
      >
        <div
          className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent dark:via-teal-400/40'
          aria-hidden
        />
        <div
          className='pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal-400/10 blur-2xl dark:bg-teal-500/15'
          aria-hidden
        />

        <p
          className={cn(
            'mb-3 text-[10px] font-bold uppercase tracking-[0.2em]',
            isDark ? 'text-teal-300/90' : 'text-teal-800',
          )}
        >
          Career card preview
        </p>

        <div className='flex items-start gap-3'>
          <Avatar name={displayName} avatarUrl={avatarUrl} size='md' color='teal' />
          <div className='min-w-0 flex-1'>
            <p className={cn('truncate font-semibold', isDark ? 'text-white' : 'text-slate-900')}>{displayName}</p>
            <p className={cn('truncate text-xs', isDark ? 'text-gray-400' : 'text-slate-600')}>
              {headline || (hasBlocks ? 'Building your profile' : 'Add blocks to shape your card')}
            </p>
          </div>
          <div className='shrink-0 text-right'>
            <span
              className={cn(
                'text-lg font-bold tabular-nums',
                completeness >= 75
                  ? isDark
                    ? 'text-emerald-400'
                    : 'text-emerald-700'
                  : completeness >= 50
                    ? 'text-amber-500'
                    : isDark
                      ? 'text-gray-400'
                      : 'text-slate-600',
              )}
            >
              {completeness}%
            </span>
            <p className={cn('text-[10px]', isDark ? 'text-gray-500' : 'text-slate-500')}>complete</p>
          </div>
        </div>

        <div className='mt-3 flex flex-wrap gap-2'>
          <HubMiniCredentialChip
            icon={<FileText className='h-3 w-3 shrink-0' />}
            label='Resume'
            done={hasResume}
            isDark={isDark}
          />
          <HubMiniCredentialChip
            icon={<ClipboardCheck className='h-3 w-3 shrink-0' />}
            label='DOT'
            done={hasDot}
            isDark={isDark}
          />
          <HubMiniCredentialChip icon={<Car className='h-3 w-3 shrink-0' />} label='MVR' done={hasMvr} isDark={isDark} />
        </div>

        {!hasBlocks ? (
          <p className={cn('mt-3 text-xs leading-snug', isDark ? 'text-gray-400' : 'text-slate-600')}>
            Install blocks below — employers see this card when they view your profile.
          </p>
        ) : null}
      </div>

      {hasBlocks ? (
        <>
          {/* Same split as sidebar `MiniCareerCard`: half-width primary + secondary share */}
          <div className='flex w-full gap-2 sm:max-w-md'>
            <Button
              type='button'
              variant='primary'
              size='sm'
              title='Open your career card'
              onClick={() => setCurrentPage('career-card' as PageType)}
              className='min-w-0 flex-1 text-[11px] sm:text-xs'
            >
              <Eye className='mr-1 h-3.5 w-3.5 shrink-0 sm:mr-1.5 sm:h-4 sm:w-4' />
              <span className='sm:hidden'>View card</span>
              <span className='hidden sm:inline'>View career card</span>
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              title='Share link, image, QR, and embeds'
              onClick={() => setShareModalOpen(true)}
              className='min-w-0 flex-1 text-[11px] sm:text-xs'
            >
              <Share2 className='mr-1 h-3.5 w-3.5 shrink-0 sm:mr-1.5 sm:h-4 sm:w-4' />
              Share
            </Button>
          </div>
          <CareerCardShareModal
            isOpen={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            walletAddress={walletAddress}
            displayName={displayName}
          />
        </>
      ) : (
        <Button type='button' variant='primary' size='sm' onClick={openPicker} className='w-full sm:w-auto'>
          <Plus className='mr-1.5 h-4 w-4 shrink-0' />
          Browse blocks
        </Button>
      )}
    </div>
  )
}

function HubProfileHeader() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const onboarding = useHubBlocksStore((s) => s.onboarding)
  const openStormiContextModal = useHubBlocksStore((s) => s.openStormiContextModal)
  const updateAvatarUrl = useHubBlocksStore((s) => s.updateAvatarUrl)
  const updateUserProfile = useHubBlocksStore((s) => s.updateUserProfile)
  const installedBlocks = useInstalledBlocks()
  const needsOnboarding = useNeedsOnboarding()

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

  const completionChecks = [
    !!userProfile?.firstName,
    !!headline,
    !!userProfile?.avatarUrl,
    installedBlocks.length > 0,
  ]
  const completeness = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)

  const inputClass = cn(
    'w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500',
    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
  )

  return (
    <HubSectionPanel isDark={isDark} contentClassName='p-6 sm:p-7'>
      <div className='flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-6 xl:gap-8'>
        <div className='order-1 flex min-h-0 min-w-0 flex-1 flex-col items-center gap-5 text-center lg:order-1 lg:items-start lg:text-left lg:self-stretch'>
          <div className='relative shrink-0'>
            <AvatarUpload
              name={displayName}
              avatarUrl={userProfile?.avatarUrl ?? null}
              size='2xl'
              color='teal'
              uploadEndpoint='/api/user/avatar'
              walletAddress={walletAddress ?? ''}
              onSuccess={updateAvatarUrl}
              persistentUploadHint
              className='shrink-0'
            />
          </div>

          {isEditing ? (
            <div className='flex w-full min-w-0 max-w-md flex-col gap-2 lg:max-w-none'>
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
                <Button
                  type='button'
                  variant='primary'
                  size='sm'
                  onClick={saveProfile}
                  disabled={saving || !editFirst.trim() || !editLast.trim()}
                  isLoading={saving}
                >
                  {!saving ? <Check className='w-3.5 h-3.5' /> : null}
                  Save
                </Button>
                <Button type='button' variant='secondary' size='sm' onClick={cancelEditing} className='gap-1'>
                  <X className='w-3.5 h-3.5' />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className='w-full min-w-0 max-w-md lg:max-w-none'>
              <div className='flex items-center justify-center gap-2 lg:justify-start'>
                <h1
                  className={cn(
                    'text-2xl font-bold sm:text-3xl lg:text-4xl',
                    isDark ? 'text-white' : 'text-slate-800',
                  )}
                >
                  {displayName}
                </h1>
                <button
                  type='button'
                  onClick={startEditing}
                  className={cn(
                    'rounded-lg p-1 transition-colors',
                    isDark
                      ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
                  )}
                  title='Edit profile'
                >
                  <Pencil className='h-4 w-4' />
                </button>
              </div>
              {headline ? (
                <p className={cn('mt-1 text-sm', isDark ? 'text-teal-400' : 'text-teal-600')}>{headline}</p>
              ) : (
                <p className={cn('mt-1 text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
                  Complete onboarding to set your role
                </p>
              )}
              {!needsOnboarding && onboarding && (
                <div className='mt-2 flex justify-center lg:justify-start'>
                  <button
                    type='button'
                    onClick={() => openStormiContextModal()}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium transition-colors',
                      isDark
                        ? 'text-teal-400/90 hover:text-teal-300'
                        : 'text-teal-700 hover:text-teal-800',
                    )}
                    aria-label='Edit what you do and why you are here for Stormi'
                  >
                    <Sparkles className='h-3.5 w-3.5 shrink-0' />
                    Edit what you told Stormi
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className='order-2 flex w-full min-w-0 shrink-0 flex-col justify-start gap-4 lg:order-2 lg:max-w-md lg:min-h-0 lg:flex-1 lg:justify-center xl:max-w-lg'>
          <CareerCardMiniPreview
            isDark={isDark}
            displayName={displayName}
            headline={headline}
            avatarUrl={userProfile?.avatarUrl ?? null}
            completeness={completeness}
            installedBlocks={installedBlocks}
          />

          <div>
            <div className='mb-2 flex items-center justify-between'>
              <span className={cn('text-sm font-semibold', isDark ? 'text-gray-300' : 'text-slate-700')}>
                Profile completeness
              </span>
              <span
                className={cn(
                  'text-lg font-bold',
                  completeness >= 75
                    ? isDark
                      ? 'text-green-500'
                      : 'text-emerald-800'
                    : completeness >= 50
                      ? 'text-yellow-500'
                      : isDark
                        ? 'text-gray-400'
                        : 'text-slate-600',
                )}
              >
                {completeness}%
              </span>
            </div>
            <div
              className={cn(
                'h-3 overflow-hidden rounded-full ring-1 ring-inset',
                isDark ? 'bg-gray-800 ring-gray-600/50' : 'bg-slate-200/95 ring-slate-400/55',
              )}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isDark ? 'shadow-[0_0_12px_rgba(20,184,166,0.35)]' : 'shadow-[0_0_10px_rgba(13,148,136,0.28)]',
                  completeness >= 75
                    ? isDark
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600'
                    : completeness >= 50
                      ? isDark
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                        : 'bg-gradient-to-r from-amber-600 to-amber-500'
                      : isDark
                        ? 'bg-gradient-to-r from-teal-400 to-cyan-500'
                        : 'bg-gradient-to-r from-teal-600 to-teal-500',
                )}
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </HubSectionPanel>
  )
}

/** Icon-only expand/collapse for hub BlockCard headers (preference lives in `usePreferencesStore`). */
function HubSectionCollapseToggle({
  expanded,
  onToggle,
  sectionLabel,
  isDark,
}: {
  expanded: boolean
  onToggle: () => void
  sectionLabel: string
  isDark: boolean
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className={cn(
        'shrink-0 px-2',
        isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-800',
      )}
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${sectionLabel}` : `Expand ${sectionLabel}`}
      onClick={onToggle}
    >
      {expanded ? <ChevronUp className='h-4 w-4' aria-hidden /> : <ChevronDown className='h-4 w-4' aria-hidden />}
    </Button>
  )
}

// ── Block Files ───────────────────────────────────────────────────────────────
// Started or completed files: View (read-only), Edit, Verify (until on-chain), Delete.

function myFilesResumeCanView(doc: {
  type: string
  ipfsHash?: string | null
  structuredData?: unknown | null
}) {
  if (doc.type !== 'resume') return false
  const h = doc.ipfsHash
  const ipfs = isLiveResumeIpfsHash(h ?? undefined)
  const sd = doc.structuredData
  const built = sd != null && typeof sd === 'object' && Object.keys(sd as object).length > 0
  return ipfs || built
}

interface HubDocument {
  id: string
  type: 'resume' | 'dotapp' | 'mvr' | 'portfolio' | 'github' | 'employment_verifications'
  title: string
  subtitle?: string
  createdAt?: string
  /** `empty` = block installed but no artifact yet (show in My Files immediately) */
  status: 'complete' | 'in-progress' | 'processing' | 'empty'
  verified: boolean
  txHash: string | null
  canVerify: boolean
  canDelete: boolean
  editPage: PageType | null
  ipfsHash?: string | null
  structuredData?: unknown | null
  resumeSourceRole?: 'driver' | 'developer' | 'general'
  /** Set when type === 'portfolio' — opens in new tab for View */
  portfolioUrl?: string | null
  /** Set when type === 'github' — link to profile */
  githubUsername?: string | null
  /** When opening STORM Resume from My Files — default tab */
  stormResumeInitialPanel?: 'upload' | 'general' | 'driver' | 'developer'
}

function MyFilesSection({ refreshKey }: { refreshKey: number }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const setEditingResumeId = useUIStore((s) => s.setEditingResumeId)
  const setStormResumeInitialPanel = useUIStore((s) => s.setStormResumeInitialPanel)
  const installedBlocks = useInstalledBlocks()
  const hubBlockFilesExpanded = usePreferencesStore((s) => s.hubBlockFilesExpanded ?? true)
  const setHubBlockFilesExpanded = usePreferencesStore((s) => s.setHubBlockFilesExpanded)

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
    b.blockType === 'storm-resume' ||
    b.blockType === 'driver-resume' ||
    b.blockType === 'developer-resume' ||
    b.blockType === 'general-resume'
  )
  const hasDotAppBlock = installedBlocks.some((b) => b.blockType === 'driver-dot-application')
  const hasMvrBlock = installedBlocks.some((b) => b.blockType === 'driver-mvr')
  const hasPortfolioBlock = installedBlocks.some((b) => b.blockType === 'developer-portfolio')
  const hasGithubBlock = installedBlocks.some((b) => b.blockType === 'developer-github')
  const hasEmploymentVerificationBlock = installedBlocks.some(
    (b) => b.blockType === 'general-employment-verification',
  )
  const needsHubData =
    hasResumeBlock || hasDotAppBlock || hasMvrBlock || hasPortfolioBlock || hasGithubBlock
  const hasAnyFileSectionBlock = needsHubData || hasEmploymentVerificationBlock

  const fetchDocuments = useCallback(async () => {
    if (!walletAddress || !hasAnyFileSectionBlock) {
      setLoading(false)
      return
    }

    try {
      const docs: HubDocument[] = []

      if (needsHubData) {
      const response = await fetch('/api/driver/hub', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (!response.ok) { setLoading(false); return }

      const data = await response.json()
      if (typeof data.userId === 'string') setHubUserId(data.userId)

      const hasStormResumeBlock = installedBlocks.some((b) => b.blockType === 'storm-resume')
      const hasDriverResumeBlock = installedBlocks.some((b) => b.blockType === 'driver-resume')
      const hasDeveloperResumeBlock = installedBlocks.some((b) => b.blockType === 'developer-resume')
      const hasGeneralResumeBlock = installedBlocks.some((b) => b.blockType === 'general-resume')
      const allowDriverResume = hasDriverResumeBlock || hasStormResumeBlock
      const allowDeveloperResume = hasDeveloperResumeBlock || hasStormResumeBlock
      const allowGeneralResume = hasGeneralResumeBlock || hasStormResumeBlock

      if (hasResumeBlock && data.resumes) {
        for (const resume of data.resumes) {
          const role = resume.sourceRole as 'driver' | 'developer' | 'general' | undefined
          if (role === 'driver' && !allowDriverResume) continue
          if (role === 'developer' && !allowDeveloperResume) continue
          if (role === 'general' && !allowGeneralResume) continue
          if (role !== 'driver' && role !== 'developer' && role !== 'general') continue
          const isBuilt =
            resume.resumeType === 'built' || resume.resumeType === 'developer_built'
          const uploadedCanVerify =
            !isBuilt &&
            !resume.blockchainTxHash &&
            isLiveResumeIpfsHash(resume.ipfsHash ?? null)
          docs.push({
            id: resume.id,
            type: 'resume',
            title: resume.title || 'Resume',
            status: 'complete',
            createdAt: resume.createdAt,
            verified: !!resume.blockchainTxHash,
            txHash: resume.blockchainTxHash,
            canVerify: Boolean(
              !resume.blockchainTxHash &&
                ((isBuilt && resume.structuredData) || uploadedCanVerify),
            ),
            canDelete: true,
            editPage: hasStormResumeBlock
              ? 'storm-resume'
              : role === 'developer'
                ? 'developer-resume'
                : role === 'general'
                  ? 'general-resume'
                  : 'resume',
            ipfsHash: resume.ipfsHash ?? null,
            structuredData: resume.structuredData ?? null,
            resumeSourceRole: role,
          })
        }
      }

      // Resume block installed but no resume row yet — same pattern as portfolio/GitHub placeholders
      const resumeRows = docs.filter((d) => d.type === 'resume').length
      if (hasResumeBlock && resumeRows === 0) {
        const editPage: PageType = hasStormResumeBlock
          ? 'storm-resume'
          : hasDriverResumeBlock
            ? 'resume'
            : hasGeneralResumeBlock
              ? 'general-resume'
              : 'developer-resume'
        const resumeSourceRole: 'driver' | 'developer' | 'general' = hasStormResumeBlock
          ? 'general'
          : hasDriverResumeBlock
            ? 'driver'
            : hasGeneralResumeBlock
              ? 'general'
              : 'developer'
        docs.push({
          id: 'resume-hub-placeholder',
          type: 'resume',
          title: 'Resume',
          status: 'empty',
          verified: false,
          txHash: null,
          canVerify: false,
          canDelete: false,
          editPage,
          ipfsHash: null,
          structuredData: null,
          resumeSourceRole,
          stormResumeInitialPanel: hasStormResumeBlock ? 'upload' : undefined,
        })
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

      if (hasDotAppBlock && (!data.dotApplications || data.dotApplications.length === 0)) {
        docs.push({
          id: 'dotapp-hub-placeholder',
          type: 'dotapp',
          title: 'DOT Application',
          status: 'empty',
          verified: false,
          txHash: null,
          canVerify: false,
          canDelete: false,
          editPage: 'dotapp',
        })
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

      if (hasMvrBlock && (!data.mvrRecords || data.mvrRecords.length === 0)) {
        docs.push({
          id: 'mvr-hub-placeholder',
          type: 'mvr',
          title: 'Motor Vehicle Record',
          subtitle: 'Not ordered yet',
          status: 'empty',
          verified: false,
          txHash: null,
          canVerify: false,
          canDelete: false,
          editPage: 'mvr',
        })
      }

      // Portfolio block — one row when user has the block (URL set = complete, else in-progress)
      if (hasPortfolioBlock) {
        const portfolioUrl = data.portfolio?.portfolioUrl ?? null
        docs.push({
          id: 'portfolio',
          type: 'portfolio',
          title: 'Portfolio',
          status: portfolioUrl ? 'complete' : 'in-progress',
          verified: false,
          txHash: null,
          canVerify: false,
          canDelete: false,
          editPage: 'portfolio',
          portfolioUrl,
        })
      }

      // GitHub block — one row when user has the block (connected = complete, else in-progress)
      if (hasGithubBlock) {
        const username = data.github?.username ?? null
        docs.push({
          id: 'github',
          type: 'github',
          title: 'GitHub Activity',
          status: username ? 'complete' : 'in-progress',
          verified: false,
          txHash: null,
          canVerify: false,
          canDelete: false,
          editPage: 'github',
          githubUsername: username,
        })
      }
      }

      if (hasEmploymentVerificationBlock) {
        const vr = await fetch('/api/candidate/verification/status?initiatedBy=applicant', {
          headers: { 'x-wallet-address': walletAddress },
        })
        if (vr.ok) {
          const j = (await vr.json()) as {
            requests?: Array<{ status: string }>
          }
          const reqs = j.requests ?? []
          const verified = reqs.filter(
            (r) => r.status === 'VERIFIED' || r.status === 'PARTIALLY_VERIFIED',
          ).length
          const pending = reqs.filter((r) =>
            ['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'].includes(r.status),
          ).length
          docs.push({
            id: 'employment-verifications',
            type: 'employment_verifications',
            title: 'Employment verifications',
            subtitle: `${verified} verified · ${pending} pending`,
            status: pending > 0 ? 'in-progress' : 'complete',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            editPage: 'employment-verification',
          })
        }
      }

      setDocuments(docs)
    } catch (err) {
      console.error('MyFilesSection fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [
    walletAddress,
    hasResumeBlock,
    hasDotAppBlock,
    hasMvrBlock,
    hasPortfolioBlock,
    hasGithubBlock,
    hasEmploymentVerificationBlock,
    needsHubData,
    hasAnyFileSectionBlock,
    installedBlocks,
  ])

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
    if (!walletAddress || doc.type === 'employment_verifications') return
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

  const inProgressCount = documents.filter(
    (d) =>
      d.status === 'in-progress' ||
      d.status === 'processing' ||
      d.status === 'empty',
  ).length
  const filesSummary =
    !hasAnyFileSectionBlock
      ? 'Add resume, DOT, MVR, or verification blocks below'
      : loading
        ? 'Loading your artifacts…'
        : `${documents.length} ${documents.length === 1 ? 'file' : 'files'}${
            inProgressCount > 0 ? ` · ${inProgressCount} in progress` : ''
          }`

  // Keep onboarding copy visible until user installs file-capable blocks; then respect collapse pref.
  const showFilesPanel = !hasAnyFileSectionBlock || hubBlockFilesExpanded

  return (
    <>
    {/* Same chrome as Block Hive — `HubSectionPanel` + `BlockCard variant='embed'` */}
    <HubSectionPanel isDark={isDark}>
      <BlockCard
        variant='embed'
        icon={FileText}
        title='Block files'
        description='Resume · DOT · MVR · portfolio · GitHub · verifications'
        headerActions={
          <>
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                isDark ? 'text-gray-400' : 'text-slate-500',
              )}
            >
              {filesSummary}
            </span>
            {hasAnyFileSectionBlock && (
              <HubSectionCollapseToggle
                expanded={hubBlockFilesExpanded}
                onToggle={() => setHubBlockFilesExpanded(!hubBlockFilesExpanded)}
                sectionLabel='Block files'
                isDark={isDark}
              />
            )}
          </>
        }
      >
      {showFilesPanel && (
      <>
      {/* Empty state: no file-related blocks installed */}
      {!hasAnyFileSectionBlock && (
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
          Install a Resume, DOT Application, MVR, or Employment Verification block from the Block Hive below to manage your files here.
        </p>
      )}

      {/* Loading: has blocks but still fetching */}
      {hasAnyFileSectionBlock && loading && (
        <div className='flex items-center justify-center py-8'>
          <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
        </div>
      )}

      {/* Empty state: has blocks but no documents yet */}
      {hasAnyFileSectionBlock && !loading && documents.length === 0 && (
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
          Nothing to list yet — try refreshing. Installed blocks normally show a row here right away (Not started until you open the block).
        </p>
      )}

      {/* Status message and document list — only when we have docs to show */}
      {hasAnyFileSectionBlock && !loading && documents.length > 0 && (
        <>
      {message && (
        <div className={cn(
          'mb-3 px-3 py-2 rounded-lg text-xs',
          message.type === 'success'
            ? isDark
              ? 'bg-green-500/15 text-green-400'
              : 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-800/20'
            : isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-700',
        )}>
          {message.text}
        </div>
      )}

      <div className={cn('divide-y', isDark ? 'divide-gray-700/70' : 'divide-slate-200/90')}>
        {documents.map((doc) => (
          <div key={doc.id}>
            <div className='flex flex-col gap-3 py-5 first:pt-2 last:pb-2 sm:flex-row sm:items-center sm:gap-5 sm:py-6'>
              {/* Icon + info — full width row on mobile; actions stack below so they never overlap title text */}
              <div className='flex min-w-0 flex-1 gap-4'>
              <div className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset sm:h-12 sm:w-12',
                doc.verified
                  ? isDark ? 'bg-green-500/20 ring-transparent' : 'bg-emerald-100 ring-emerald-800/25'
                  : doc.status === 'complete' ? (isDark ? 'bg-teal-500/20 ring-transparent' : 'bg-teal-100 ring-teal-700/20')
                  : doc.status === 'processing' ? (isDark ? 'bg-blue-500/20 ring-transparent' : 'bg-blue-100 ring-blue-800/15')
                  : isDark ? 'bg-gray-700 ring-transparent' : 'bg-slate-200 ring-slate-400/35',
              )}>
                {doc.type === 'resume' ? (
                  <FileText className={cn(
                    'w-4 h-4',
                    doc.verified ? (isDark ? 'text-green-400' : 'text-emerald-800') : isDark ? 'text-gray-400' : 'text-slate-600',
                  )} />
                ) : doc.type === 'mvr' ? (
                  <Car className={cn(
                    'w-4 h-4',
                    doc.status === 'complete' ? (isDark ? 'text-teal-400' : 'text-teal-600')
                      : doc.status === 'processing' ? (isDark ? 'text-blue-400' : 'text-blue-600')
                      : isDark ? 'text-gray-400' : 'text-slate-600'
                  )} />
                ) : doc.type === 'portfolio' ? (
                  <Globe className={cn('w-4 h-4', doc.status === 'complete' ? (isDark ? 'text-teal-400' : 'text-teal-600') : isDark ? 'text-gray-400' : 'text-slate-600')} />
                ) : doc.type === 'github' ? (
                  <Github className={cn('w-4 h-4', doc.status === 'complete' ? (isDark ? 'text-teal-400' : 'text-teal-600') : isDark ? 'text-gray-400' : 'text-slate-600')} />
                ) : doc.type === 'employment_verifications' ? (
                  <ShieldCheck className={cn('w-4 h-4', doc.status === 'in-progress' ? (isDark ? 'text-yellow-400' : 'text-yellow-600') : isDark ? 'text-violet-400' : 'text-violet-600')} />
                ) : (
                  <ClipboardCheck className={cn(
                    'w-4 h-4',
                    doc.verified ? (isDark ? 'text-green-400' : 'text-emerald-800') : isDark ? 'text-gray-400' : 'text-slate-600',
                  )} />
                )}
              </div>

              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2 sm:gap-2.5'>
                  <p className={cn('text-base font-medium leading-snug break-words', isDark ? 'text-white' : 'text-slate-800')}>
                    {doc.title}
                    {doc.subtitle && <span className={cn('ml-1 font-normal', isDark ? 'text-gray-500' : 'text-gray-400')}>({doc.subtitle})</span>}
                  </p>
                  {doc.status === 'empty' && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                        isDark ? 'bg-gray-600/35 text-gray-300' : 'bg-slate-200 text-slate-700',
                      )}
                    >
                      Not started
                    </span>
                  )}
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
                  {doc.status === 'complete' && !doc.verified && (
                    <span className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-700')}>
                      <Check className='w-2.5 h-2.5' /> Completed
                    </span>
                  )}
                  {doc.verified && (
                    <span className={cn(
                      'flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium',
                      isDark ? 'bg-green-500/15 text-green-500' : 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-800/25',
                    )}>
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
                {doc.type === 'portfolio' && doc.portfolioUrl && (
                  <p className={cn('text-[11px] mt-0.5 break-all sm:truncate', isDark ? 'text-gray-400' : 'text-slate-600')}>
                    {doc.portfolioUrl}
                  </p>
                )}
                {doc.type === 'github' && doc.githubUsername && (
                  <p className={cn('text-[11px] mt-0.5 break-all sm:truncate', isDark ? 'text-gray-400' : 'text-slate-600')}>
                    @{doc.githubUsername}
                  </p>
                )}
              </div>
              </div>

              {/* Actions: View | Edit | Verify (until on-chain) | Delete */}
              <div className='flex w-full max-w-none flex-shrink-0 flex-wrap items-stretch gap-2 sm:w-auto sm:justify-end'>
                {doc.type === 'portfolio' && doc.portfolioUrl && (
                  <a
                    href={doc.portfolioUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </a>
                )}
                {doc.type === 'portfolio' && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage('portfolio')}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Pencil className='w-3 h-3' /> Edit
                  </button>
                )}
                {doc.type === 'github' && doc.githubUsername && (
                  <a
                    href={`https://github.com/${doc.githubUsername}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </a>
                )}
                {doc.type === 'github' && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage('github')}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Pencil className='w-3 h-3' /> Edit
                  </button>
                )}
                {doc.type === 'employment_verifications' && doc.editPage && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage(doc.editPage)}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Pencil className='w-3 h-3' /> Manage
                  </button>
                )}
                {doc.status !== 'processing' && doc.type === 'resume' && myFilesResumeCanView(doc) && (
                  <button
                    type='button'
                    onClick={() => {
                      if (isLiveResumeIpfsHash(doc.ipfsHash)) {
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
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'resume' && doc.editPage && (
                  <button
                    type='button'
                    onClick={() => {
                      if (doc.id !== 'resume-hub-placeholder') setEditingResumeId(doc.id)
                      else setEditingResumeId(undefined)
                      if (doc.editPage === 'storm-resume') {
                        const p =
                          doc.stormResumeInitialPanel ??
                          (doc.resumeSourceRole === 'driver'
                            ? 'driver'
                            : doc.resumeSourceRole === 'developer'
                              ? 'developer'
                              : 'general')
                        setStormResumeInitialPanel(p)
                      }
                      setCurrentPage(doc.editPage)
                    }}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
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
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
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
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Pencil className='w-3 h-3' />{' '}
                    {doc.status === 'complete' ? 'Edit' : doc.status === 'empty' ? 'Start' : 'Continue'}
                  </button>
                )}

                {doc.type === 'mvr' && doc.editPage && doc.status !== 'complete' && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage('mvr')}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100',
                    )}
                  >
                    {doc.status === 'empty' ? 'Order MVR' : 'Open'}
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'mvr' && doc.status === 'complete' && (
                  <button
                    type='button'
                    onClick={() => setMvrViewOrderId(doc.id)}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
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
        </>
      )}
      </>
      )}
      </BlockCard>
    </HubSectionPanel>
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
  const showProfileSetup = useAuthStore((s) => s.showProfileSetup)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const hubRefreshNonce = useUIStore((s) => s.hubRefreshNonce)
  const requestWalkthroughReplay = useJourneyStore((s) => s.requestWalkthroughReplay)
  const walkthroughRequestNonce = useJourneyStore((s) => s.walkthroughRequestNonce)
  const clearWalkthroughRequest = useJourneyStore((s) => s.clearWalkthroughRequest)

  const [refreshKey, setRefreshKey] = useState(0)
  const lastHubRefreshNonce = useRef<number | null>(null)

  const isLoading = useHubBlocksStore((s) => s.isLoading)
  const fetchError = useHubBlocksStore((s) => s.fetchError)
  const fetchHubData = useHubBlocksStore((s) => s.fetchHubData)
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const removeBlock = useHubBlocksStore((s) => s.removeBlock)
  const reorderBlocks = useHubBlocksStore((s) => s.reorderBlocks)
  const setEditMode = useHubBlocksStore((s) => s.setEditMode)
  const setStormiAutoWelcomeCandidateDone = useHubBlocksStore((s) => s.setStormiAutoWelcomeCandidateDone)

  const installedBlocks = useInstalledBlocks()
  const hubContext = useHubContext()
  const stormiAutoWelcomeCandidateDone = useStormiAutoWelcomeCandidateDone()
  const needsOnboarding = useNeedsOnboarding()
  const isStormiContextModalOpen = useHubBlocksStore((s) => s.isStormiContextModalOpen)
  const isEditing = useIsEditMode()

  const hubYourBlocksExpanded = usePreferencesStore((s) => s.hubYourBlocksExpanded ?? true)
  const setHubYourBlocksExpanded = usePreferencesStore((s) => s.setHubYourBlocksExpanded)

  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const walkthroughDismissed = useHubBlocksStore((s) => s.walkthroughDismissed)
  const setWalkthroughDismissed = useHubBlocksStore((s) => s.setWalkthroughDismissed)
  const onboarding = useHubOnboarding()

  /** After dismiss (X / Done / Browse), hide until next login or Journey Guide — not persisted (DB flag is separate). */
  const [walkthroughSuppressedThisSession, setWalkthroughSuppressedThisSession] = useState(false)

  const hubStaticSteps = useMemo(
    () =>
      candidateHubStaticSteps({
        firstName: userProfile?.firstName ?? '',
        occupation: onboarding?.occupation ?? '',
        seekingReason: onboarding?.seekingReason ?? '',
        hasBlocks: installedBlocks.length > 0,
      }),
    [
      userProfile?.firstName,
      onboarding?.occupation,
      onboarding?.seekingReason,
      installedBlocks.length,
    ],
  )

  const [aiWelcomeStep, setAiWelcomeStep] = useState<WalkthroughStep | null>(null)
  const [isLoadingAiStep, setIsLoadingAiStep] = useState(false)
  const hubContextRef = useRef(hubContext)
  hubContextRef.current = hubContext

  /** Per-wallet: `walkthroughDismissed` from DB. Per-session: suppressed after dismiss until replay / new login. */
  useEffect(() => {
    setWalkthroughSuppressedThisSession(false)
  }, [walletAddress, walkthroughRequestNonce])

  /** Block-styled walkthrough — after questionnaire + name; every hub load unless DB opted out or suppressed this session */
  const showStormiWalkthrough =
    !isLoading &&
    !fetchError &&
    !needsOnboarding &&
    !showProfileSetup &&
    Boolean(userProfile?.firstName?.trim()) &&
    (!walkthroughDismissed || requestWalkthroughReplay) &&
    (!walkthroughSuppressedThisSession || requestWalkthroughReplay) &&
    // Guided mode teaches job-first; hub walkthrough stays available via nav replay only.
    !isSimpleModeEnabled()

  const walkthroughSteps = useMemo(() => {
    if (isLoadingAiStep && !aiWelcomeStep) {
      return [WALKTHROUGH_AI_LOADING_STEP, ...hubStaticSteps]
    }
    if (aiWelcomeStep) {
      return [aiWelcomeStep, ...hubStaticSteps]
    }
    return hubStaticSteps
  }, [isLoadingAiStep, aiWelcomeStep, hubStaticSteps])

  useLayoutEffect(() => {
    if (!showStormiWalkthrough || !walletAddress) {
      setIsLoadingAiStep(false)
      setAiWelcomeStep(null)
      return
    }
    setIsLoadingAiStep(true)
    setAiWelcomeStep(null)
  }, [showStormiWalkthrough, walletAddress, requestWalkthroughReplay, walkthroughRequestNonce])

  useEffect(() => {
    if (!showStormiWalkthrough || !walletAddress) return
    let cancelled = false
    void (async () => {
      try {
        const step = await fetchStormiWelcomeStep(
          walletAddress,
          hubContextRef.current,
          userProfile?.firstName ?? '',
        )
        if (!cancelled) setAiWelcomeStep(step)
      } finally {
        if (!cancelled) setIsLoadingAiStep(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    showStormiWalkthrough,
    walletAddress,
    userProfile?.firstName,
    requestWalkthroughReplay,
    walkthroughRequestNonce,
  ])

  const showYourBlocksPanel = installedBlocks.length === 0 || hubYourBlocksExpanded

  const handleWalkthroughComplete = useCallback(() => {
    setWalkthroughSuppressedThisSession(true)
    clearWalkthroughRequest()
  }, [clearWalkthroughRequest])

  const handleWalkthroughDisableAll = useCallback(async () => {
    if (!walletAddress) return
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ walkthrough_dismissed: true }),
      })
      if (res.ok) {
        setWalkthroughDismissed(true)
      }
    } catch {
      /* user asked to opt out — still suppress locally if PATCH fails */
    }
    setWalkthroughSuppressedThisSession(true)
    clearWalkthroughRequest()
  }, [walletAddress, setWalkthroughDismissed, clearWalkthroughRequest])

  useEffect(() => {
    if (walletAddress) fetchHubData(walletAddress)
  }, [walletAddress, fetchHubData])

  useEffect(() => {
    if (walletAddress) void syncDriverHubFromApi(walletAddress)
  }, [walletAddress])

  const refreshHub = useCallback(() => {
    if (walletAddress) fetchHubData(walletAddress)
    setRefreshKey((k) => k + 1)
  }, [walletAddress, fetchHubData])

  // Nav "Refresh hub" button bumps `hubRefreshNonce` — same behavior as the old title-card control
  useEffect(() => {
    if (lastHubRefreshNonce.current === null) {
      lastHubRefreshNonce.current = hubRefreshNonce
      return
    }
    if (hubRefreshNonce === lastHubRefreshNonce.current) return
    lastHubRefreshNonce.current = hubRefreshNonce
    if (!walletAddress) return
    refreshHub()
  }, [hubRefreshNonce, walletAddress, refreshHub])

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
        <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-gray-400' : 'text-slate-600')} />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className={cn(
        'rounded-xl border p-6 text-center max-w-md mx-auto',
        isDark ? 'bg-gray-800/60 border-gray-700' : 'bg-slate-100/95 border-slate-300'
      )}>
        <AlertCircle className='w-8 h-8 text-red-500 mx-auto mb-3' />
        <p className={cn('text-sm font-medium mb-1', isDark ? 'text-white' : 'text-slate-800')}>
          Failed to load your hub
        </p>
        <p className={cn('text-xs mb-4', isDark ? 'text-gray-400' : 'text-slate-600')}>
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
      {showStormiWalkthrough && (
        <StormiWalkthrough
          key={`hub-walk-${walkthroughRequestNonce}`}
          steps={walkthroughSteps}
          onComplete={handleWalkthroughComplete}
          onDisableAll={() => {
            void handleWalkthroughDisableAll()
          }}
          onBrowseBlocks={openPicker}
        />
      )}
      {isStormiContextModalOpen && <StormiContextModal />}

      {/* Full width of page content (`max-w-7xl` + px from page.tsx) — avoids double-centering so main column aligns with nav band and sidebar sits right */}
      <div className='w-full'>
        {/* lg: grid (not flex row) so the sticky sidebar shares one row with the main column and
            aligns to the top edge of the profile card — flex + sticky was leaving the rail visually
            dropped next to Stormi in some layouts */}
        <div className='flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:content-start lg:gap-x-8 lg:gap-y-0'>
          <div className='min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:self-start'>
            <HubProfileHeader />

            {walletAddress ? (
              <>
                <StormiNudgeBanner isDark={isDark} walletAddress={walletAddress} />
                <CareerCardInsightsStrip isDark={isDark} />
              </>
            ) : null}

            <div id='stormi-hub-panel' className='scroll-mt-24'>
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
                  title='Ask Stormi'
                  description='Ranked jobs, interview practice, and talking points from your Career Card — you choose every apply.'
                >
                  <StormiChatPanel
                    mode='candidate'
                    walletAddress={walletAddress}
                    hubContext={hubContext}
                    candidateEmptyHub={installedBlocks.length === 0}
                    stormiAutoWelcomeCandidateDone={stormiAutoWelcomeCandidateDone}
                    onStormiAutoWelcomeSynced={() => {
                      setStormiAutoWelcomeCandidateDone(true)
                      if (walletAddress) void fetchHubData(walletAddress)
                    }}
                    hubEmbedSurface
                  />
                </BlockCard>
              </HubSectionPanel>
            </div>

            {/* ── Block Hive — vault shell matches Job alerts / Block files; Block Files section below ── */}
            <div>
              <HubSectionPanel isDark={isDark} accent='teal'>
                <BlockCard
                  variant='embed'
                  icon={LayoutGrid}
                  title='Your blocks'
                  description='Drag to reorder · tap to open · dashed = add'
                  headerActions={
                    <>
                      {installedBlocks.length > 0 && (
                        <Button
                          type='button'
                          variant={isEditing ? 'primary' : 'secondary'}
                          size='sm'
                          className='gap-1.5'
                          onClick={() => setEditMode(!isEditing)}
                        >
                          {isEditing ? <Check className='w-3.5 h-3.5' /> : <Pencil className='w-3.5 h-3.5' />}
                          {isEditing ? 'Done' : 'Edit'}
                        </Button>
                      )}
                      <Button variant='primary' size='sm' onClick={openPicker}>
                        <Plus className='w-4 h-4' />
                        Add
                      </Button>
                      {installedBlocks.length > 0 && (
                        <HubSectionCollapseToggle
                          expanded={hubYourBlocksExpanded}
                          onToggle={() => setHubYourBlocksExpanded(!hubYourBlocksExpanded)}
                          sectionLabel='Your blocks'
                          isDark={isDark}
                        />
                      )}
                    </>
                  }
                >
          {showYourBlocksPanel && (
          <>
          {installedBlocks.length === 0 ? (
            <div
              className={cn(
                'relative rounded-xl border-2 border-dashed p-10 sm:p-14 text-center overflow-hidden',
                isDark
                  ? 'border-teal-400/20 bg-gray-800/30'
                  : 'border-teal-500/25 bg-teal-50/40',
              )}
            >
              <div
                aria-hidden
                className='pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[min(100%,28rem)] h-48 rounded-full bg-gradient-to-b from-teal-400/15 via-cyan-500/10 to-transparent dark:from-teal-400/10 dark:via-violet-500/5 blur-2xl'
              />
              <div className='relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 dark:from-teal-400/25 dark:to-violet-500/15 ring-1 ring-teal-500/25 dark:ring-teal-400/30 mb-5 shadow-sm'>
                <Plus className='w-7 h-7 text-teal-600 dark:text-teal-400' />
              </div>
              <p className={cn('text-base font-semibold tracking-tight mb-1', isDark ? 'text-white' : 'text-slate-800')}>
                Your hub is empty
              </p>
              <p className={cn('text-sm max-w-sm mx-auto mb-6', isDark ? 'text-gray-400' : 'text-slate-600')}>
                Add blocks to build your professional profile — each block is a capability employers can discover.
              </p>
              <Button variant='primary' size='sm' onClick={openPicker}>
                <Plus className='w-4 h-4' />
                Browse blocks
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
                <VaultHubGrid
                  blocks={installedBlocks}
                  isEditing={isEditing}
                  isDark={isDark}
                  walletAddress={walletAddress}
                  removeBlock={removeBlock}
                  setCurrentPage={setCurrentPage}
                  onAddBlock={openPicker}
                />
              </SortableContext>
            </DndContext>
          )}
          </>
          )}
                </BlockCard>
              </HubSectionPanel>

              {/* Block Files — below hive vault */}
              <div className='mt-6'>
                <MyFilesSection refreshKey={refreshKey} />
              </div>
            </div>

            <div className='mt-4'>
              <JobAlertsHubSection />
            </div>
            <ReferralBanner />

            {/* ── Employer Outreach ── */}
            {walletAddress && (
              <CandidateRequestsSection
                userAddress={walletAddress}
                onNavigateToResume={(targetBlockType) => {
                  const route = targetBlockType
                    ? getBlockDefinition(targetBlockType)?.pageRoute
                    : null
                  if (route) setCurrentPage(route as PageType)
                  else setCurrentPage('storm-resume')
                }}
                onNavigateToDotApp={() => setCurrentPage('dotapp')}
              />
            )}

            {/* ── STORM + Add USDC (single card; mt-4 matches former separate USDC card spacing) ── */}
            {walletAddress && (
              <div className='mt-4'>
                <STORMBalance
                  walletAddress={walletAddress}
                  showBuyUsdc
                  onReadWhitepaper={() => setCurrentPage('stormchain')}
                />
              </div>
            )}
          </div>

          <HubSidebar variant='sticky' id='candidate-hub-quest-sidebar' className='lg:col-start-2 lg:row-start-1 lg:self-start' />
        </div>

        {/* Mobile: same sidebar content as slide-over (StormiJourneyGuide); FAB avoids hunting for Open Journey */}
        <Button
          type='button'
          variant='primary'
          size='md'
          onClick={() => {
            document
              .getElementById('candidate-hub-quest-sidebar')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className={cn(
            'lg:hidden fixed z-30 rounded-full px-4 py-2.5 shadow-lg shadow-teal-900/15 dark:shadow-black/40',
            'bottom-20 right-4',
          )}
          aria-label='Open career path'
        >
          <Compass className='w-4 h-4' />
          Career path
        </Button>
      </div>
    </>
  )
}
