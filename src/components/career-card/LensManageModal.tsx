'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useMemo, useState } from 'react'
import { Check, Link2, Plus, Trash2, Loader2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import {
  useCareerCardLensesStore,
  useLenses,
} from '@/stores/career-card-lenses-store'
import { useSimpleModeStore } from '@/stores/simple-mode-store'
import { HARD_LENS_LIMIT, SOFT_LENS_LIMIT } from '@/lib/career-card-lenses'
import { useAuthStore } from '@/stores'
import { useInstalledBlocks } from '@/stores/hub-blocks-store'

interface LensManageModalProps {
  onClose: () => void
}

/**
 * Minimal manage surface — list, set active, rename inline, delete (with undo),
 * add blank. Advanced editing (visible blocks, emphasis, custom summary) is
 * intentionally deferred; Stormi drafts those via /api/ai/draft-lens in Phase 3.
 */
export default function LensManageModal({ onClose }: LensManageModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const lenses = useLenses()
  const installedBlocks = useInstalledBlocks()

  const fetchLenses = useCareerCardLensesStore((s) => s.fetchLenses)
  const createLens = useCareerCardLensesStore((s) => s.createLens)
  const renameLens = useCareerCardLensesStore((s) => s.renameLens)
  const deleteLens = useCareerCardLensesStore((s) => s.deleteLens)
  const isMutating = useCareerCardLensesStore((s) => s.isMutating)
  const error = useCareerCardLensesStore((s) => s.error)

  const activeLensId = useSimpleModeStore((s) => s.activeLensId)
  const setActiveLens = useSimpleModeStore((s) => s.setActiveLens)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  /** Queue of recently deleted lenses kept for ~6s so undo is always one click. */
  const [undoQueue, setUndoQueue] = useState<
    { id: string; name: string; visibleBlockTypes: string[] | null }[]
  >([])
  /** Lens id currently showing "Copied!" feedback. */
  const [copiedLensId, setCopiedLensId] = useState<string | null>(null)

  // Pull fresh on mount in case another tab mutated.
  useEffect(() => {
    if (walletAddress) void fetchLenses(walletAddress)
  }, [walletAddress, fetchLenses])

  const atSoftCap = lenses.length >= SOFT_LENS_LIMIT
  const atHardCap = lenses.length >= HARD_LENS_LIMIT

  const handleCreateBlank = async () => {
    if (!walletAddress || atHardCap) return
    // Pick a unique default name; users rename immediately after.
    const base = 'New lens'
    let candidate = base
    let n = 2
    const existingNames = new Set(lenses.map((l) => l.name.toLowerCase()))
    while (existingNames.has(candidate.toLowerCase())) {
      candidate = `${base} ${n++}`
    }
    await createLens(walletAddress, {
      name: candidate,
      // Start visible = all installed appears-on-card block types. Gives the
      // user something to trim down rather than a blank canvas they have to
      // fill in. (Server treats an empty array as "show none" so we pass the
      // installed set explicitly.)
      visibleBlockTypes: installedBlocks.map((b) => b.blockType),
      emphasizedBlockTypes: [],
    })
  }

  const handleRename = async (id: string) => {
    if (!walletAddress) return
    const next = draftName.trim()
    if (next.length === 0) {
      setRenamingId(null)
      return
    }
    await renameLens(walletAddress, id, next)
    setRenamingId(null)
    setDraftName('')
  }

  const handleDelete = async (id: string) => {
    if (!walletAddress) return
    const lens = lenses.find((l) => l.id === id)
    if (!lens || lens.isDefault) return
    // Queue for undo BEFORE the request so a fast click still lets you recover.
    setUndoQueue((q) => [
      { id, name: lens.name, visibleBlockTypes: lens.visibleBlockTypes },
      ...q,
    ])
    await deleteLens(walletAddress, id)
    // If the deleted lens was active, fall back to default server-side.
    if (activeLensId === id) setActiveLens(null)
  }

  const handleUndo = async (
    entry: { id: string; name: string; visibleBlockTypes: string[] | null },
  ) => {
    if (!walletAddress) return
    setUndoQueue((q) => q.filter((e) => e.id !== entry.id))
    // Undo re-creates with the same name + visible set. Not identity-preserving
    // (new UUID, new created_at) but the framing is recovered, which is what
    // the user actually cares about.
    await createLens(walletAddress, {
      name: entry.name,
      visibleBlockTypes: entry.visibleBlockTypes,
    })
  }

  // Auto-expire undo entries after 6s so the list doesn't grow forever.
  useEffect(() => {
    if (undoQueue.length === 0) return
    const timer = setTimeout(() => {
      setUndoQueue((q) => q.slice(0, -1))
    }, 6000)
    return () => clearTimeout(timer)
  }, [undoQueue])

  const handleCopyShareLink = async (lensId: string, isDefault: boolean) => {
    if (!walletAddress) return
    try {
      // Fetch (or mint) the user's share token. Endpoint POSTs to enable if
      // not yet created — same flow CareerCardShareModal uses.
      const res = await fetch('/api/career-card/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ enable: true }),
      })
      const body = await res.json().catch(() => ({}))
      const token = body?.shareToken
      if (!res.ok || !token) {
        console.error('[LensManageModal] share token fetch failed:', body)
        return
      }
      // Default lens appears as the unlensed URL so users can keep one
      // canonical card link for their full profile.
      const base = `${window.location.origin}/card/${token}`
      const url = isDefault ? base : `${base}?lens=${encodeURIComponent(lensId)}`
      await navigator.clipboard.writeText(url)
      setCopiedLensId(lensId)
      window.setTimeout(() => setCopiedLensId((c) => (c === lensId ? null : c)), 1800)
    } catch (err) {
      console.error('[LensManageModal] copy share link failed:', err)
    }
  }

  const subtitle = useMemo(() => {
    if (atHardCap) return `You've hit the ${HARD_LENS_LIMIT}-lens limit. Delete one to create another.`
    if (atSoftCap) return `You have ${lenses.length} lenses. Most people only need 3\u20134.`
    return 'Your career card, framed for different jobs. Blocks are still the source of truth.'
  }, [atHardCap, atSoftCap, lenses.length])

  return (
    <Modal onClose={onClose} maxWidth='max-w-xl' panelShape='block'>
      <ModalHeader
        title='Manage lenses'
        subtitle={subtitle}
        onClose={onClose}
        variant='block'
      />

      <div className='p-4 sm:p-5'>
        <ul className='space-y-2'>
          {lenses.map((lens) => {
            const isActive = lens.id === (activeLensId ?? lenses.find((l) => l.isDefault)?.id)
            const isRenaming = renamingId === lens.id
            return (
              <li
                key={lens.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors',
                  isDark
                    ? isActive
                      ? 'border-teal-400/50 bg-teal-500/10'
                      : 'border-gray-700 bg-gray-900/40'
                    : isActive
                      ? 'border-teal-300 bg-teal-50'
                      : 'border-slate-200 bg-white',
                )}
              >
                <button
                  type='button'
                  onClick={() => setActiveLens(lens.isDefault ? null : lens.id)}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors cursor-pointer',
                    isActive
                      ? 'bg-teal-500 border-teal-500 text-white'
                      : isDark
                        ? 'border-gray-600 hover:border-teal-400'
                        : 'border-slate-300 hover:border-teal-500',
                  )}
                  aria-label={isActive ? 'Currently active lens' : 'Use this lens'}
                >
                  {isActive && <Check className='w-3 h-3' />}
                </button>
                <div className='flex-1 min-w-0'>
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => handleRename(lens.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(lens.id)
                        if (e.key === 'Escape') {
                          setRenamingId(null)
                          setDraftName('')
                        }
                      }}
                      maxLength={48}
                      className={cn(
                        'w-full text-sm font-medium bg-transparent border-b outline-none',
                        isDark
                          ? 'border-teal-400 text-white'
                          : 'border-teal-500 text-slate-900',
                      )}
                    />
                  ) : (
                    <button
                      type='button'
                      onClick={() => {
                        if (lens.isDefault) return
                        setRenamingId(lens.id)
                        setDraftName(lens.name)
                      }}
                      disabled={lens.isDefault}
                      className={cn(
                        'text-sm font-medium text-left truncate w-full',
                        lens.isDefault ? 'cursor-default' : 'cursor-pointer hover:underline',
                        isDark ? 'text-white' : 'text-slate-900',
                      )}
                      title={lens.isDefault ? undefined : 'Rename'}
                    >
                      {lens.name}
                      {lens.isDefault && (
                        <span
                          className={cn(
                            'ml-2 text-[10px] font-medium uppercase tracking-wider',
                            isDark ? 'text-gray-500' : 'text-gray-400',
                          )}
                        >
                          default
                        </span>
                      )}
                    </button>
                  )}
                </div>
                <button
                  type='button'
                  onClick={() => void handleCopyShareLink(lens.id, lens.isDefault)}
                  className={cn(
                    'p-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1',
                    isDark
                      ? 'text-gray-500 hover:text-teal-300 hover:bg-teal-500/10'
                      : 'text-gray-400 hover:text-teal-600 hover:bg-teal-50',
                  )}
                  aria-label={`Copy share link for ${lens.name}`}
                  title={`Copy share link for ${lens.name}`}
                >
                  {copiedLensId === lens.id ? (
                    <span className='text-[10px] font-semibold'>Copied!</span>
                  ) : (
                    <Link2 className='w-4 h-4' />
                  )}
                </button>
                {!lens.isDefault && (
                  <button
                    type='button'
                    onClick={() => handleDelete(lens.id)}
                    className={cn(
                      'p-1.5 rounded-md transition-colors cursor-pointer',
                      isDark
                        ? 'text-gray-500 hover:text-red-300 hover:bg-red-500/10'
                        : 'text-gray-400 hover:text-red-600 hover:bg-red-50',
                    )}
                    aria-label={`Delete ${lens.name}`}
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {/* Undo strip — every recently-deleted lens gets one click to recover. */}
        {undoQueue.length > 0 && (
          <div className='mt-3 space-y-1'>
            {undoQueue.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-xs',
                  isDark
                    ? 'bg-amber-500/10 text-amber-100 border border-amber-500/30'
                    : 'bg-amber-50 text-amber-900 border border-amber-200',
                )}
              >
                <span>Deleted &ldquo;{entry.name}&rdquo;</span>
                <button
                  type='button'
                  onClick={() => handleUndo(entry)}
                  className='font-semibold hover:underline cursor-pointer'
                >
                  undo
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className={cn('mt-3 text-xs', isDark ? 'text-red-300' : 'text-red-600')}>
            {error}
          </p>
        )}

        <div className='mt-5 flex items-center justify-between gap-3'>
          <p
            className={cn(
              'text-[11px]',
              isDark ? 'text-gray-500' : 'text-gray-500',
            )}
          >
            {lenses.length} / {HARD_LENS_LIMIT}
          </p>
          <Button
            variant='secondary'
            size='sm'
            onClick={handleCreateBlank}
            disabled={atHardCap || isMutating}
          >
            {isMutating ? (
              <Loader2 className='w-3.5 h-3.5 mr-1.5 animate-spin' />
            ) : (
              <Plus className='w-3.5 h-3.5 mr-1.5' />
            )}
            New blank lens
          </Button>
        </div>
      </div>
    </Modal>
  )
}
