'use client'

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
import QRCode from 'qrcode'
import { PROVVEN_QR_OPTS, stampProvvenMarkOnCanvas } from '@/lib/provven-qr'
import KanbanBoard from '@/components/employer/outreach/KanbanBoard'
import OutreachKanbanInfoModal from '@/components/employer/outreach/OutreachKanbanInfoModal'
import OutreachFilterBar, { type FilterChipDef, type SortKey } from '@/components/employer/outreach/OutreachFilterBar'
import FilesVault from '@/components/employer/outreach/FilesVault'
import StormiChatMarkdown from '@/components/employer/outreach/StormiChatMarkdown'
import MvrViewModal from '@/components/MvrViewModal'
import PspViewModal from '@/components/PspViewModal'
import EmployerConsentPackageModal from '@/components/employer/EmployerConsentPackageModal'
import type { Invite, InviteStatus, ScreeningRow, ScreeningsByUserId } from '@/components/employer/outreach/types'
import type { ConsentBundleSummary } from '@/hooks/useEmployerScreenings'
import {
  OUTREACH_KANBAN_COLUMNS,
  isInviteInArchiveTab,
  isInviteOnActiveKanban,
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
  Package,
  ShieldCheck,
  FileCheck,
  Inbox,
  Archive as ArchiveIcon,
  RotateCcw,
  Download,
  Share2,
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
  sessionUserId: string
  /** All MVR + PSP screenings the company has paid for (hoisted from EmployerHub) */
  screeningsRows?: ScreeningRow[]
  /** Same data, indexed by candidate user id for O(1) lookup on each card */
  screeningsByUserId?: ScreeningsByUserId
  screeningsLoading?: boolean
  screeningsError?: string | null
  /** Signed consent packages (FCRA + FMCSA PSP + CDLIS bundles) for the vault */
  consentBundles?: ConsentBundleSummary[]
  /** Latest consent bundle per candidate user id — kanban + detail modal file pills */
  consentBundleByUserId?: Map<string, ConsentBundleSummary>
  /** Optional refresh handler — wired to the tab refresh button */
  onRefreshScreenings?: () => void
  /** Employer hub context — passed through so the mini Stormi modal can call the AI API */
  employerContext?: EmployerHubContext | null
  /** Company ID and wallet address — used for direct MVR/PSP ordering from the edit modal */
  companyId?: string | null
  companyWalletAddress?: string | null
}

// MVR/PSP are never email invites — they're paid orders placed from the edit
// modal once the candidate's consent bundle is complete.
const DIRECT_ORDER_ONLY_BLOCKS = new Set(['driver-psp', 'driver-mvr'])

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
  return `provven-invite-qr-${slug}.png`
}

function QrModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const { theme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    void QRCode.toCanvas(canvas, url, {
      width: 240,
      margin: 2,
      ...PROVVEN_QR_OPTS,
    }).then(() => stampProvvenMarkOnCanvas(canvas))
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
            title: 'Provven invite',
            text: `Open or scan: ${url}`,
          })
          return
        }
      }
      await navigator.share({ title: 'Provven invite', text: url })
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

  const muted = false ? 'text-gray-400' : 'text-gray-500'
  const sub = false ? 'text-gray-500' : 'text-gray-600'

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

// Stable empty map — avoids allocating `new Map()` on every render when prop omitted.
const EMPTY_CONSENT_BUNDLE_BY_USER_ID = new Map<string, ConsentBundleSummary>()

// ─── Main component ───────────────────────────────────────────────────────────

export default function CandidateOutreach({
  sessionUserId,
  screeningsRows = [],
  screeningsByUserId,
  screeningsLoading = false,
  screeningsError = null,
  consentBundles = [],
  consentBundleByUserId,
  onRefreshScreenings,
  employerContext = null,
  companyId = null,
  companyWalletAddress = null,
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
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null)
  const [smsSentId, setSmsSentId] = useState<string | null>(null)
  const [qrInvite, setQrInvite] = useState<Invite | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [statusOverrideSavingId, setStatusOverrideSavingId] = useState<string | null>(null)
  const [showKanbanHelp, setShowKanbanHelp] = useState(false)

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
  const [consentView, setConsentView] = useState<{ bundleId: string; candidateName: string } | null>(null)

  const [form, setForm] = useState({
    candidateEmail: '',
    candidatePhone: '',
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

  // Screening consent is the only email-invite outreach. The DOT application is
  // a core block auto-installed on every driver hub (their built-in first
  // to-do), and MVR/PSP are direct orders placed from the edit modal after
  // consent is signed. Derived from the registry rather than hard-coded so the
  // invite stays honest about what it asks for.
  const outreachBlock = useMemo(
    () =>
      BLOCK_DEFINITIONS.find(
        (b) =>
          b.employerRequestable &&
          !DIRECT_ORDER_ONLY_BLOCKS.has(b.id) &&
          employerCanRequest(b, installedEmployerBlockTypes),
      ) ?? null,
    [installedEmployerBlockTypes],
  )

  // Edit modal needs the full list including screening blocks (for direct-order UI)
  const allBlocksByCategory = useMemo(() => {
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
      const res = await fetch('/api/employer/invites')
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
  }, [sessionUserId])

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/employer/jobs')
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
      }
    } catch (err) {
      console.error('[CandidateOutreach] fetchJobs error:', err)
    }
  }, [sessionUserId])

  useEffect(() => {
    if (sessionUserId) {
      fetchInvites()
      fetchJobs()
    }
  }, [sessionUserId, hubRefreshNonce, fetchInvites, fetchJobs])

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
          {  }
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
  }, [profileQuery, sessionUserId])

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
    setForm({
      candidateEmail: '',
      candidatePhone: '',
      candidateName: '',
      candidateUserId: '',
      jobPostingId: '',
      welcomeMessage: '',
    })
    setSelectedProfile(null)
    setProfileQuery('')
    setProfileResults([])
  }

  const handleCreate = async () => {
    if (!outreachBlock) return
    setCreating(true)
    setError(null)
    try {
      const targetBlockType = outreachBlock.id

      const res = await fetch('/api/employer/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          targetBlockType,
          candidateEmail: form.candidateEmail || undefined,
          candidatePhone: form.candidatePhone || undefined,
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
      setInvites((prev) => [
        {
          ...invite,
          emailSentAt: invite.emailSentAt ?? null,
          smsSentAt: invite.smsSentAt ?? null,
          candidatePhone: invite.candidatePhone ?? null,
        },
        ...prev,
      ])
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
        headers: { 'Content-Type': 'application/json'},
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
        headers: { 'Content-Type': 'application/json'},
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

  const handleSendSms = async (invite: Invite, phoneOverride?: string) => {
    const phone = phoneOverride || invite.candidatePhone
    if (!phone) return

    setSendingSmsId(invite.id)
    setError(null)

    try {
      const res = await fetch('/api/employer/invites/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: invite.id, phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send text')

      const sentTo =
        typeof data.sentTo === 'string' && data.sentTo ? data.sentTo : phone
      setInvites((prev) =>
        prev.map((inv) =>
          inv.id === invite.id
            ? { ...inv, candidatePhone: sentTo, smsSentAt: new Date().toISOString() }
            : inv,
        ),
      )
      setSmsSentId(invite.id)
      setTimeout(() => setSmsSentId(null), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Text send failed')
    } finally {
      setSendingSmsId(null)
    }
  }

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  /** Edit an invite's mutable fields (name, email, phone, job, welcome message). */
  const handleEditInvite = async (
    inviteId: string,
    patch: {
      candidateName?: string
      candidateEmail?: string
      candidatePhone?: string
      jobPostingId?: string
      welcomeMessage?: string
    },
  ) => {
    const res = await fetch('/api/employer/invites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ id: inviteId, ...patch }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error((d as { error?: string }).error ?? 'Failed to update invite')
    }
    const data = await res.json().catch(() => ({})) as {
      invite?: { candidatePhone?: string | null }
    }
    // Optimistic local update — the API returns the new field values
    setInvites((prev) =>
      prev.map((inv) =>
        inv.id === inviteId
          ? {
              ...inv,
              candidateName: patch.candidateName ?? inv.candidateName,
              candidateEmail: patch.candidateEmail ?? inv.candidateEmail,
              candidatePhone:
                data.invite?.candidatePhone !== undefined
                  ? data.invite.candidatePhone
                  : patch.candidatePhone !== undefined
                    ? patch.candidatePhone || null
                    : inv.candidatePhone,
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
          headers: { 'Content-Type': 'application/json'},
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
    [sessionUserId],
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
          headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
            targetBlockType: invite.targetBlockType ?? undefined,
            candidateEmail: invite.candidateEmail ?? undefined,
            candidatePhone: invite.candidatePhone ?? undefined,
            candidateName: invite.candidateName ?? undefined,
            candidateUserId: invite.usedByUserId ?? undefined,
            jobPostingId: invite.jobPostingId ?? undefined,
            welcomeMessage:
              "We hit a snag with your last screening — likely a typo in the driver's license field. Please re-sign so we can re-pull the report. Thanks!",
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to resend consent')
        const newInvite: Invite = {
          ...data.invite,
          emailSentAt: data.invite.emailSentAt ?? null,
          smsSentAt: data.invite.smsSentAt ?? null,
          candidatePhone: data.invite.candidatePhone ?? null,
        }
        setInvites((prev) => [newInvite, ...prev])

        // Auto-email when on file; SMS stays manual (same as create — avoid surprise texts).
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
    [sessionUserId],
  )

  /** Force `application_invites.status` from the kanban detail modal (Pace ops / stuck sync). */
  const handleInviteStatusOverride = useCallback(
    async (inviteId: string, nextStatus: InviteStatus) => {
      setStatusOverrideSavingId(inviteId)
      setError(null)
      try {
        const res = await fetch('/api/employer/invites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json'},
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
    [sessionUserId],
  )

  // ── Stormi mini modal state ──────────────────────────────────────────────
  const [stormiTarget, setStormiTarget] = useState<{
    invite: Invite
    files: ScreeningRow[]
    consentBundle: ConsentBundleSummary | null
  } | null>(null)

  const consentBundleMap = consentBundleByUserId ?? EMPTY_CONSENT_BUNDLE_BY_USER_ID

  const handleAskStormi = useCallback(
    (invite: Invite) => {
      const uid = invite.usedByUserId
      const files = uid ? screeningsByUserId?.get(uid) ?? [] : []
      const consentBundle = uid ? consentBundleMap.get(uid) ?? null : null
      setStormiTarget({ invite, files, consentBundle })
    },
    [screeningsByUserId, consentBundleMap],
  )

  // ── Derived: tab buckets, filter chips, "ready to view" count ─────────────
  // Board = full candidate lifecycle (pending → completed); completed stays on
  // the board indefinitely. Archive tab = cancelled / expired only.
  const boardInvites = useMemo(() => {
    const active = invites.filter(isInviteOnActiveKanban)

    // Deduplicate: if a candidate has both a driver-screening-consent invite
    // AND a legacy driver-psp/driver-mvr invite, only keep the consent one.
    const consentEmails = new Set<string>()
    const consentUserIds = new Set<string>()
    for (const inv of active) {
      if (inv.targetBlockType !== 'driver-screening-consent') continue
      const email = (inv.candidateEmail ?? '').trim().toLowerCase()
      if (email) consentEmails.add(email)
      if (inv.usedByUserId) consentUserIds.add(inv.usedByUserId)
    }

    return active.filter((inv) => {
      if (inv.targetBlockType !== 'driver-psp' && inv.targetBlockType !== 'driver-mvr') return true
      const email = (inv.candidateEmail ?? '').trim().toLowerCase()
      if (email && consentEmails.has(email)) return false
      if (inv.usedByUserId && consentUserIds.has(inv.usedByUserId)) return false
      return true
    })
  }, [invites])
  const archivedTabInvites = useMemo(() => invites.filter(isInviteInArchiveTab), [invites])

  const readyToViewCount = useMemo(() => {
    if (!screeningsByUserId) return 0
    let n = 0
    for (const inv of boardInvites) {
      if (!inv.usedByUserId) continue
      const files = screeningsByUserId.get(inv.usedByUserId)
      if (!files) continue
      for (const f of files) {
        const s = String(f.status ?? '').toLowerCase()
        if (s === 'completed' || s === 'needs_review') n++
      }
    }
    return n
  }, [boardInvites, screeningsByUserId])

  /** Refresh screenings then re-fetch invites so kanban columns catch up after reconcile. */
  const handleRefreshScreeningsAndInvites = useCallback(async () => {
    await onRefreshScreenings?.()
    await fetchInvites()
  }, [onRefreshScreenings, fetchInvites])

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
    // With consent-only outreach most boards have one block type — a single
    // chip can't filter anything, so hide the row entirely.
    if (counts.size < 2) return []
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
          const blob = [inv.candidateName, inv.candidateEmail, inv.candidatePhone, inv.jobTitle]
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
        headers: { 'Content-Type': 'application/json'},
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

  const openConsent = useCallback((bundle: ConsentBundleSummary) => {
    setConsentView({
      bundleId: bundle.id,
      candidateName: bundle.candidateName ?? 'Candidate',
    })
  }, [])

  const canSubmit = outreachBlock !== null

  const openCreateForm = () => {
    setShowForm(true)
    setError(null)
    resetForm()
  }

  const closeCreateForm = () => {
    setShowForm(false)
    setError(null)
    resetForm()
  }

  // Paper inputs — this modal sits on the paper hub, so we ignore the app theme.
  const inputBase =
    'w-full px-3 py-2 rounded-lg text-sm border border-stone-200 bg-white text-[#173150] placeholder-ironside outline-none transition-colors focus:ring-2 focus:ring-teal-500/40'
  const label = 'block text-xs font-medium mb-1 text-ironside'

  const outreachBody = (
    <>
        {/* ── Tabs + body ───────────────────────────────────────────────────
             Active = kanban by candidate invite status; completed stays on the board.
             Vault  = every paid screening, even if the invite is gone.
             Archive = cancelled / expired invites only. */}
          <div>
            {/* Tab switcher — the board-help info button lives here so it exists
                exactly once instead of repeating in every tab/empty state */}
            <div className="mb-5 flex items-end gap-2">
            <div className="flex min-w-0 flex-1 gap-1 border-b border-stone-200" role="tablist">
              <TabButton
                label="Active"
                count={boardInvites.length}
                badgeCount={readyToViewCount}
                badgeTitle={`${readyToViewCount} report${readyToViewCount === 1 ? '' : 's'} ready to view`}
                active={activeTab === 'active'}
                onClick={() => setActiveTab('active')}
              />
              <TabButton
                label="Files"
                count={screeningsRows.length}
                active={activeTab === 'vault'}
                onClick={() => setActiveTab('vault')}
              />
              <TabButton
                label="Archive"
                count={archivedTabInvites.length}
                active={activeTab === 'archive'}
                onClick={() => setActiveTab('archive')}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-0.5 !p-2 shrink-0 text-ironside"
              onClick={() => setShowKanbanHelp(true)}
              aria-label="How this outreach board works"
              title="How this board works"
            >
              <Info className="h-4 w-4" />
            </Button>
            </div>

            {/* ── ACTIVE tab ── */}
            {activeTab === 'active' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
                    <span className={`text-sm ${false ? 'text-gray-400' : 'text-gray-500'}`}>
                      Loading outreach…
                    </span>
                  </div>
                ) : invites.length === 0 ? (
                  <EmptyOutreach onNewOutreach={openCreateForm} />
                ) : boardInvites.length === 0 ? (
                  <div className="py-10 text-center">
                    <Inbox
                      className={cn('mx-auto mb-3 h-10 w-10', false ? 'text-gray-600' : 'text-gray-300')}
                    />
                    <p className={cn('text-sm font-medium', false ? 'text-gray-300' : 'text-gray-800')}>
                      Nothing on your main board
                    </p>
                    <p className={cn('mx-auto mt-1 max-w-md text-xs', false ? 'text-gray-500' : 'text-gray-600')}>
                      Completed outreaches stay on the board so you can keep working them. Cancelled and expired
                      invites live in Archive.
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
                  </div>
                ) : (
                  <>
                    {/* Search/filters only earn their space once the board is busy —
                        a handful of cards doesn't need a filter bar. */}
                    {(boardInvites.length > 5 || hasActiveFilters) && (
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
                      />
                    )}

                    {filteredActive.length === 0 ? (
                      <NoMatches theme={theme} onClear={clearAllFilters} />
                    ) : (
                      <KanbanBoard
                        invites={filteredActive}
                        screeningsByUserId={screeningsByUserId}
                        consentBundleByUserId={consentBundleMap}
                        theme={theme}
                        copiedId={copiedId}
                        sendingEmailId={sendingEmailId}
                        emailSentId={emailSentId}
                        sendingSmsId={sendingSmsId}
                        smsSentId={smsSentId}
                        removingId={removingId}
                        savingNotesId={savingNotesId}
                        onCopy={copyToClipboard}
                        onShowQr={(inv) => setQrInvite(inv)}
                        onSendEmail={handleSendEmail}
                        onSendSms={handleSendSms}
                        onCancel={handleCancel}
                        onRemove={handleRemove}
                        onViewFile={handleViewFile}
                        onViewConsent={openConsent}
                        onEdit={setEditingInvite}
                        onAskStormi={handleAskStormi}
                        onRecruiterNotesSave={handleRecruiterNotesSave}
                        onResendConsent={handleResendConsent}
                        resendingId={resendingId}
                        onPipelineStatusOverride={handleInviteStatusOverride}
                        statusOverrideSavingId={statusOverrideSavingId}
                        onRefreshScreenings={handleRefreshScreeningsAndInvites}
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
                onViewConsent={openConsent}
              />
            )}

            {/* ── ARCHIVE tab ── */}
            {activeTab === 'archive' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
                    <span className={`text-sm ${false ? 'text-gray-400' : 'text-gray-500'}`}>
                      Loading…
                    </span>
                  </div>
                ) : archivedTabInvites.length === 0 ? (
                  <div className="py-10 text-center">
                    <ArchiveIcon
                      className={cn('mx-auto mb-2 h-10 w-10', false ? 'text-gray-600' : 'text-gray-300')}
                    />
                    <p className={cn('text-sm font-medium', false ? 'text-gray-400' : 'text-gray-500')}>
                      No archived invites
                    </p>
                    <p className={cn('mt-1 text-xs', false ? 'text-gray-500' : 'text-gray-500')}>
                      Cancelled or expired invites. Files stay in the vault.
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
                    consentBundleByUserId={consentBundleMap}
                    onViewFile={handleViewFile}
                    onViewConsent={openConsent}
                  />
                )}
              </>
            )}
          </div>
    </>
  )

  return (
    <>
      <HubSectionPanel isDark={false} accent="amber">
        <BlockCard
          variant="embed"
          paper
          icon={Link2}
          title="Candidate outreach"
          description={
            boardInvites.length > 0
              ? `${boardInvites.length} active — invite candidates and track their screenings.`
              : 'Invite candidates and track their screenings.'
          }
          headerActions={
            <Button type="button" variant="primary" size="sm" onClick={openCreateForm}>
              <Plus className="h-4 w-4" />
              New outreach
            </Button>
          }
        >
          {outreachBody}
        </BlockCard>
      </HubSectionPanel>

      {showForm && (
        <Modal
          onClose={closeCreateForm}
          maxWidth="max-w-xl"
          panelShape="block"
          panelClassName="!border-stone-200 !bg-white !ring-[#173150]/10"
        >
          <ModalHeader
            title="New outreach"
            subtitle="Invite a candidate to sign screening consent."
            onClose={closeCreateForm}
            variant="block"
            paper
          />
          <div className="space-y-5 p-4 sm:p-5">
            <p className="text-xs leading-relaxed text-ironside">
              They sign FCRA + PSP + CDLIS consent so you can order MVR and PSP. The DOT
              application is already a to-do on their career card.
            </p>

            <div ref={profileSearchRef}>
              <label className={label}>Find someone already on Provven</label>
              {selectedProfile ? (
                <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserCheck className="h-4 w-4 shrink-0 text-teal-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#173150]">
                        {selectedProfile.full_name || selectedProfile.email}
                      </p>
                      <p className="text-xs text-ironside">On Provven — they’ll get an in-app notification</p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleClearProfile}>
                    <X className="h-3 w-3" />
                    Clear
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ironside" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or city…"
                    value={profileQuery}
                    onChange={(e) => setProfileQuery(e.target.value)}
                    onFocus={() => profileResults.length > 0 && setShowProfileDropdown(true)}
                    className={`${inputBase} pl-8`}
                  />
                  {isSearchingProfiles && (
                    <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-teal-500" />
                  )}
                  {showProfileDropdown && profileResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
                      {profileResults.map((profile, index) => (
                        <button
                          key={profile.user_id || `profile-${index}`}
                          type="button"
                          onClick={() => handleSelectProfile(profile)}
                          className="flex w-full items-center gap-3 border-b border-stone-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-stone-50"
                        >
                          <UserCheck className="h-4 w-4 shrink-0 text-teal-600" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[#173150]">
                              {profile.full_name || profile.email || 'Unknown'}
                            </p>
                            <p className="truncate text-xs text-ironside">
                              {[
                                profile.cdl_class && `CDL-${profile.cdl_class}`,
                                [profile.city, profile.state].filter(Boolean).join(', '),
                                profile.email,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showProfileDropdown &&
                    profileQuery.trim().length >= 2 &&
                    !isSearchingProfiles &&
                    profileResults.length === 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-stone-200 bg-white px-3 py-3 text-xs text-ironside shadow-xl">
                        No match — enter name and email below instead.
                      </div>
                    )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>
                  Name{selectedProfile ? <span className="text-teal-600"> · from profile</span> : ''}
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
                  Email{selectedProfile ? <span className="text-teal-600"> · from profile</span> : ''}
                </label>
                <input
                  type="email"
                  placeholder="Needed to email the invite"
                  value={form.candidateEmail}
                  onChange={(e) => setForm((f) => ({ ...f, candidateEmail: e.target.value }))}
                  className={inputBase}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Phone</label>
                <input
                  type="tel"
                  placeholder="Needed to text the invite (US 10-digit or +1…)"
                  value={form.candidatePhone}
                  onChange={(e) => setForm((f) => ({ ...f, candidatePhone: e.target.value }))}
                  className={inputBase}
                />
              </div>
            </div>

            {jobs.length > 0 && (
              <div>
                <label className={label}>Job posting (optional)</label>
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

            <div>
              <label className={label}>Note (optional)</label>
              <textarea
                placeholder="A short personal note…"
                value={form.welcomeMessage}
                onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
                rows={2}
                className={`${inputBase} resize-none`}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full"
              onClick={handleCreate}
              disabled={creating || !canSubmit}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {creating ? 'Creating…' : 'Create & copy link'}
            </Button>
          </div>
        </Modal>
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
          blocksByCategory={allBlocksByCategory}
          sessionUserId={sessionUserId}
          companyId={companyId}
          companyWalletAddress={companyWalletAddress}
          consentBundle={editingInvite.usedByUserId ? (consentBundleByUserId?.get(editingInvite.usedByUserId) ?? null) : null}
          theme={theme}
          onSave={handleEditInvite}
          onAddBlock={(newInvite) => {
            setInvites((prev) => [newInvite, ...prev])
            setEditingInvite(null)
            copyToClipboard(newInvite.url, newInvite.id)
          }}
          onOrderPlaced={() => {
            setEditingInvite(null)
            void handleRefreshScreeningsAndInvites()
          }}
          onClose={() => setEditingInvite(null)}
        />
      )}

      {/* Stormi mini-chat modal — per-candidate AI coaching */}
      {stormiTarget && employerContext && (
        <StormiCandidateModal
          invite={stormiTarget.invite}
          files={stormiTarget.files}
          consentBundle={stormiTarget.consentBundle}
          employerContext={employerContext}
          sessionUserId={sessionUserId}
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
            void handleRefreshScreeningsAndInvites()
          }}
          sessionUserId={sessionUserId}
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
            void handleRefreshScreeningsAndInvites()
          }}
          sessionUserId={sessionUserId}
          orderId={pspViewOrderId}
          employerCandidateUserId={activeFileCandidateId}
        />
      )}
      {consentView && (
        <EmployerConsentPackageModal
          bundleId={consentView.bundleId}
          candidateName={consentView.candidateName}
          onClose={() => setConsentView(null)}
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
  active,
  onClick,
}: {
  label: string
  count: number
  /** Reports ready to view — shown as a readable label, not a mystery red dot. */
  badgeCount?: number
  badgeTitle?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-[#173150] text-[#173150]'
          : 'border-transparent text-ironside hover:text-[#173150]',
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums text-xs text-ironside">{count}</span>
      {badgeCount > 0 && (
        <span
          title={badgeTitle}
          className="rounded-full bg-[#f15a2b]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#f15a2b]"
        >
          {badgeCount} ready
        </span>
      )}
    </button>
  )
}

// ─── Empty + no-match states ─────────────────────────────────────────────────

function EmptyOutreach({ onNewOutreach }: { onNewOutreach: () => void }) {
  return (
    <div className="py-8 text-center">
      <Link2 className="mx-auto mb-3 h-10 w-10 text-amber-400" />
      <p className="text-sm font-medium text-gray-700">
        No active outreach
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Invite your first candidate to get started.
      </p>
      <div className="mt-5 flex justify-center">
        <Button type="button" variant="primary" size="md" onClick={onNewOutreach}>
          <Plus className="h-4 w-4" />
          New outreach
        </Button>
      </div>
    </div>
  )
}

function NoMatches({ theme, onClear }: { theme: string; onClear: () => void }) {
  const isDark = false
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
  consentBundleByUserId,
  onViewFile,
  onViewConsent,
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
  consentBundleByUserId?: Map<string, ConsentBundleSummary>
  onViewFile: (file: ScreeningRow) => void
  onViewConsent?: (bundle: ConsentBundleSummary) => void
}) {
  const isDark = false
  const bundleMap = consentBundleByUserId ?? EMPTY_CONSENT_BUNDLE_BY_USER_ID
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
            const consentBundle = invite.usedByUserId ? bundleMap.get(invite.usedByUserId) : undefined
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
                      {`${STATUS_CHIP_LABEL[invite.status]} · created ${new Date(invite.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      isExpired
                        ? isDark
                          ? 'bg-gray-800 text-gray-400'
                          : 'bg-gray-100 text-gray-600'
                        : isDark
                          ? 'bg-red-500/15 text-red-300'
                          : 'bg-red-50 text-red-700',
                    )}
                  >
                    {STATUS_CHIP_LABEL[invite.status]}
                  </span>
                </div>

                {(files.length > 0 || consentBundle) && (
                  <div
                    className={cn(
                      'rounded-md border px-2 py-2 text-[11px]',
                      isDark ? 'border-gray-700/70 bg-gray-900/40' : 'border-gray-200 bg-gray-50 dark:border-gray-700/70 dark:bg-gray-900/20',
                    )}
                  >
                    <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-wide', isDark ? 'text-gray-500' : 'text-gray-500')}>
                      Files preserved
                    </p>
                    {consentBundle && consentBundle.status === 'complete' && onViewConsent ? (
                      <button
                        type="button"
                        onClick={() => onViewConsent(consentBundle)}
                        className={cn(
                          'mb-0.5 inline-flex w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-left transition-colors',
                          isDark ? 'bg-teal-950/40 text-teal-200 hover:bg-teal-950/60' : 'bg-teal-50 text-teal-900 hover:bg-teal-100',
                        )}
                      >
                        <FileCheck className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                        Signed consent package · View
                      </button>
                    ) : consentBundle ? (
                      <div
                        className={cn(
                          'mb-0.5 inline-flex w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]',
                          isDark ? 'bg-teal-950/40 text-teal-200' : 'bg-teal-50 text-teal-900',
                        )}
                      >
                        <FileCheck className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                        Signed consent package · {consentBundle.status === 'complete' ? 'Complete' : 'Pending'}
                      </div>
                    ) : null}
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

const SCREENING_BLOCK_IDS = new Set(['driver-mvr', 'driver-psp'])

/**
 * Two-section modal:
 *   Top    — edit mutable fields on the existing invite (name, email, job, message)
 *   Bottom — send another block OR place a direct MVR/PSP order when consent is complete
 */
function EditInviteModal({
  invite,
  jobs,
  blocksByCategory,
  sessionUserId,
  companyId,
  companyWalletAddress,
  consentBundle,
  theme,
  onSave,
  onAddBlock,
  onOrderPlaced,
  onClose,
}: {
  invite: Invite
  jobs: Job[]
  blocksByCategory: { category: { id: string; label: string }; blocks: typeof BLOCK_DEFINITIONS }[]
  sessionUserId: string
  companyId?: string | null
  companyWalletAddress?: string | null
  consentBundle?: ConsentBundleSummary | null
  theme: string
  onSave: (
    id: string,
    patch: {
      candidateName?: string
      candidateEmail?: string
      candidatePhone?: string
      jobPostingId?: string
      welcomeMessage?: string
    },
  ) => Promise<void>
  onAddBlock: (newInvite: Invite) => void
  onOrderPlaced?: () => void
  onClose: () => void
}) {
  const isDark = false

  const inputCls = cn(
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-teal-500/40',
    isDark
      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400',
  )

  const [name, setName] = useState(invite.candidateName ?? '')
  const [email, setEmail] = useState(invite.candidateEmail ?? '')
  const [phone, setPhone] = useState(invite.candidatePhone ?? '')
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Multi-select: Set of block IDs the employer has checked
  const [selectedBlockTypes, setSelectedBlockTypes] = useState<Set<string>>(new Set())
  const [addingBlock, setAddingBlock] = useState(false)
  const [addBlockError, setAddBlockError] = useState<string | null>(null)

  // Direct order state (for consent-backed MVR/PSP)
  const [orderingType, setOrderingType] = useState<'mvr' | 'psp' | null>(null)
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [ordersPlaced, setOrdersPlaced] = useState<Set<'mvr' | 'psp'>>(new Set())

  const alreadyHasBlockType = invite.targetBlockType
  const consentComplete = consentBundle?.status === 'complete'
  const candidateUserId = invite.usedByUserId

  // Split selected blocks into: screening (direct order when consent complete) vs invite
  const selectedScreening = [...selectedBlockTypes].filter((b) => SCREENING_BLOCK_IDS.has(b))
  const selectedInvite = [...selectedBlockTypes].filter((b) => !SCREENING_BLOCK_IDS.has(b))

  // Can we run direct orders? Need: consent complete + candidate has a userId + company block + not already placed
  const canDirectOrder = consentComplete && Boolean(candidateUserId) && Boolean(companyId)

  const toggleBlock = (blockId: string) => {
    setSelectedBlockTypes((prev) => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const patch: Parameters<typeof onSave>[1] = {}
      if (name !== (invite.candidateName ?? '')) patch.candidateName = name
      if (email !== (invite.candidateEmail ?? '')) patch.candidateEmail = email
      if (phone !== (invite.candidatePhone ?? '')) patch.candidatePhone = phone
      if (jobId) patch.jobPostingId = jobId
      if (message) patch.welcomeMessage = message
      // Nothing changed — skip the network round-trip
      if (Object.keys(patch).length === 0) { setSaving(false); return }
      await onSave(invite.id, patch)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Create invite links for non-screening blocks (unchanged behavior)
  const handleAddInviteBlocks = async () => {
    if (selectedInvite.length === 0) return
    setAddingBlock(true)
    setAddBlockError(null)
    try {
      for (const blockType of selectedInvite) {
        const res = await fetch('/api/employer/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
            targetBlockType: blockType,
            candidateName: invite.candidateName || undefined,
            candidateEmail: invite.candidateEmail || undefined,
            candidatePhone: invite.candidatePhone || undefined,
            candidateUserId: invite.usedByUserId || undefined,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error((d as { error?: string }).error ?? 'Failed to create invite')
        }
        const { invite: created } = await res.json()
        onAddBlock({
          ...created,
          emailSentAt: created.emailSentAt ?? null,
          smsSentAt: created.smsSentAt ?? null,
          candidatePhone: created.candidatePhone ?? null,
        })
      }
    } catch (e: unknown) {
      setAddBlockError(e instanceof Error ? e.message : 'Failed to create invite')
    } finally {
      setAddingBlock(false)
    }
  }

  // Direct order — no Alchemy SDK involved; the API creates a waived payment
  // record internally when paymentTxHash is omitted. When USDC billing is ready,
  // swap this for the full payment button flow.
  const handlePlaceOrder = async (type: 'mvr' | 'psp') => {
    if (!candidateUserId || !consentBundle || !companyId) return
    setOrderingType(type)
    setOrderLoading(true)
    setOrderError(null)
    try {
      const res = await fetch('/api/employer/screenings/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          candidateUserId,
          type,
          consentBundleId: consentBundle.id,
          force: true,
          // Hub ownership follows invite email, not candidate_name / stale used_by.
          orderEmail: invite.candidateEmail || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? `Failed to place ${type.toUpperCase()} order`)
      }
      setOrdersPlaced((prev) => new Set([...prev, type]))
      setSelectedBlockTypes((prev) => {
        const next = new Set(prev)
        next.delete(type === 'mvr' ? 'driver-mvr' : 'driver-psp')
        return next
      })
    } catch (e: unknown) {
      setOrderError(e instanceof Error ? e.message : `Failed to place ${type.toUpperCase()} order`)
    } finally {
      setOrderLoading(false)
      setOrderingType(null)
    }
  }

  // If any orders were placed, call onOrderPlaced on modal close so parent refreshes
  const handleClose = () => {
    if (ordersPlaced.size > 0) onOrderPlaced?.()
    onClose()
  }

  const sectionHead = cn(
    'mb-3 text-[10px] font-semibold uppercase tracking-wide',
    isDark ? 'text-gray-500' : 'text-gray-500',
  )

  return (
    <Modal onClose={handleClose} maxWidth="max-w-lg" zIndex={1200}>
      <ModalHeader
        title={`Edit: ${invite.candidateName || invite.candidateEmail || 'Anonymous invite'}`}
        subtitle="Update invite details or run screenings for this candidate"
        onClose={handleClose}
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
            <div className="sm:col-span-2">
              <label className={cn('mb-1 block text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Candidate phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
                placeholder="Optional — for Text invites"
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
            <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>

        {/* ── Section 2: block picker (multi-select) ───────────────────────── */}
        {blocksByCategory.length > 0 && (
          <div
            className={cn(
              'rounded-xl border p-4',
              isDark ? 'border-teal-700/40 bg-teal-900/15' : 'border-teal-200 bg-teal-50',
            )}
          >
            <p className={cn(sectionHead, isDark ? 'text-teal-600' : 'text-teal-600')}>
              Add blocks for this candidate
            </p>
            <p className={cn('mb-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
              {consentComplete
                ? 'Consent is on file — MVR and PSP can be ordered directly (no invite needed). Select one or more blocks.'
                : 'Select one or more blocks to send as invite links.'}
            </p>

            {/* Consent badge */}
            {consentBundle && (
              <div
                className={cn(
                  'mb-3 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                  consentComplete
                    ? isDark ? 'border-emerald-600/30 bg-emerald-900/20 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : isDark ? 'border-amber-600/30 bg-amber-900/20 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800',
                )}
              >
                <FileCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="font-medium">
                  Consent package: {consentComplete ? 'Complete — ready to order' : 'Pending candidate signature'}
                </span>
              </div>
            )}

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
                    const isAlreadyOrdered = (block.id === 'driver-mvr' && ordersPlaced.has('mvr')) ||
                      (block.id === 'driver-psp' && ordersPlaced.has('psp'))
                    const isScreening = SCREENING_BLOCK_IDS.has(block.id)
                    const isSelected = selectedBlockTypes.has(block.id)
                    const isDisabled = isCurrentBlock || isAlreadyOrdered

                    return (
                      <button
                        key={block.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => !isDisabled && toggleBlock(block.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b last:border-b-0',
                          isDisabled
                            ? 'opacity-40 cursor-not-allowed'
                            : isSelected
                              ? isDark
                                ? 'bg-teal-900/40'
                                : 'bg-teal-50'
                              : isDark
                                ? 'hover:bg-gray-700/50 border-gray-700/50'
                                : 'hover:bg-gray-50 border-gray-100',
                        )}
                      >
                        {/* Checkbox indicator */}
                        <div
                          className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                            isSelected && !isDisabled
                              ? 'border-teal-500 bg-teal-500'
                              : isDark ? 'border-gray-500 bg-transparent' : 'border-gray-300 bg-white',
                          )}
                        >
                          {isSelected && !isDisabled && (
                            <Check className="h-2.5 w-2.5 text-white" />
                          )}
                        </div>
                        <div
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                            isSelected && !isDisabled
                              ? isDark ? 'bg-teal-800/60' : 'bg-teal-100'
                              : isDark ? 'bg-gray-700' : 'bg-gray-100',
                          )}
                        >
                          <Package className={cn('w-3.5 h-3.5', isSelected ? 'text-teal-500' : isDark ? 'text-gray-400' : 'text-gray-500')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              {block.label}
                            </p>
                            {isAlreadyOrdered && (
                              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700')}>
                                ordered ✓
                              </span>
                            )}
                            {isCurrentBlock && !isAlreadyOrdered && (
                              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')}>
                                already invited
                              </span>
                            )}
                            {isScreening && consentComplete && !isDisabled && (
                              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700')}>
                                direct order
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
            {orderError && <p className="mt-2 text-xs text-red-400">{orderError}</p>}

            {selectedBlockTypes.size > 0 && (
              <div className="mt-4 space-y-3">
                {/* Direct-order section: screening blocks with consent complete */}
                {canDirectOrder && selectedScreening.length > 0 && (
                  <div
                    className={cn(
                      'rounded-lg border p-3',
                      isDark ? 'border-emerald-600/30 bg-emerald-950/20' : 'border-emerald-200 bg-emerald-50',
                    )}
                  >
                    <p className={cn('mb-2 text-[11px] font-semibold uppercase tracking-wide', isDark ? 'text-emerald-300' : 'text-emerald-700')}>
                      Place orders directly (consent on file)
                    </p>
                    <p className={cn('mb-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Consent is signed and on file. Click to run each screening — results appear in the Files section when ready.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedScreening.includes('driver-mvr') && (
                        ordersPlaced.has('mvr') ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" /> MVR ordered
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={orderLoading}
                            isLoading={orderLoading && orderingType === 'mvr'}
                            onClick={() => handlePlaceOrder('mvr')}
                          >
                            Run MVR
                          </Button>
                        )
                      )}
                      {selectedScreening.includes('driver-psp') && (
                        ordersPlaced.has('psp') ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" /> PSP ordered
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={orderLoading}
                            isLoading={orderLoading && orderingType === 'psp'}
                            onClick={() => handlePlaceOrder('psp')}
                          >
                            Run PSP
                          </Button>
                        )
                      )}
                    </div>
                    {orderLoading && (
                      <p className={cn('mt-2 flex items-center gap-1.5 text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Placing {orderingType?.toUpperCase()} order…
                      </p>
                    )}
                  </div>
                )}

                {/* No consent warning for screening blocks */}
                {!canDirectOrder && selectedScreening.length > 0 && (
                  <div className={cn('rounded-lg border p-3 text-xs', isDark ? 'border-amber-600/30 bg-amber-950/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800')}>
                    <span className="font-semibold">Consent required to order MVR/PSP directly.</span>{' '}
                    {!consentBundle
                      ? 'Send a Screening consent invite first so the candidate can sign.'
                      : 'Waiting for the candidate to complete the consent package.'}
                  </div>
                )}

                {/* Invite-link section: non-screening blocks */}
                {selectedInvite.length > 0 && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleAddInviteBlocks}
                    disabled={addingBlock}
                  >
                    {addingBlock ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    {addingBlock
                      ? 'Creating…'
                      : selectedInvite.length === 1
                        ? 'Create & copy link'
                        : `Create ${selectedInvite.length} invite links`}
                  </Button>
                )}
              </div>
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
  consentBundle,
  employerContext,
  sessionUserId,
  theme,
  onClose,
}: {
  invite: Invite
  files: ScreeningRow[]
  consentBundle: ConsentBundleSummary | null
  employerContext: EmployerHubContext
  sessionUserId: string
  theme: string
  onClose: () => void
}) {
  const isDark = false

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

    const consentSummary = consentBundle
      ? `Signed consent package — status: ${consentBundle.status}${consentBundle.completedAt ? `, completed ${new Date(consentBundle.completedAt).toLocaleDateString()}` : ''}.`
      : 'No signed consent package on file yet.'

    const filesSummary =
      files.length === 0
        ? 'No MVR or PSP orders placed yet.'
        : files
            .map((f) => `${f.kind.toUpperCase()} — status: ${f.status}${f.resultOutcome ? `, outcome: ${f.resultOutcome}` : ''}`)
            .join('; ')

    return [
      `I need guidance on a specific candidate in my outreach pipeline.`,
      `Candidate: ${invite.candidateName || invite.candidateEmail || 'Anonymous'}.`,
      `Invite type: ${blockLabel}.`,
      `Current status: ${invite.status}.`,
      `Views: ${invite.viewCount}.`,
      `Consent: ${consentSummary}`,
      `Screenings: ${filesSummary}`,
      invite.jobTitle ? `Linked job: ${invite.jobTitle}.` : null,
      invite.emailSentAt ? `Email was sent.` : `Email has not been sent yet.`,
      `What should I do next with this candidate? Give me specific, actionable advice.`,
    ]
      .filter(Boolean)
      .join(' ')
  }, [invite, files, consentBundle])

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
          sessionUserId,
          conversationHistory,
        })
        setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }])
        scrollToBottom()
      } catch (e) {
        if (e instanceof OutOfCreditsError) {
          setError('Out of AI credits for today. Try again tomorrow or purchase more.')
        } else {
          setError(e instanceof Error ? e.message : 'Failed to get a response')
        }
      } finally {
        setLoading(false)
      }
    },
    [loading, employerContext, sessionUserId, scrollToBottom],
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
        title={`Assistant — ${candidateLabel}`}
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
              Context shared with the assistant
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
              {consentBundle
                ? ` · Consent: ${consentBundle.status === 'complete' ? 'signed' : consentBundle.status}`
                : ''}
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
                      Assistant
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
                <span className="text-xs">Assistant is thinking…</span>
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

// ─── (legacy InviteRow removed — replaced by OutreachCandidateCard) ──────────
