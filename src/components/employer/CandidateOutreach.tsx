'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import { cn } from '@/lib/utils'
import { BLOCK_DEFINITIONS, BLOCK_CATEGORIES, getBlockDefinition, employerCanRequest } from '@/lib/block-registry'
import type { EmployerHubContext } from '@/lib/ava-context'
import { sendToStormi, OutOfCreditsError, type StormiConversationTurn } from '@/lib/ava-chat'
import { useEmployerBlocksStore } from '@/stores/employer-blocks-store'
import { useUIStore } from '@/stores'
import { getEmployerBlockDefinition } from '@/lib/employer-block-registry'
import QRCode from 'qrcode'
import KanbanBoard from '@/components/employer/outreach/KanbanBoard'
import OutreachKanbanInfoModal from '@/components/employer/outreach/OutreachKanbanInfoModal'
import OutreachFilterBar, { type FilterChipDef, type SortKey } from '@/components/employer/outreach/OutreachFilterBar'
import FilesVault from '@/components/employer/outreach/FilesVault'
import StormiChatMarkdown from '@/components/employer/outreach/StormiChatMarkdown'
import MvrViewModal from '@/components/MvrViewModal'
import PspViewModal from '@/components/PspViewModal'
import type { Invite, InviteStatus, ScreeningRow, ScreeningsByUserId } from '@/components/employer/outreach/types'
import type { ConsentBundleSummary } from '@/hooks/useEmployerScreenings'
import {
  OUTREACH_KANBAN_COLUMNS,
  OUTREACH_STALE_COMPLETED_DAYS,
  isInviteInArchiveTab,
  isInviteOnActiveKanban,
  isStaleCompletedOutreach,
} from '@/lib/outreach-invite-buckets'
import {
  Link2,
  Plus,
  Copy,
  Check,
  Loader2,
  Send,
  X,
  Search,
  UserCheck,
  UserPlus,
  MapPin,
  Package,
  ArrowLeft,
  ShieldCheck,
  Inbox,
  Archive as ArchiveIcon,
  Users,
  RotateCcw,
  Download,
  Share2,
  ChevronDown,
  Bot,
  Pencil,
  Info,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileResult {
  user_id: string
  full_name: string | null
  email: string | null
  city: string | null
  state: string | null
  cdl_class: string | null
  has_driver_app: boolean
  has_resume: boolean
}

interface Job {
  id: string
  title: string
}

type OutreachTab = 'active' | 'vault' | 'archive'

interface CandidateOutreachProps {
  walletAddress: string
  isCollapsed?: boolean
  onToggle?: () => void
  /** When true, skips the outer HubSectionPanel/BlockCard wrapper (parent provides the chrome) */
  embedded?: boolean
  /** All MVR + PSP screenings the company has paid for (hoisted from EmployerHub) */
  screeningsRows?: ScreeningRow[]
  /** Same data, indexed by candidate user id for O(1) lookup on each card */
  screeningsByUserId?: ScreeningsByUserId
  screeningsLoading?: boolean
  screeningsError?: string | null
  /** Signed consent packages (FCRA + FMCSA PSP + CDLIS bundles) for the vault */
  consentBundles?: ConsentBundleSummary[]
  /** Optional refresh handler — wired to the tab refresh button */
  onRefreshScreenings?: () => void
  /** Employer hub context — passed through so the mini Stormi modal can call the AI API */
  employerContext?: EmployerHubContext | null
}

// Status visuals reused for the chip filter row. Keeping these here (not in the
// card component) lets both Active and Archive tabs share one definition.
const STATUS_CHIP_DOTS: Record<InviteStatus, string> = {
  pending: 'bg-amber-400',
  viewed: 'bg-blue-400',
  in_progress: 'bg-purple-400',
  completed: 'bg-green-400',
  expired: 'bg-gray-400',
  cancelled: 'bg-red-400',
}

const STATUS_CHIP_LABEL: Record<InviteStatus, string> = {
  pending: 'Pending',
  viewed: 'Viewed',
  in_progress: 'In progress',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

const OUTREACH_TAB_LS = 'employer-outreach-tab'
const OUTREACH_FILTER_LS = 'employer-outreach-filters'

function inviteQrFilename(name: string) {
  const slug = name
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40) || 'invite'
  return `stormchain-invite-qr-${slug}.png`
}

function QrModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const { theme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 240,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
    }
  }, [url])

  const downloadPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = inviteQrFilename(name)
    a.click()
  }

  const copyImage = async () => {
    const canvas = canvasRef.current
    if (!canvas || !navigator.clipboard?.write) return
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/png'))
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2000)
    } catch {
      // Clipboard image unsupported in some browsers
    }
  }

  const shareQr = async () => {
    const canvas = canvasRef.current
    if (!canvas || !navigator.share) return
    setShareBusy(true)
    try {
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/png'))
      if (blob) {
        const file = new File([blob], inviteQrFilename(name), { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Storm invite',
            text: `Open or scan: ${url}`,
          })
          return
        }
      }
      await navigator.share({ title: 'Storm invite', text: url })
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'name' in e && (e as Error).name === 'AbortError') return
      console.error('[QrModal] share failed', e)
    } finally {
      setShareBusy(false)
    }
  }

  const canShare = typeof navigator !== 'undefined' && Boolean(navigator.share)
  const canCopyImage =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.clipboard?.write && typeof ClipboardItem !== 'undefined')

  const muted = isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
  const sub = isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-600'

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <ModalHeader title="Invite QR code" onClose={onClose} />
      <div className="p-6 text-center space-y-4">
        <div className="bg-white rounded-xl p-3 inline-block">
          <canvas ref={canvasRef} />
        </div>
        <div>
          <p className={`text-xs truncate px-1 ${muted}`}>{name || 'Invite link'}</p>
          <p className={`text-xs mt-1 ${sub}`}>Download, copy image, or use your device share sheet</p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-center">
          <Button type="button" variant="primary" size="sm" onClick={downloadPng} className="gap-1.5">
            <Download className="w-4 h-4" />
            Download PNG
          </Button>
          {canCopyImage && (
            <Button type="button" variant="secondary" size="sm" onClick={copyImage} className="gap-1.5">
              {copiedImage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedImage ? 'Copied' : 'Copy image'}
            </Button>
          )}
          {canShare && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={shareQr}
              disabled={shareBusy}
              className="gap-1.5"
            >
              {shareBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Share…
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CandidateOutreach({
  walletAddress,
  isCollapsed = false,
  onToggle,
  embedded = false,
  screeningsRows = [],
  screeningsByUserId,
  screeningsLoading = false,
  screeningsError = null,
  consentBundles = [],
  onRefreshScreenings,
  employerContext = null,
}: CandidateOutreachProps) {
  const { theme } = useTheme()
  const hubRefreshNonce = useUIStore((s) => s.hubRefreshNonce)

  const [invites, setInvites] = useState<Invite[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)
  const [emailSentId, setEmailSentId] = useState<string | null>(null)
  const [qrInvite, setQrInvite] = useState<Invite | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [statusOverrideSavingId, setStatusOverrideSavingId] = useState<string | null>(null)
  const [showKanbanHelp, setShowKanbanHelp] = useState(false)

  const [selectedBlockType, setSelectedBlockType] = useState<string | null>(null)

  // ── Tab + filter state (persisted) ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<OutreachTab>('active')
  const [search, setSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortKey>('newest')

  // Restore persisted tab + filter state on mount. We use try/catch because
  // localStorage isn't available in some embed/SSR contexts.
  useEffect(() => {
    try {
      const tab = localStorage.getItem(OUTREACH_TAB_LS) as OutreachTab | null
      if (tab === 'active' || tab === 'vault' || tab === 'archive') setActiveTab(tab)
      const f = localStorage.getItem(OUTREACH_FILTER_LS)
      if (f) {
        const parsed = JSON.parse(f) as {
          search?: string
          statuses?: string[]
          blocks?: string[]
          sort?: SortKey
        }
        if (typeof parsed.search === 'string') setSearch(parsed.search)
        if (Array.isArray(parsed.statuses)) setSelectedStatuses(new Set(parsed.statuses))
        if (Array.isArray(parsed.blocks)) setSelectedBlocks(new Set(parsed.blocks))
        if (parsed.sort === 'newest' || parsed.sort === 'oldest' || parsed.sort === 'name') {
          setSort(parsed.sort)
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(OUTREACH_TAB_LS, activeTab)
    } catch {
      /* ignore */
    }
  }, [activeTab])

  useEffect(() => {
    try {
      localStorage.setItem(
        OUTREACH_FILTER_LS,
        JSON.stringify({
          search,
          statuses: Array.from(selectedStatuses),
          blocks: Array.from(selectedBlocks),
          sort,
        }),
      )
    } catch {
      /* ignore */
    }
  }, [search, selectedStatuses, selectedBlocks, sort])

  // ── Edit invite modal state ────────────────────────────────────────────────
  const [editingInvite, setEditingInvite] = useState<Invite | null>(null)

  // ── File view modal state (opens MvrViewModal/PspViewModal from a card) ──
  const [mvrViewOrderId, setMvrViewOrderId] = useState<string | null>(null)
  const [pspViewOrderId, setPspViewOrderId] = useState<string | null>(null)
  const [activeFileCandidateId, setActiveFileCandidateId] = useState<string | null>(null)

  const [form, setForm] = useState({
    candidateEmail: '',
    candidateName: '',
    candidateUserId: '',
    jobPostingId: '',
    welcomeMessage: '',
  })

  // Profile search autocomplete state
  const [profileQuery, setProfileQuery] = useState('')
  const [profileResults, setProfileResults] = useState<ProfileResult[]>([])
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<ProfileResult | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileSearchRef = useRef<HTMLDivElement>(null)

  const employerInstalledBlocks = useEmployerBlocksStore((s) => s.installedBlocks)
  const installedEmployerBlockTypes = useMemo(
    () => employerInstalledBlocks.map((b) => b.blockType),
    [employerInstalledBlocks],
  )

  // Only show candidate blocks the employer can actually request:
  // must be employerRequestable AND the company must have the required employer block installed
  const blocksByCategory = useMemo(() => {
    const map = new Map<string, typeof BLOCK_DEFINITIONS>()
    for (const block of BLOCK_DEFINITIONS) {
      if (!block.employerRequestable) continue
      if (!employerCanRequest(block, installedEmployerBlockTypes)) continue
      const existing = map.get(block.categoryId) ?? []
      existing.push(block)
      map.set(block.categoryId, existing)
    }
    return BLOCK_CATEGORIES
      .filter(cat => map.has(cat.id))
      .map(cat => ({ category: cat, blocks: map.get(cat.id)! }))
  }, [installedEmployerBlockTypes])

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/employer/invites', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (res.ok) {
        const data = await res.json()
        setInvites(data.invites || [])
        if (typeof data.companyName === 'string') setCompanyName(data.companyName)
      }
    } catch (err) {
      console.error('[CandidateOutreach] fetchInvites error:', err)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/employer/jobs', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
      }
    } catch (err) {
      console.error('[CandidateOutreach] fetchJobs error:', err)
    }
  }, [walletAddress])

  useEffect(() => {
    if (walletAddress) {
      fetchInvites()
      fetchJobs()
    }
  }, [walletAddress, hubRefreshNonce, fetchInvites, fetchJobs])

  // ── Profile search autocomplete ────────────────────────────────────────────

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    const q = profileQuery.trim()
    if (q.length < 2) {
      setProfileResults([])
      setShowProfileDropdown(false)
      return
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearchingProfiles(true)
      try {
        const res = await fetch(
          `/api/employer/talent/search?search=${encodeURIComponent(q)}&limit=6`,
          { headers: { 'x-wallet-address': walletAddress } }
        )
        if (res.ok) {
          const { candidates } = await res.json()
          const normalized = (candidates ?? []).map((c: { userId?: string; user_id?: string; name?: string; full_name?: string; email?: string; city?: string; state?: string; location?: string; cdlClass?: string; cdl_class?: string; hasDriverApp?: boolean; has_resume?: boolean; hasResume?: boolean }) => ({
            user_id: c.userId ?? c.user_id ?? '',
            full_name: c.name ?? c.full_name ?? null,
            email: c.email ?? null,
            city: c.city ?? (typeof c.location === 'string' ? c.location.split(',')[0]?.trim() ?? null : null),
            state: c.state ?? null,
            cdl_class: c.cdl_class ?? c.cdlClass ?? null,
            has_driver_app: c.hasDriverApp ?? false,
            has_resume: c.has_resume ?? c.hasResume ?? false,
          }))
          setProfileResults(normalized)
          setShowProfileDropdown(true)
        }
      } catch {
        // fail silently — search is a convenience, not a blocker
      } finally {
        setIsSearchingProfiles(false)
      }
    }, 300)

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [profileQuery, walletAddress])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileSearchRef.current && !profileSearchRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelectProfile = (profile: ProfileResult) => {
    setSelectedProfile(profile)
    setProfileQuery('')
    setShowProfileDropdown(false)
    setForm(f => ({
      ...f,
      candidateName: profile.full_name || '',
      candidateEmail: profile.email || '',
      candidateUserId: profile.user_id,
    }))
  }

  const handleClearProfile = () => {
    setSelectedProfile(null)
    setProfileQuery('')
    setForm(f => ({
      ...f,
      candidateName: '',
      candidateEmail: '',
      candidateUserId: '',
    }))
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ candidateEmail: '', candidateName: '', candidateUserId: '', jobPostingId: '', welcomeMessage: '' })
    setSelectedBlockType(null)
    setSelectedProfile(null)
    setProfileQuery('')
    setProfileResults([])
  }

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      const targetBlockType = selectedBlockType

      const res = await fetch('/api/employer/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({
          targetBlockType,
          candidateEmail: form.candidateEmail || undefined,
          candidateName: form.candidateName || undefined,
          candidateUserId: form.candidateUserId || undefined,
          jobPostingId: form.jobPostingId || undefined,
          welcomeMessage: form.welcomeMessage || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create outreach')
      }
      const { invite } = await res.json()
      setInvites(prev => [{ ...invite, emailSentAt: invite.emailSentAt ?? null }, ...prev])
      setShowForm(false)
      resetForm()
      copyToClipboard(invite.url, invite.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch('/api/employer/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ id, status: 'cancelled' }),
      })
      if (res.ok) {
        setInvites(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'cancelled' as const, updatedAt: new Date().toISOString() } : inv))
      }
    } catch (err) {
      console.error('[CandidateOutreach] cancel error:', err)
    }
  }

  const handleRemove = async (id: string) => {
    if (
      !window.confirm(
        'Remove this outreach from your list? The invite link will stop working and cannot be undone.'
      )
    ) {
      return
    }
    setRemovingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/employer/invites?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-wallet-address': walletAddress },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to remove')
      setInvites(prev => prev.filter(inv => inv.id !== id))
      setQrInvite(q => (q?.id === id ? null : q))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setRemovingId(null)
    }
  }

  const handleSendEmail = async (invite: Invite, emailOverride?: string) => {
    const email = emailOverride || invite.candidateEmail
    if (!email) return

    setSendingEmailId(invite.id)
    setError(null)

    try {
      const res = await fetch('/api/employer/invites/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ inviteId: invite.id, email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send email')

      setInvites(prev => prev.map(inv =>
        inv.id === invite.id
          ? { ...inv, candidateEmail: email, emailSentAt: new Date().toISOString() }
          : inv
      ))
      setEmailSentId(invite.id)
      setTimeout(() => setEmailSentId(null), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSendingEmailId(null)
    }
  }

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  /** Edit an invite's mutable fields (name, email, job, welcome message). */
  const handleEditInvite = async (
    inviteId: string,
    patch: { candidateName?: string; candidateEmail?: string; jobPostingId?: string; welcomeMessage?: string },
  ) => {
    const res = await fetch('/api/employer/invites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
      body: JSON.stringify({ id: inviteId, ...patch }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error((d as { error?: string }).error ?? 'Failed to update invite')
    }
    // Optimistic local update — the API returns the new field values
    setInvites((prev) =>
      prev.map((inv) =>
        inv.id === inviteId
          ? {
              ...inv,
              candidateName: patch.candidateName ?? inv.candidateName,
              candidateEmail: patch.candidateEmail ?? inv.candidateEmail,
              jobTitle: patch.jobPostingId ? (jobs.find((j) => j.id === patch.jobPostingId)?.title ?? inv.jobTitle) : inv.jobTitle,
            }
          : inv,
      ),
    )
    setEditingInvite(null)
  }

  const handleRecruiterNotesSave = useCallback(
    async (inviteId: string, notes: string) => {
      const normalized = notes.trim()
      const nextNotes = normalized.length === 0 ? null : normalized.slice(0, 8000)
      let previousNotes: string | null = null
      setInvites((prev) => {
        const cur = prev.find((i) => i.id === inviteId)
        if (cur) previousNotes = cur.recruiterNotes
        return prev.map((inv) =>
          inv.id === inviteId
            ? {
                ...inv,
                recruiterNotes: nextNotes,
                updatedAt: new Date().toISOString(),
              }
            : inv,
        )
      })
      setSavingNotesId(inviteId)
      try {
        const res = await fetch('/api/employer/invites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
          body: JSON.stringify({
            id: inviteId,
            recruiterNotes: nextNotes === null ? null : nextNotes,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error((d as { error?: string }).error ?? 'Failed to save notes')
        }
      } catch (err) {
        console.error('[CandidateOutreach] recruiter notes error:', err)
        setInvites((prev) =>
          prev.map((inv) =>
            inv.id === inviteId ? { ...inv, recruiterNotes: previousNotes } : inv,
          ),
        )
      } finally {
        setSavingNotesId(null)
      }
    },
    [walletAddress],
  )

  /**
   * Rescue flow: candidate's screening got stuck (typo'd DL, bad data, stale
   * pending). We don't try to mutate the old invite — instead we mint a fresh
   * invite for the SAME target block, optimistically prepend it to the list,
   * and auto-send the email if we have one on file. The original card stays
   * around for audit / context until the recruiter manually removes it.
   */
  const handleResendConsent = useCallback(
    async (invite: Invite) => {
      setResendingId(invite.id)
      setError(null)
      try {
        const res = await fetch('/api/employer/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
          body: JSON.stringify({
            targetBlockType: invite.targetBlockType ?? undefined,
            candidateEmail: invite.candidateEmail ?? undefined,
            candidateName: invite.candidateName ?? undefined,
            candidateUserId: invite.usedByUserId ?? undefined,
            jobPostingId: invite.jobPostingId ?? undefined,
            welcomeMessage:
              "We hit a snag with your last screening — likely a typo in the driver's license field. Please re-sign so we can re-pull the report. Thanks!",
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to resend consent')
        const newInvite: Invite = data.invite
        setInvites((prev) => [{ ...newInvite, emailSentAt: newInvite.emailSentAt ?? null }, ...prev])

        // If we already have an email on file, auto-fire it. Otherwise leave
        // it to the recruiter to use the "Email" button on the new card.
        if (newInvite.candidateEmail) {
          void handleSendEmail(newInvite)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Resend failed')
      } finally {
        setResendingId(null)
      }
    },
    // handleSendEmail is stable enough (not in deps) — capturing it would
    // require hoisting it above this block. The lint warning is OK here:
    // resend is a manual action, not a useEffect dep cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walletAddress],
  )

  /** Force `application_invites.status` from the kanban detail modal (Pace ops / stuck sync). */
  const handleInviteStatusOverride = useCallback(
    async (inviteId: string, nextStatus: InviteStatus) => {
      setStatusOverrideSavingId(inviteId)
      setError(null)
      try {
        const res = await fetch('/api/employer/invites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
          body: JSON.stringify({
            id: inviteId,
            status: nextStatus,
            employerStatusOverride: true,
          }),
        })
        const data = (await res.json()) as {
          error?: string
          invite?: { id: string; status: InviteStatus; updatedAt?: string }
        }
        if (!res.ok) throw new Error(data.error || 'Failed to update status')
        const updatedAt = data.invite?.updatedAt ?? new Date().toISOString()
        const status = data.invite?.status ?? nextStatus
        setInvites((prev) =>
          prev.map((inv) => (inv.id === inviteId ? { ...inv, status, updatedAt } : inv)),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status')
        throw e
      } finally {
        setStatusOverrideSavingId(null)
      }
    },
    [walletAddress],
  )

  // ── Stormi mini modal state ──────────────────────────────────────────────
  const [stormiTarget, setStormiTarget] = useState<{ invite: Invite; files: ScreeningRow[] } | null>(null)

  const handleAskStormi = useCallback(
    (invite: Invite, files: ScreeningRow[]) => {
      setStormiTarget({ invite, files })
    },
    [],
  )

  // ── Derived: tab buckets, filter chips, "ready to view" count ─────────────
  // Board = candidate lifecycle (pending → completed) minus stale completed.
  // Archive tab = cancelled / expired + completed older than OUTREACH_STALE_COMPLETED_DAYS.
  const boardInvites = useMemo(() => invites.filter(isInviteOnActiveKanban), [invites])
  const archivedTabInvites = useMemo(() => invites.filter(isInviteInArchiveTab), [invites])

  const readyToViewCount = useMemo(() => {
    if (!screeningsByUserId) return 0
    let n = 0
    for (const inv of boardInvites) {
      if (!inv.usedByUserId) continue
      const files = screeningsByUserId.get(inv.usedByUserId)
      if (!files) continue
      for (const f of files) if (f.status === 'completed') n++
    }
    return n
  }, [boardInvites, screeningsByUserId])

  const statusChips = useMemo<FilterChipDef[]>(() => {
    const counts: Partial<Record<InviteStatus, number>> = {}
    for (const inv of boardInvites) counts[inv.status] = (counts[inv.status] ?? 0) + 1
    return OUTREACH_KANBAN_COLUMNS.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({
      id: s,
      label: STATUS_CHIP_LABEL[s],
      count: counts[s] ?? 0,
      dotClass: STATUS_CHIP_DOTS[s],
    }))
  }, [boardInvites])

  const blockChips = useMemo<FilterChipDef[]>(() => {
    const counts = new Map<string, number>()
    for (const inv of boardInvites) {
      const k = inv.targetBlockType ?? '__general__'
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([id, count]) => ({
      id,
      label: id === '__general__' ? 'General' : getBlockDefinition(id)?.label ?? id,
      count,
    }))
  }, [boardInvites])

  // Filter + sort applied to whichever tab is active. Search matches name,
  // email, or job title.
  const applyFilters = useCallback(
    (list: Invite[], options: { useStatusFilter: boolean }) => {
      const q = search.trim().toLowerCase()
      const out = list.filter((inv) => {
        if (q) {
          const blob = [inv.candidateName, inv.candidateEmail, inv.jobTitle]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (!blob.includes(q)) return false
        }
        if (options.useStatusFilter && selectedStatuses.size > 0 && !selectedStatuses.has(inv.status)) {
          return false
        }
        if (selectedBlocks.size > 0) {
          const k = inv.targetBlockType ?? '__general__'
          if (!selectedBlocks.has(k)) return false
        }
        return true
      })
      if (sort === 'newest') out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      else if (sort === 'oldest') out.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      else out.sort((a, b) => (a.candidateName ?? '').localeCompare(b.candidateName ?? ''))
      return out
    },
    [search, selectedStatuses, selectedBlocks, sort],
  )

  const filteredActive = useMemo(
    () => applyFilters(boardInvites, { useStatusFilter: true }),
    [applyFilters, boardInvites],
  )
  const filteredArchive = useMemo(
    () => applyFilters(archivedTabInvites, { useStatusFilter: false }),
    [applyFilters, archivedTabInvites],
  )

  const hasActiveFilters =
    search.trim().length > 0 || selectedStatuses.size > 0 || selectedBlocks.size > 0

  const clearAllFilters = () => {
    setSearch('')
    setSelectedStatuses(new Set())
    setSelectedBlocks(new Set())
  }

  const toggleStatus = (id: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleBlock = (id: string) => {
    setSelectedBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Restore from archive ──────────────────────────────────────────────────
  const handleRestore = async (id: string) => {
    try {
      const res = await fetch('/api/employer/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ id, status: 'pending' }),
      })
      if (res.ok) {
        setInvites((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: 'pending' as const, updatedAt: new Date().toISOString() } : inv)))
      }
    } catch (err) {
      console.error('[CandidateOutreach] restore error:', err)
    }
  }

  // ── Open the right View modal for a given screening file ─────────────────
  const handleViewFile = (file: ScreeningRow) => {
    if (!file.candidateUserId) return
    setActiveFileCandidateId(file.candidateUserId)
    if (file.kind === 'mvr') setMvrViewOrderId(file.id)
    else setPspViewOrderId(file.id)
  }

  const canSubmit = selectedBlockType !== null

  // ── Shared styling shortcuts ───────────────────────────────────────────────
  const inputBase = `w-full px-3 py-2 rounded-lg text-sm border transition-colors outline-none focus:ring-2 focus:ring-teal-500/50 ${
    isDarkTheme(theme)
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`

  const label = `block text-xs font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`

  // ── Outreach inner content (shared between embedded + standalone) ──────────
  const outreachHeader = (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Link2 className={cn('h-4 w-4', isDarkTheme(theme) ? 'text-amber-400' : 'text-amber-600')} />
        <h4 className={cn('text-sm font-semibold', isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800')}>
          Candidate outreach
        </h4>
        {boardInvites.length > 0 && (
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', isDarkTheme(theme) ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')}>
            {boardInvites.length} active
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand candidate outreach' : 'Collapse candidate outreach'}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isCollapsed && '-rotate-90',
            )}
          />
        </Button>
      </div>
    </div>
  )

  const outreachBody = (
    <>
        {/* Create form */}
        {!isCollapsed && showForm && (
          <div
            className={cn(
              'mb-8 rounded-xl border px-4 py-5 sm:px-5 sm:py-6',
              isDarkTheme(theme)
                ? 'border-gray-600/80 bg-gray-900/50 shadow-sm'
                : 'border-gray-200 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-900/45',
            )}
          >
            <div className="mb-5 flex items-center justify-between gap-2 border-b border-gray-200 pb-4 dark:border-gray-700/80">
              <h4 className={cn('text-sm font-semibold', isDarkTheme(theme) ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>
                Create outreach link
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="!p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                onClick={() => {
                  setShowForm(false)
                  setError(null)
                  resetForm()
                }}
                aria-label="Close form"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Block picker — employer outreach is always block-specific */}
            <div className="mb-6">
              <p className={label}>Which block should they complete? *</p>
                {selectedBlockType ? (
                  // Show selected block with a "change" button
                  <SelectedBlockPill
                    blockType={selectedBlockType}
                    theme={theme}
                    onClear={() => setSelectedBlockType(null)}
                  />
                ) : blocksByCategory.length === 0 ? (
                  <div className={`rounded-xl border px-4 py-6 text-center ${
                    isDarkTheme(theme) ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
                  }`}>
                    <Package className={`w-8 h-8 mx-auto mb-2 ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                      No outreach blocks available
                    </p>
                    <p className={`text-xs mt-1 ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`}>
                      Install employer blocks from the hub to enable candidate requests.
                    </p>
                  </div>
                ) : (
                  <div className={`rounded-xl border overflow-hidden ${
                    isDarkTheme(theme) ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
                  }`}>
                    <div className="max-h-56 overflow-y-auto">
                      {blocksByCategory.map(({ category, blocks }) => (
                        <div key={category.id}>
                          <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider sticky top-0 z-10 ${
                            isDarkTheme(theme) ? 'bg-gray-800 text-gray-500 border-b border-gray-700' : 'bg-gray-50 text-gray-400 border-b border-gray-200'
                          }`}>
                            {category.label}
                          </div>
                          {blocks.map(block => {
                            // Show which employer block enables this option — makes
                            // the "blocks ↔ outreach" link visually obvious.
                            const enabledByBlock = block.requiredEmployerBlocks?.find(eb =>
                              installedEmployerBlockTypes.includes(eb),
                            )
                            const enabledByLabel = enabledByBlock
                              ? getEmployerBlockDefinition(enabledByBlock)?.label ?? enabledByBlock
                              : null
                            return (
                              <button
                                key={block.id}
                                onClick={() => setSelectedBlockType(block.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                  isDarkTheme(theme)
                                    ? 'hover:bg-gray-700/50 border-b border-gray-700/50'
                                    : 'hover:bg-gray-50 border-b border-gray-100'
                                }`}
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isDarkTheme(theme) ? 'bg-teal-900/40' : 'bg-teal-100'
                                }`}>
                                  <Package className="w-3.5 h-3.5 text-teal-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                                      {block.label}
                                    </p>
                                    {enabledByLabel && (
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                        isDarkTheme(theme)
                                          ? 'bg-amber-500/20 text-amber-300'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        via {enabledByLabel}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-xs truncate ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {block.description}
                                  </p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Who receives this — two paths: Storm member vs anyone else (visually split so it is not one undifferentiated stack). */}
            <div
              className={cn(
                'mb-6 rounded-xl border p-4 sm:p-5',
                isDarkTheme(theme) ? 'border-teal-500/20 bg-gray-950/40' : 'border-teal-100 bg-white dark:border-teal-900/30 dark:bg-gray-950/30',
              )}
              ref={profileSearchRef}
            >
              <div className="mb-1 flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    isDarkTheme(theme) ? 'bg-teal-500/15 text-teal-300' : 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200',
                  )}
                >
                  <Search className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h5 className={cn('text-sm font-semibold', isDarkTheme(theme) ? 'text-gray-100' : 'text-gray-900 dark:text-gray-100')}>
                    Find someone already on Storm
                  </h5>
                  <p className={cn('text-xs', isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400')}>
                    Search by name, email, or city. We attach the invite to their account so they get in-app notifications.
                  </p>
                </div>
              </div>

              {selectedProfile ? (
                <div
                  className={cn(
                    'mt-3 flex items-center justify-between rounded-lg border px-3 py-2',
                    isDarkTheme(theme) ? 'border-teal-700/50 bg-teal-900/30' : 'border-teal-200 bg-teal-50',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <div>
                      <p className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-teal-300' : 'text-teal-700'}`}>
                        {selectedProfile.full_name || selectedProfile.email}
                      </p>
                      <p className={`text-xs ${isDarkTheme(theme) ? 'text-teal-500' : 'text-teal-500'}`}>
                        Connected to Storm · In-app notification will fire when email is sent
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs font-medium"
                    onClick={handleClearProfile}
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </Button>
                </div>
              ) : (
                <div className="relative mt-3">
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${
                      isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                    <input
                      type="text"
                      placeholder="Search by name, email, or city…"
                      value={profileQuery}
                      onChange={e => setProfileQuery(e.target.value)}
                      onFocus={() => profileResults.length > 0 && setShowProfileDropdown(true)}
                      className={`${inputBase} pl-8`}
                    />
                    {isSearchingProfiles && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-teal-500" />
                    )}
                  </div>

                  {showProfileDropdown && profileResults.length > 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 overflow-hidden ${
                      isDarkTheme(theme) ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                      {profileResults.map((profile, index) => (
                        <button
                          key={profile.user_id || `profile-${index}`}
                          onClick={() => handleSelectProfile(profile)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b last:border-b-0 cursor-pointer ${
                            isDarkTheme(theme)
                              ? 'hover:bg-gray-700 border-gray-700/60'
                              : 'hover:bg-gray-50 border-gray-100'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isDarkTheme(theme) ? 'bg-teal-900/50' : 'bg-teal-100'
                          }`}>
                            <UserCheck className="w-3.5 h-3.5 text-teal-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                              {profile.full_name || profile.email || 'Unknown'}
                            </p>
                            <div className={`flex items-center gap-2 text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                              {profile.cdl_class && <span>CDL-{profile.cdl_class}</span>}
                              {(profile.city || profile.state) && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5" />
                                  {[profile.city, profile.state].filter(Boolean).join(', ')}
                                </span>
                              )}
                              {profile.email && <span className="truncate">{profile.email}</span>}
                            </div>
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            isDarkTheme(theme) ? 'bg-teal-900/50 text-teal-400' : 'bg-teal-100 text-teal-700'
                          }`}>
                            Storm
                          </span>
                        </button>
                      ))}
                      <div className={`px-3 py-2 text-xs ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`}>
                        Not the right person? Use the <span className="font-medium text-gray-500 dark:text-gray-300">invite someone not on Storm</span> section below.
                      </div>
                    </div>
                  )}

                  {showProfileDropdown && profileQuery.trim().length >= 2 && !isSearchingProfiles && profileResults.length === 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 px-3 py-3 text-xs ${
                      isDarkTheme(theme) ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-white border-gray-200 text-gray-400'
                    }`}>
                      No Storm profiles found — use the section below for name / email (email-only invite).
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              className="relative my-7"
              role="separator"
              aria-label="Alternative: invite someone who is not in Storm search results"
            >
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <span
                  className={cn(
                    'w-full border-t',
                    isDarkTheme(theme) ? 'border-gray-600/90' : 'border-gray-200 dark:border-gray-700',
                  )}
                />
              </div>
              <div className="relative flex justify-center px-2">
                <span
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
                    isDarkTheme(theme)
                      ? 'border-gray-600 bg-gray-900 text-gray-400'
                      : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400',
                  )}
                >
                  or
                </span>
              </div>
            </div>

            <div
              className={cn(
                'mb-6 rounded-xl border p-4 sm:p-5',
                isDarkTheme(theme)
                  ? 'border-amber-500/25 bg-gray-950/40'
                  : 'border-amber-100 bg-white dark:border-amber-900/30 dark:bg-gray-950/30',
              )}
            >
              <div className="mb-3 flex items-start gap-2">
                <div
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    isDarkTheme(theme) ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
                  )}
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h5 className={cn('text-sm font-semibold', isDarkTheme(theme) ? 'text-gray-100' : 'text-gray-900 dark:text-gray-100')}>
                    Invite someone not on Storm yet
                  </h5>
                  <p className={cn('text-xs leading-relaxed', isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400')}>
                    For anyone you do not find in search—prospects, referrals, or cold outreach. They use your link to join. Add an email if you want Storm to send the invite.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>
                    Candidate name
                    {selectedProfile && <span className="ml-1 text-teal-500">· from profile</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={form.candidateName}
                    onChange={(e) => setForm((f) => ({ ...f, candidateName: e.target.value }))}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className={label}>
                    Candidate email
                    {selectedProfile && <span className="ml-1 text-teal-500">· from profile</span>}
                  </label>
                  <input
                    type="email"
                    placeholder="Optional — needed to email from Storm"
                    value={form.candidateEmail}
                    onChange={(e) => setForm((f) => ({ ...f, candidateEmail: e.target.value }))}
                    className={inputBase}
                  />
                </div>
              </div>
            </div>

            <div
              className={cn(
                'border-t pt-5',
                isDarkTheme(theme) ? 'border-gray-700/70' : 'border-gray-200 dark:border-gray-700',
              )}
            >
              <p
                className={cn(
                  'mb-3 text-[10px] font-semibold uppercase tracking-wide',
                  isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400',
                )}
              >
                Optional details
              </p>
              {jobs.length > 0 && (
                <div className="mb-3">
                  <label className={label}>Link to job posting (optional)</label>
                  <select
                    value={form.jobPostingId}
                    onChange={(e) => setForm((f) => ({ ...f, jobPostingId: e.target.value }))}
                    className={inputBase}
                  >
                    <option value="">No specific job</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className={label}>Custom welcome message (optional)</label>
                <textarea
                  placeholder="Add a personal note to the candidate…"
                  value={form.welcomeMessage}
                  onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
                  rows={2}
                  className={`${inputBase} resize-none`}
                />
              </div>
            </div>

            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full flex-1 sm:w-auto"
                onClick={handleCreate}
                disabled={creating || !canSubmit}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {creating ? 'Creating…' : 'Create & copy link'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full shrink-0 sm:w-auto"
                onClick={() => {
                  setShowForm(false)
                  setError(null)
                  resetForm()
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Tabs + body ───────────────────────────────────────────────────
             Active = kanban by candidate invite status; stale completed → Archive.
             Vault  = every paid screening, even if the invite is gone.
             Archive = cancelled / expired + completed older than OUTREACH_STALE_COMPLETED_DAYS. */}
        {!isCollapsed && (
          <div
            className={cn(
              showForm ? 'mt-8 border-t border-gray-200 pt-6 dark:border-gray-700' : 'mt-5',
            )}
          >
            {/* Tab switcher */}
            <div
              className={cn(
                'mb-4 flex items-center gap-1 rounded-lg border p-1',
                isDarkTheme(theme)
                  ? 'border-gray-700/80 bg-gray-900/40'
                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30',
              )}
              role="tablist"
            >
              <TabButton
                label="Active outreach"
                count={boardInvites.length}
                badgeCount={readyToViewCount}
                badgeTitle={`${readyToViewCount} report${readyToViewCount === 1 ? '' : 's'} ready to view`}
                icon={<Users className="h-3.5 w-3.5" />}
                active={activeTab === 'active'}
                onClick={() => setActiveTab('active')}
                theme={theme}
              />
              <TabButton
                label="Files vault"
                count={screeningsRows.length}
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                active={activeTab === 'vault'}
                onClick={() => setActiveTab('vault')}
                theme={theme}
              />
              <TabButton
                label="Archive"
                count={archivedTabInvites.length}
                icon={<ArchiveIcon className="h-3.5 w-3.5" />}
                active={activeTab === 'archive'}
                onClick={() => setActiveTab('archive')}
                theme={theme}
              />
            </div>

            {/* ── ACTIVE tab ── */}
            {activeTab === 'active' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
                    <span className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                      Loading outreach…
                    </span>
                  </div>
                ) : invites.length === 0 ? (
                  <EmptyOutreach
                    theme={theme}
                    onNewOutreach={() => { setShowForm(true); setError(null); resetForm() }}
                  />
                ) : boardInvites.length === 0 ? (
                  <div className="py-10 text-center">
                    <Inbox
                      className={cn('mx-auto mb-3 h-10 w-10', isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-300')}
                    />
                    <p className={cn('text-sm font-medium', isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-800')}>
                      Nothing on your main board
                    </p>
                    <p className={cn('mx-auto mt-1 max-w-md text-xs', isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-600')}>
                      Completed outreaches move to Archive after {OUTREACH_STALE_COMPLETED_DAYS} days so daily work stays
                      uncluttered. Cancelled and expired invites are there too.
                    </p>
                    {archivedTabInvites.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        onClick={() => setActiveTab('archive')}
                      >
                        Open Archive ({archivedTabInvites.length})
                      </Button>
                    )}
                    <div className="mt-3 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-gray-600 dark:text-gray-400"
                        onClick={() => setShowKanbanHelp(true)}
                        aria-label="How this outreach board works"
                      >
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        How this board works
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {!showForm && (
                        <div className="flex justify-center px-2">
                          <NewOutreachCtaButton
                            theme={theme}
                            onClick={() => {
                              setShowForm(true)
                              setError(null)
                              resetForm()
                            }}
                          />
                        </div>
                      )}

                      <OutreachFilterBar
                        theme={theme}
                        search={search}
                        onSearchChange={setSearch}
                        statusFilters={statusChips}
                        selectedStatuses={selectedStatuses}
                        onToggleStatus={toggleStatus}
                        blockFilters={blockChips}
                        selectedBlocks={selectedBlocks}
                        onToggleBlock={toggleBlock}
                        sort={sort}
                        onSortChange={setSort}
                        showingCount={filteredActive.length}
                        totalCount={boardInvites.length}
                        onClearAll={clearAllFilters}
                        hasActiveFilters={hasActiveFilters}
                        sticky
                      />
                      <div className="mt-1 flex justify-end px-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-gray-600 dark:text-gray-400"
                          onClick={() => setShowKanbanHelp(true)}
                          aria-label="How this outreach board works"
                        >
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          How this board works
                        </Button>
                      </div>
                    </div>

                    {filteredActive.length === 0 ? (
                      <NoMatches theme={theme} onClear={clearAllFilters} />
                    ) : (
                      <KanbanBoard
                        invites={filteredActive}
                        screeningsByUserId={screeningsByUserId}
                        theme={theme}
                        copiedId={copiedId}
                        sendingEmailId={sendingEmailId}
                        emailSentId={emailSentId}
                        removingId={removingId}
                        savingNotesId={savingNotesId}
                        onCopy={copyToClipboard}
                        onShowQr={(inv) => setQrInvite(inv)}
                        onSendEmail={handleSendEmail}
                        onCancel={handleCancel}
                        onRemove={handleRemove}
                        onViewFile={handleViewFile}
                        onEdit={setEditingInvite}
                        onAskStormi={handleAskStormi}
                        onRecruiterNotesSave={handleRecruiterNotesSave}
                        onResendConsent={handleResendConsent}
                        resendingId={resendingId}
                        onPipelineStatusOverride={handleInviteStatusOverride}
                        statusOverrideSavingId={statusOverrideSavingId}
                      />
                    )}
                  </>
                )}
              </>
            )}

            {/* ── VAULT tab ── */}
            {activeTab === 'vault' && (
              <FilesVault
                rows={screeningsRows}
                consentBundles={consentBundles}
                loading={screeningsLoading}
                error={screeningsError}
                theme={theme}
                onView={handleViewFile}
              />
            )}

            {/* ── ARCHIVE tab ── */}
            {activeTab === 'archive' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
                    <span className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                      Loading…
                    </span>
                  </div>
                ) : archivedTabInvites.length === 0 ? (
                  <div className="py-10 text-center">
                    <ArchiveIcon
                      className={cn('mx-auto mb-2 h-10 w-10', isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-300')}
                    />
                    <p className={cn('text-sm font-medium', isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500')}>
                      No archived invites
                    </p>
                    <p className={cn('mt-1 text-xs', isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500')}>
                      Cancelled or expired invites, plus completed outreaches older than {OUTREACH_STALE_COMPLETED_DAYS}{' '}
                      days. Files stay in the vault.
                    </p>
                  </div>
                ) : (
                  <ArchiveTabContent
                    invites={filteredArchive}
                    totalCount={archivedTabInvites.length}
                    theme={theme}
                    search={search}
                    onSearchChange={setSearch}
                    sort={sort}
                    onSortChange={setSort}
                    onClearAll={clearAllFilters}
                    hasActiveFilters={hasActiveFilters}
                    onRestore={handleRestore}
                    onRemove={handleRemove}
                    removingId={removingId}
                    screeningsByUserId={screeningsByUserId}
                    onViewFile={handleViewFile}
                  />
                )}
              </>
            )}
          </div>
        )}
    </>
  )

  return (
    <>
      {embedded ? (
        // When embedded inside the parent Blocks & Outreach section,
        // render just header + body — the parent provides the panel chrome.
        <div className="flex min-w-0 w-full max-w-full flex-col">
          <div
            className={cn(
              'mb-5 min-w-0 border-b pb-5',
              isDarkTheme(theme) ? 'border-gray-700/80' : 'border-gray-200 dark:border-gray-700',
            )}
          >
            {outreachHeader}
          </div>
          {outreachBody}
        </div>
      ) : (
        <HubSectionPanel isDark={isDarkTheme(theme)} accent="amber">
          <BlockCard
            variant="embed"
            icon={Link2}
            title="Candidate outreach"
            description={
              !isCollapsed
                ? `${boardInvites.length > 0 ? `${boardInvites.length} active` : 'No active invites'} · Send invite links to candidates`
                : 'Expand to create and manage invite links.'
            }
          >
            {outreachBody}
          </BlockCard>
        </HubSectionPanel>
      )}

      {/* QR modal */}
      {qrInvite && (
        <QrModal
          url={qrInvite.url}
          name={qrInvite.candidateName || qrInvite.candidateEmail || qrInvite.url}
          onClose={() => setQrInvite(null)}
        />
      )}

      <OutreachKanbanInfoModal open={showKanbanHelp} onClose={() => setShowKanbanHelp(false)} />

      {/* Edit invite modal */}
      {editingInvite && (
        <EditInviteModal
          invite={editingInvite}
          jobs={jobs}
          blocksByCategory={blocksByCategory}
          installedEmployerBlockTypes={installedEmployerBlockTypes}
          walletAddress={walletAddress}
          theme={theme}
          onSave={handleEditInvite}
          onAddBlock={(newInvite) => {
            setInvites((prev) => [newInvite, ...prev])
            setEditingInvite(null)
            copyToClipboard(newInvite.url, newInvite.id)
          }}
          onClose={() => setEditingInvite(null)}
        />
      )}

      {/* Stormi mini-chat modal — per-candidate AI coaching */}
      {stormiTarget && employerContext && (
        <StormiCandidateModal
          invite={stormiTarget.invite}
          files={stormiTarget.files}
          employerContext={employerContext}
          walletAddress={walletAddress}
          theme={theme}
          onClose={() => setStormiTarget(null)}
        />
      )}

      {/* MVR / PSP file modals — opened from a card or vault row's View button.
          Authorized via `employerCandidateUserId` so the status APIs only succeed
          when the employer's company actually paid for the order. */}
      {mvrViewOrderId && activeFileCandidateId && (
        <MvrViewModal
          isOpen
          onClose={() => {
            setMvrViewOrderId(null)
            setActiveFileCandidateId(null)
            onRefreshScreenings?.()
          }}
          walletAddress={walletAddress}
          orderId={mvrViewOrderId}
          employerCandidateUserId={activeFileCandidateId}
        />
      )}
      {pspViewOrderId && activeFileCandidateId && (
        <PspViewModal
          isOpen
          onClose={() => {
            setPspViewOrderId(null)
            setActiveFileCandidateId(null)
            onRefreshScreenings?.()
          }}
          walletAddress={walletAddress}
          orderId={pspViewOrderId}
          employerCandidateUserId={activeFileCandidateId}
        />
      )}
    </>
  )
}

// ─── Tab button ──────────────────────────────────────────────────────────────

function TabButton({
  label,
  count,
  badgeCount = 0,
  badgeTitle,
  icon,
  active,
  onClick,
  theme,
}: {
  label: string
  count: number
  /** Optional red-dot count (e.g. "X reports ready") */
  badgeCount?: number
  badgeTitle?: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
  theme: string
}) {
  const isDark = isDarkTheme(theme)
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-2 sm:px-3',
        active
          ? isDark
            ? 'bg-gray-800 text-white shadow-sm'
            : 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
          : isDark
            ? 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            : 'text-gray-600 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px]',
          active
            ? isDark
              ? 'bg-gray-700 text-gray-200'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
            : isDark
              ? 'bg-gray-800/80 text-gray-400'
              : 'bg-gray-200 text-gray-600 dark:bg-gray-800/80 dark:text-gray-400',
        )}
      >
        {count}
      </span>
      {badgeCount > 0 && (
        <span
          title={badgeTitle}
          className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
        >
          {badgeCount}
        </span>
      )}
    </button>
  )
}

// ─── New outreach — single hero CTA (teal + amber hub accent, no header duplicate) ─

function NewOutreachCtaButton({ theme, onClick }: { theme: string; onClick: () => void }) {
  const isDark = isDarkTheme(theme)
  return (
    <Button
      type="button"
      variant="primary"
      size="lg"
      onClick={onClick}
      className={cn(
        'min-w-[min(100%,16rem)] justify-center gap-2.5 rounded-xl px-8 py-3.5 text-base font-bold tracking-tight',
        // Gradient + depth — overrides default flat primary for this one hero action
        '!bg-gradient-to-r !from-teal-500 !via-teal-500 !to-emerald-600 !text-white !shadow-none',
        'hover:!from-teal-400 hover:!via-teal-400 hover:!to-emerald-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2',
        isDark
          ? cn(
              'dark:!from-teal-400 dark:!via-teal-500 dark:!to-emerald-600',
              'dark:hover:!from-teal-300 dark:hover:!via-teal-400 dark:hover:!to-emerald-500',
              'focus-visible:ring-offset-gray-950',
              '!shadow-lg !shadow-teal-500/25 ring-2 ring-amber-400/45',
            )
          : cn(
              '!shadow-lg !shadow-teal-600/25 ring-2 ring-amber-400/70',
              'focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950',
            ),
      )}
    >
      <Plus className="h-5 w-5 shrink-0" aria-hidden />
      New outreach
    </Button>
  )
}

// ─── Empty + no-match states ─────────────────────────────────────────────────

function EmptyOutreach({ theme, onNewOutreach }: { theme: string; onNewOutreach: () => void }) {
  const isDark = isDarkTheme(theme)
  return (
    <div className="py-8 text-center">
      <Link2 className={cn('mx-auto mb-3 h-10 w-10', isDark ? 'text-amber-500/50' : 'text-amber-400')} />
      <p className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
        No active outreach
      </p>
      <p className={cn('mt-1 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
        Invite your first candidate to get started.
      </p>
      <div className="mt-6 flex justify-center px-2">
        <NewOutreachCtaButton theme={theme} onClick={onNewOutreach} />
      </div>
    </div>
  )
}

function NoMatches({ theme, onClear }: { theme: string; onClear: () => void }) {
  const isDark = isDarkTheme(theme)
  return (
    <div className="py-10 text-center">
      <Inbox className={cn('mx-auto mb-2 h-8 w-8', isDark ? 'text-gray-600' : 'text-gray-300')} />
      <p className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
        No matches
      </p>
      <p className={cn('mt-1 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
        Try a different search or clear the filters.
      </p>
      <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  )
}

// ─── Archive tab ─────────────────────────────────────────────────────────────

function ArchiveTabContent({
  invites,
  totalCount,
  theme,
  search,
  onSearchChange,
  sort,
  onSortChange,
  onClearAll,
  hasActiveFilters,
  onRestore,
  onRemove,
  removingId,
  screeningsByUserId,
  onViewFile,
}: {
  invites: Invite[]
  totalCount: number
  theme: string
  search: string
  onSearchChange: (v: string) => void
  sort: SortKey
  onSortChange: (s: SortKey) => void
  onClearAll: () => void
  hasActiveFilters: boolean
  onRestore: (id: string) => void
  onRemove: (id: string) => void
  removingId: string | null
  screeningsByUserId?: ScreeningsByUserId
  onViewFile: (file: ScreeningRow) => void
}) {
  const isDark = isDarkTheme(theme)
  return (
    <>
      <OutreachFilterBar
        theme={theme}
        search={search}
        onSearchChange={onSearchChange}
        enableKeyboardShortcut={false}
        sort={sort}
        onSortChange={onSortChange}
        showingCount={invites.length}
        totalCount={totalCount}
        onClearAll={onClearAll}
        hasActiveFilters={hasActiveFilters}
      />

      {invites.length === 0 ? (
        <NoMatches theme={theme} onClear={onClearAll} />
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {invites.map((invite) => {
            const files = invite.usedByUserId
              ? screeningsByUserId?.get(invite.usedByUserId) ?? []
              : []
            const isStaleCompleted = invite.status === 'completed' && isStaleCompletedOutreach(invite)
            const canRestore = invite.status === 'cancelled'
            const isExpired = invite.status === 'expired'
            const isRemoving = removingId === invite.id
            return (
              <div
                key={invite.id}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border p-3',
                  isDark ? 'border-gray-700/80 bg-gray-900/30' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/20',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                      {invite.candidateName || invite.candidateEmail || 'Anonymous invite'}
                    </p>
                    <p className={cn('truncate text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                      {isStaleCompleted
                        ? `Completed · auto-archived after ${OUTREACH_STALE_COMPLETED_DAYS}+ days on the board`
                        : `${STATUS_CHIP_LABEL[invite.status]} · created ${new Date(invite.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      isStaleCompleted
                        ? isDark
                          ? 'bg-emerald-900/35 text-emerald-200'
                          : 'bg-emerald-50 text-emerald-800'
                        : isExpired
                          ? isDark
                            ? 'bg-gray-800 text-gray-400'
                            : 'bg-gray-100 text-gray-600'
                          : isDark
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-red-50 text-red-700',
                    )}
                  >
                    {isStaleCompleted ? 'Archived' : STATUS_CHIP_LABEL[invite.status]}
                  </span>
                </div>

                {files.length > 0 && (
                  <div
                    className={cn(
                      'rounded-md border px-2 py-2 text-[11px]',
                      isDark ? 'border-gray-700/70 bg-gray-900/40' : 'border-gray-200 bg-gray-50 dark:border-gray-700/70 dark:bg-gray-900/20',
                    )}
                  >
                    <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-wide', isDark ? 'text-gray-500' : 'text-gray-500')}>
                      Files preserved
                    </p>
                    {files.map((f) => (
                      <button
                        key={`${f.kind}-${f.id}`}
                        type="button"
                        onClick={() => onViewFile(f)}
                        className={cn(
                          'mb-0.5 mr-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] last:mb-0',
                          isDark ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-white text-gray-800 hover:bg-gray-100',
                        )}
                      >
                        <ShieldCheck className="h-3 w-3 text-amber-500" />
                        {f.kind.toUpperCase()}
                        {f.dlState ? ` · ${f.dlState}` : ''}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {canRestore && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => onRestore(invite.id)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isRemoving}
                    onClick={() => onRemove(invite.id)}
                    className="text-red-700 dark:text-red-400"
                  >
                    {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Delete invite
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Edit invite modal ────────────────────────────────────────────────────────

/**
 * Two-section modal:
 *   Top    — edit mutable fields on the existing invite (name, email, job, message)
 *   Bottom — send another block to the same candidate (creates a new invite)
 */
function EditInviteModal({
  invite,
  jobs,
  blocksByCategory,
  installedEmployerBlockTypes,
  walletAddress,
  theme,
  onSave,
  onAddBlock,
  onClose,
}: {
  invite: Invite
  jobs: Job[]
  blocksByCategory: { category: { id: string; label: string }; blocks: typeof BLOCK_DEFINITIONS }[]
  installedEmployerBlockTypes: string[]
  walletAddress: string
  theme: string
  onSave: (
    id: string,
    patch: { candidateName?: string; candidateEmail?: string; jobPostingId?: string; welcomeMessage?: string },
  ) => Promise<void>
  onAddBlock: (newInvite: Invite) => void
  onClose: () => void
}) {
  const isDark = isDarkTheme(theme)

  const inputCls = cn(
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-teal-500/40',
    isDark
      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400',
  )

  const [name, setName] = useState(invite.candidateName ?? '')
  const [email, setEmail] = useState(invite.candidateEmail ?? '')
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // "Add another block" section
  const [newBlockType, setNewBlockType] = useState<string | null>(null)
  const [addingBlock, setAddingBlock] = useState(false)
  const [addBlockError, setAddBlockError] = useState<string | null>(null)

  // Blocks already invited for this candidate so we can filter them out
  const alreadyHasBlockType = invite.targetBlockType

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const patch: Parameters<typeof onSave>[1] = {}
      if (name !== (invite.candidateName ?? '')) patch.candidateName = name
      if (email !== (invite.candidateEmail ?? '')) patch.candidateEmail = email
      if (jobId) patch.jobPostingId = jobId
      if (message) patch.welcomeMessage = message
      await onSave(invite.id, patch)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleAddBlock = async () => {
    if (!newBlockType) return
    setAddingBlock(true)
    setAddBlockError(null)
    try {
      const res = await fetch('/api/employer/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({
          targetBlockType: newBlockType,
          candidateName: invite.candidateName || undefined,
          candidateEmail: invite.candidateEmail || undefined,
          candidateUserId: invite.usedByUserId || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'Failed to create invite')
      }
      const { invite: created } = await res.json()
      onAddBlock({ ...created, emailSentAt: created.emailSentAt ?? null })
    } catch (e: unknown) {
      setAddBlockError(e instanceof Error ? e.message : 'Failed to create invite')
    } finally {
      setAddingBlock(false)
    }
  }

  const sectionHead = cn(
    'mb-3 text-[10px] font-semibold uppercase tracking-wide',
    isDark ? 'text-gray-500' : 'text-gray-500',
  )

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndex={1200}>
      <ModalHeader
        title={`Edit: ${invite.candidateName || invite.candidateEmail || 'Anonymous invite'}`}
        subtitle="Update invite details or send another block to this candidate"
        onClose={onClose}
      />
      <div className="p-5 space-y-6">
        {/* ── Section 1: edit mutable fields ─────────────────────────────────── */}
        <div>
          <p className={sectionHead}>Invite details</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={cn('mb-1 block text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Candidate name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={cn('mb-1 block text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Candidate email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="Optional"
              />
            </div>
          </div>

          {jobs.length > 0 && (
            <div className="mt-3">
              <label className={cn('mb-1 block text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Link to job posting (optional)
              </label>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputCls}>
                <option value="">No specific job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-3">
            <label className={cn('mb-1 block text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Custom welcome message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className={cn(inputCls, 'resize-none')}
              placeholder="Add a personal note…"
            />
          </div>

          {saveError && <p className="mt-2 text-xs text-red-400">{saveError}</p>}

          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
              Save changes
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>

        {/* ── Section 2: add another block ────────────────────────────────────── */}
        {blocksByCategory.length > 0 && (
          <div
            className={cn(
              'rounded-xl border p-4',
              isDark ? 'border-teal-700/40 bg-teal-900/15' : 'border-teal-200 bg-teal-50',
            )}
          >
            <p className={cn(sectionHead, isDark ? 'text-teal-600' : 'text-teal-600')}>
              Send another block to this candidate
            </p>
            <p className={cn('mb-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
              Creates a new invite link for the same person. Current invite is unchanged.
            </p>

            <div
              className={cn(
                'rounded-lg border overflow-hidden',
                isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white',
              )}
            >
              {blocksByCategory.map(({ category, blocks }) => (
                <div key={category.id}>
                  <div
                    className={cn(
                      'px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b',
                      isDark
                        ? 'bg-gray-800 text-gray-500 border-gray-700'
                        : 'bg-gray-50 text-gray-400 border-gray-200',
                    )}
                  >
                    {category.label}
                  </div>
                  {blocks.map((block) => {
                    const isCurrentBlock = block.id === alreadyHasBlockType
                    const enabledByBlock = block.requiredEmployerBlocks?.find((eb) =>
                      installedEmployerBlockTypes.includes(eb),
                    )
                    const enabledByLabel = enabledByBlock
                      ? getEmployerBlockDefinition(enabledByBlock)?.label ?? enabledByBlock
                      : null
                    return (
                      <button
                        key={block.id}
                        type="button"
                        disabled={isCurrentBlock}
                        onClick={() => setNewBlockType(block.id === newBlockType ? null : block.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b last:border-b-0',
                          isCurrentBlock
                            ? 'opacity-40 cursor-not-allowed'
                            : newBlockType === block.id
                              ? isDark
                                ? 'bg-teal-900/40'
                                : 'bg-teal-50'
                              : isDark
                                ? 'hover:bg-gray-700/50 border-gray-700/50'
                                : 'hover:bg-gray-50 border-gray-100',
                        )}
                      >
                        <div
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                            newBlockType === block.id && !isCurrentBlock
                              ? isDark ? 'bg-teal-800/60' : 'bg-teal-100'
                              : isDark ? 'bg-gray-700' : 'bg-gray-100',
                          )}
                        >
                          <Package className={cn('w-3.5 h-3.5', newBlockType === block.id ? 'text-teal-500' : isDark ? 'text-gray-400' : 'text-gray-500')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              {block.label}
                            </p>
                            {isCurrentBlock && (
                              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')}>
                                already invited
                              </span>
                            )}
                            {enabledByLabel && !isCurrentBlock && (
                              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700')}>
                                via {enabledByLabel}
                              </span>
                            )}
                          </div>
                          <p className={cn('text-xs truncate', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {block.description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {addBlockError && <p className="mt-2 text-xs text-red-400">{addBlockError}</p>}

            {newBlockType && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={handleAddBlock}
                disabled={addingBlock}
              >
                {addingBlock ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                {addingBlock ? 'Creating…' : 'Create & copy link'}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Stormi per-candidate chat modal ──────────────────────────────────────────

/**
 * Lightweight Stormi chat scoped to one candidate. Auto-fires the first message
 * with that candidate's full context, then lets the employer ask follow-ups.
 * Uses `sendToStormi` directly — no dependency on the shared StormiChatPanel.
 */
function StormiCandidateModal({
  invite,
  files,
  employerContext,
  walletAddress,
  theme,
  onClose,
}: {
  invite: Invite
  files: ScreeningRow[]
  employerContext: EmployerHubContext
  walletAddress: string
  theme: string
  onClose: () => void
}) {
  const isDark = isDarkTheme(theme)

  type Msg = { role: 'user' | 'assistant'; text: string; hidden?: boolean }
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentAutoRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  const buildContextPrompt = useCallback(() => {
    const blockLabel = invite.targetBlockType
      ? (getBlockDefinition(invite.targetBlockType)?.label ?? invite.targetBlockType)
      : 'General invite'

    const filesSummary =
      files.length === 0
        ? 'No screenings ordered yet.'
        : files
            .map((f) => `${f.kind.toUpperCase()} — status: ${f.status}${f.resultOutcome ? `, outcome: ${f.resultOutcome}` : ''}`)
            .join('; ')

    return [
      `I need guidance on a specific candidate in my outreach pipeline.`,
      `Candidate: ${invite.candidateName || invite.candidateEmail || 'Anonymous'}.`,
      `Invite type: ${blockLabel}.`,
      `Current status: ${invite.status}.`,
      `Views: ${invite.viewCount}.`,
      `Screenings: ${filesSummary}`,
      invite.jobTitle ? `Linked job: ${invite.jobTitle}.` : null,
      invite.emailSentAt ? `Email was sent.` : `Email has not been sent yet.`,
      `What should I do next with this candidate? Give me specific, actionable advice.`,
    ]
      .filter(Boolean)
      .join(' ')
  }, [invite, files])

  const doSend = useCallback(
    async (text: string, history: Msg[], displayText?: string) => {
      if (loading) return
      setLoading(true)
      setError(null)
      // Show `displayText` in the chat bubble (clean summary for the user),
      // but send `text` to the API (full context for Stormi).
      // If `displayText` is 'hidden', skip showing the user bubble entirely
      // (used for the auto-fire first message so the modal opens clean).
      if (displayText !== '__hidden__') {
        setMessages((prev) => [...prev, { role: 'user', text: displayText ?? text }])
      }
      scrollToBottom()

      const conversationHistory: StormiConversationTurn[] = history
        .map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        }))

      try {
        const res = await sendToStormi({
          message: text,
          audience: 'employer',
          employerContext,
          walletAddress,
          conversationHistory,
        })
        setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }])
        scrollToBottom()
      } catch (e) {
        if (e instanceof OutOfCreditsError) {
          setError('Out of Stormi credits for today. Try again tomorrow or purchase more.')
        } else {
          setError(e instanceof Error ? e.message : 'Failed to get a response')
        }
      } finally {
        setLoading(false)
      }
    },
    [loading, employerContext, walletAddress, scrollToBottom],
  )

  // Auto-fire the context message — hidden from the chat UI, Stormi just responds
  useEffect(() => {
    if (sentAutoRef.current) return
    sentAutoRef.current = true
    const prompt = buildContextPrompt()
    doSend(prompt, [], '__hidden__')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    doSend(text, messages)
  }

  const candidateLabel = invite.candidateName || invite.candidateEmail || 'this candidate'

  const suggestedFollowUps = [
    'Should I resend the email?',
    'What screenings should I order?',
    'How can I improve my outreach?',
  ]

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndex={1250}>
      <ModalHeader
        title={`Stormi — ${candidateLabel}`}
        subtitle="AI coaching for this candidate"
        onClose={onClose}
      />
      <div className="flex flex-col" style={{ height: 'min(60vh, 28rem)' }}>
        {/* Message thread */}
        <div
          ref={scrollRef}
          className={cn(
            'flex-1 overflow-y-auto px-4 py-3 space-y-3',
            isDark ? 'bg-gray-900/60' : 'bg-gray-50 dark:bg-gray-900/40',
          )}
        >
          {/* Context card — always visible so the employer knows what Stormi sees */}
          <div
            className={cn(
              'rounded-xl border px-3 py-2.5 text-xs',
              isDark
                ? 'border-gray-700/70 bg-gray-800/60 text-gray-400'
                : 'border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400',
            )}
          >
            <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-wide', isDark ? 'text-violet-400' : 'text-violet-600')}>
              Context shared with Stormi
            </p>
            <p>
              <strong>{invite.candidateName || invite.candidateEmail || 'Anonymous'}</strong>
              {' · '}
              {invite.targetBlockType
                ? (getBlockDefinition(invite.targetBlockType)?.label ?? invite.targetBlockType)
                : 'General invite'}
              {' · '}
              {invite.status}
              {invite.viewCount > 0 ? ` · ${invite.viewCount} views` : ''}
              {files.length > 0 ? ` · ${files.length} screening${files.length === 1 ? '' : 's'}` : ''}
            </p>
          </div>

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? isDark
                      ? 'rounded-tr-sm bg-teal-800/60 text-teal-50'
                      : 'rounded-tr-sm bg-teal-600 text-white'
                    : isDark
                      ? 'rounded-tl-sm bg-violet-900/40 text-violet-100 border border-violet-700/40'
                      : 'rounded-tl-sm bg-violet-50 text-violet-900 border border-violet-200',
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <Bot className={cn('h-3.5 w-3.5', isDark ? 'text-violet-400' : 'text-violet-600')} />
                    <span className={cn('text-[10px] font-semibold', isDark ? 'text-violet-400' : 'text-violet-600')}>
                      Stormi
                    </span>
                  </div>
                )}
                <StormiChatMarkdown
                  text={msg.text}
                  variant={msg.role === 'user' ? 'user' : 'assistant'}
                  isDark={isDark}
                />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-2xl rounded-tl-sm px-3.5 py-2.5',
                  isDark
                    ? 'bg-violet-900/40 text-violet-300 border border-violet-700/40'
                    : 'bg-violet-50 text-violet-600 border border-violet-200',
                )}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs">Stormi is thinking…</span>
              </div>
            </div>
          )}
          {error && (
            <p className="text-center text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Suggested follow-ups — only show after the first response */}
        {messages.length >= 2 && !loading && (
          <div
            className={cn(
              'flex flex-wrap gap-1.5 border-t px-3 py-2',
              isDark ? 'border-gray-700/80 bg-gray-900/40' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/30',
            )}
          >
            {suggestedFollowUps.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setInput('')
                  doSend(label, messages)
                }}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
                  isDark
                    ? 'border-violet-700/50 text-violet-300 hover:bg-violet-900/30'
                    : 'border-violet-200 text-violet-700 hover:bg-violet-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className={cn(
            'flex items-center gap-2 border-t px-3 py-2.5',
            isDark ? 'border-gray-700/80' : 'border-gray-200 dark:border-gray-700',
          )}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up…"
            disabled={loading}
            className={cn(
              'min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-violet-500/40',
              isDark
                ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-500'
                : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400',
            )}
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading || !input.trim()}
            className="shrink-0"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </Modal>
  )
}

// ─── Selected block pill ──────────────────────────────────────────────────────

function SelectedBlockPill({ blockType, theme, onClear }: { blockType: string; theme: string; onClear: () => void }) {
  const block = getBlockDefinition(blockType)
  if (!block) return null

  return (
    <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
      isDarkTheme(theme)
        ? 'bg-teal-900/30 border-teal-700/50'
        : 'bg-teal-50 border-teal-200'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          isDarkTheme(theme) ? 'bg-teal-900/50' : 'bg-teal-100'
        }`}>
          <Package className="w-3.5 h-3.5 text-teal-500" />
        </div>
        <div>
          <p className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-teal-300' : 'text-teal-700'}`}>
            {block.label}
          </p>
          <p className={`text-xs ${isDarkTheme(theme) ? 'text-teal-500/80' : 'text-teal-500'}`}>
            {block.description}
          </p>
        </div>
      </div>
      <button
        onClick={onClear}
        className={`text-xs font-medium flex items-center gap-1 ${
          isDarkTheme(theme) ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <ArrowLeft className="w-3 h-3" />
        Change
      </button>
    </div>
  )
}

// ─── (legacy InviteRow removed — replaced by OutreachCandidateCard) ──────────
