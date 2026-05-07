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
import { useEmployerBlocksStore } from '@/stores/employer-blocks-store'
import { getEmployerBlockDefinition } from '@/lib/employer-block-registry'
import { buildCandidateInviteSmsBody } from '@/lib/invite-sms-body'
import QRCode from 'qrcode'
import {
  Link2,
  Plus,
  Copy,
  Check,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
  Mail,
  Send,
  Users,
  QrCode,
  X,
  RefreshCw,
  ChevronDown,
  Search,
  UserCheck,
  MapPin,
  Package,
  ArrowLeft,
  MessageSquare,
  Download,
  Share2,
  Trash2,
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

type InviteStatus = 'pending' | 'viewed' | 'in_progress' | 'completed' | 'expired' | 'cancelled'

interface Invite {
  id: string
  token: string
  url: string
  type: string
  targetBlockType: string | null
  candidateEmail: string | null
  candidateName: string | null
  status: InviteStatus
  jobTitle: string | null
  jobPostingId: string | null
  viewCount: number
  expiresAt: string | null
  createdAt: string
  usedAt: string | null
  usedByName: string | null
  driverApplicationId: string | null
  emailSentAt: string | null
}

interface Job {
  id: string
  title: string
}

interface CandidateOutreachProps {
  walletAddress: string
  isCollapsed?: boolean
  onToggle?: () => void
  /** When true, skips the outer HubSectionPanel/BlockCard wrapper (parent provides the chrome) */
  embedded?: boolean
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InviteStatus, { label: string; icon: React.ReactNode; classes: string }> = {
  pending: { label: 'Pending', icon: <Clock className="w-3 h-3" />, classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  viewed: { label: 'Viewed', icon: <Eye className="w-3 h-3" />, classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  in_progress: { label: 'In Progress', icon: <Loader2 className="w-3 h-3" />, classes: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  completed: { label: 'Completed', icon: <CheckCircle className="w-3 h-3" />, classes: 'bg-green-500/15 text-green-400 border-green-500/30' },
  expired: { label: 'Expired', icon: <Clock className="w-3 h-3" />, classes: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  cancelled: { label: 'Cancelled', icon: <XCircle className="w-3 h-3" />, classes: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ targetBlockType }: { targetBlockType: string | null }) {
  if (!targetBlockType) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-500/20 text-slate-300 border-slate-500/30">
        <Users className="w-3 h-3" />
        General
      </span>
    )
  }
  const block = getBlockDefinition(targetBlockType)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-teal-500/20 text-teal-300 border-teal-500/30">
      <Package className="w-3 h-3" />
      {block?.label ?? targetBlockType}
    </span>
  )
}

function StatusBadge({ status }: { status: InviteStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.classes}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

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

export default function CandidateOutreach({ walletAddress, isCollapsed = false, onToggle, embedded = false }: CandidateOutreachProps) {
  const { theme } = useTheme()

  const [invites, setInvites] = useState<Invite[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)
  const [emailSentId, setEmailSentId] = useState<string | null>(null)
  const [qrInvite, setQrInvite] = useState<Invite | null>(null)
  const [showEmailInput, setShowEmailInput] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const [selectedBlockType, setSelectedBlockType] = useState<string | null>(null)

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
  }, [walletAddress, fetchInvites, fetchJobs])

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
        setInvites(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'cancelled' } : inv))
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
    setShowEmailInput(null)
    setEmailInput('')

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
    setCopiedMessageId(null)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  /** Full message + link — paste into Messages, WhatsApp, etc. No Twilio / no cost. */
  const copyInviteTextForSms = useCallback(
    (invite: Invite) => {
      const text = buildCandidateInviteSmsBody({
        companyName: companyName.trim() || 'Your company',
        inviteUrl: invite.url,
        targetBlockType: invite.targetBlockType,
        candidateName: invite.candidateName,
        jobTitle: invite.jobTitle,
      })
      navigator.clipboard.writeText(text).catch(() => {})
      setCopiedMessageId(invite.id)
      setCopiedId(null)
      setTimeout(() => setCopiedMessageId(null), 2000)
    },
    [companyName]
  )

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeInvites = invites.filter(i => !['cancelled', 'completed'].includes(i.status))
  const displayed = showAll ? invites : invites.slice(0, 6)
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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Link2 className={cn('h-4 w-4', isDarkTheme(theme) ? 'text-amber-400' : 'text-amber-600')} />
        <h4 className={cn('text-sm font-semibold', isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800')}>
          Candidate outreach
        </h4>
        {activeInvites.length > 0 && (
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', isDarkTheme(theme) ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')}>
            {activeInvites.length} active
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isCollapsed && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setShowForm(true)
              setError(null)
              resetForm()
            }}
          >
            <Plus className="h-4 w-4" />
            New outreach
          </Button>
        )}
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
          <div className={`px-6 py-5 border-b ${isDarkTheme(theme) ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50/80'}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`font-semibold text-sm ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                Create Outreach Link
              </h4>
              <button
                onClick={() => { setShowForm(false); setError(null); resetForm() }}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Block picker — employer outreach is always block-specific */}
            <div className="mb-4">
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

            {/* Profile search */}
            <div className="mb-3" ref={profileSearchRef}>
              <label className={label}>
                Search existing Storm profiles
                <span className={`ml-1 font-normal ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`}>
                  — connects invite for in-app notifications
                </span>
              </label>

              {selectedProfile ? (
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  isDarkTheme(theme)
                    ? 'bg-teal-900/30 border-teal-700/50'
                    : 'bg-teal-50 border-teal-200'
                }`}>
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
                  <button
                    onClick={handleClearProfile}
                    className={`text-xs font-medium flex items-center gap-1 cursor-pointer ${
                      isDarkTheme(theme) ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                </div>
              ) : (
                <div className="relative">
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
                        Or fill in name and email below for someone not on Storm
                      </div>
                    </div>
                  )}

                  {showProfileDropdown && profileQuery.trim().length >= 2 && !isSearchingProfiles && profileResults.length === 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 px-3 py-3 text-xs ${
                      isDarkTheme(theme) ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-white border-gray-200 text-gray-400'
                    }`}>
                      No Storm profiles found — fill in name and email below for an email-only invite
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual name/email */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={label}>
                  Candidate name
                  {selectedProfile && <span className="ml-1 text-teal-500">· from profile</span>}
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={form.candidateName}
                  onChange={e => setForm(f => ({ ...f, candidateName: e.target.value }))}
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
                  placeholder="Optional — to send email"
                  value={form.candidateEmail}
                  onChange={e => setForm(f => ({ ...f, candidateEmail: e.target.value }))}
                  className={inputBase}
                />
              </div>
            </div>

            {/* Job picker — always available */}
            {jobs.length > 0 && (
              <div className="mb-3">
                <label className={label}>Link to job posting (optional)</label>
                <select
                  value={form.jobPostingId}
                  onChange={e => setForm(f => ({ ...f, jobPostingId: e.target.value }))}
                  className={inputBase}
                >
                  <option value="">No specific job</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className={label}>Custom welcome message (optional)</label>
              <textarea
                placeholder="Add a personal note to the candidate…"
                value={form.welcomeMessage}
                onChange={e => setForm(f => ({ ...f, welcomeMessage: e.target.value }))}
                rows={2}
                className={`${inputBase} resize-none`}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !canSubmit}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {creating ? 'Creating…' : 'Create & Copy Link'}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null); resetForm() }}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isDarkTheme(theme) ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Invite list */}
        {!isCollapsed && <div className="divide-y divide-gray-700/50">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
              <span className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>Loading outreach…</span>
            </div>
          ) : invites.length === 0 ? (
            <div className="py-10 text-center">
              <Link2 className={`w-10 h-10 mx-auto mb-3 ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={`font-medium text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                No outreach yet
              </p>
              <p className={`text-xs mt-1 ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`}>
                Create your first invite link to bring candidates into your pipeline
              </p>
            </div>
          ) : (
            displayed.map(invite => (
              <InviteRow
                key={invite.id}
                invite={invite}
                theme={theme}
                copiedId={copiedId}
                copiedMessageId={copiedMessageId}
                sendingEmailId={sendingEmailId}
                emailSentId={emailSentId}
                showEmailInput={showEmailInput}
                emailInput={emailInput}
                onCopy={copyToClipboard}
                onCopyMessage={() => copyInviteTextForSms(invite)}
                onShowQr={() => setQrInvite(invite)}
                onCancel={handleCancel}
                onSendEmail={handleSendEmail}
                onShowEmailInput={() => {
                  setShowEmailInput(invite.id)
                  setEmailInput('')
                }}
                onEmailInputChange={setEmailInput}
                onEmailInputSubmit={() => handleSendEmail(invite, emailInput)}
                onEmailInputCancel={() => { setShowEmailInput(null); setEmailInput('') }}
                removingId={removingId}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>}

        {/* Show more */}
        {!isCollapsed && !loading && invites.length > 6 && (
          <div className={`px-6 py-3 border-t ${isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={() => setShowAll(v => !v)}
              className={`flex items-center gap-1 text-xs font-medium ${isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'}`}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
              {showAll ? 'Show less' : `Show ${invites.length - 6} more`}
            </button>
          </div>
        )}
    </>
  )

  return (
    <>
      {embedded ? (
        // When embedded inside the parent Blocks & Outreach section,
        // render just header + body — the parent provides the panel chrome.
        <div>
          {outreachHeader}
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
                ? `${activeInvites.length > 0 ? `${activeInvites.length} active` : 'No active invites'} · Send invite links to candidates`
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
    </>
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

// ─── Invite row ───────────────────────────────────────────────────────────────

interface InviteRowProps {
  invite: Invite
  theme: string
  copiedId: string | null
  copiedMessageId: string | null
  sendingEmailId: string | null
  emailSentId: string | null
  showEmailInput: string | null
  emailInput: string
  onCopy: (url: string, id: string) => void
  onCopyMessage: () => void
  onShowQr: () => void
  onCancel: (id: string) => void
  onSendEmail: (invite: Invite, email?: string) => void
  onShowEmailInput: () => void
  onEmailInputChange: (v: string) => void
  onEmailInputSubmit: () => void
  onEmailInputCancel: () => void
  removingId: string | null
  onRemove: (id: string) => void
}

function InviteRow({
  invite,
  theme,
  copiedId,
  copiedMessageId,
  sendingEmailId,
  emailSentId,
  showEmailInput,
  emailInput,
  onCopy,
  onCopyMessage,
  onShowQr,
  onCancel,
  onSendEmail,
  onShowEmailInput,
  onEmailInputChange,
  onEmailInputSubmit,
  onEmailInputCancel,
  removingId,
  onRemove,
}: InviteRowProps) {
  const isSending = sendingEmailId === invite.id
  const isEmailSent = emailSentId === invite.id
  const isCopiedLink = copiedId === invite.id
  const isCopiedMessage = copiedMessageId === invite.id
  const showingEmailInput = showEmailInput === invite.id
  const isRemoving = removingId === invite.id
  const canAct = !['cancelled', 'completed', 'expired'].includes(invite.status)

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  return (
    <div className={`px-6 py-4 ${isDarkTheme(theme) ? 'hover:bg-gray-700/20' : 'hover:bg-gray-50/60'} transition-colors`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
            <TypeBadge targetBlockType={invite.targetBlockType} />
            <StatusBadge status={invite.status} />
            {invite.jobTitle && (
              <span className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                · {invite.jobTitle}
              </span>
            )}
          </div>

          {/* Candidate info */}
          <p className={`font-medium text-sm ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            {invite.candidateName || invite.candidateEmail || (
              <span className={isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}>Anonymous invite</span>
            )}
          </p>
          {invite.candidateName && invite.candidateEmail && (
            <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
              {invite.candidateEmail}
            </p>
          )}

          {/* Meta */}
          <div className={`flex items-center gap-3 mt-1.5 text-xs ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`}>
            <span>{timeAgo(invite.createdAt)}</span>
            {invite.viewCount > 0 && <span>{invite.viewCount} view{invite.viewCount !== 1 ? 's' : ''}</span>}
            {invite.emailSentAt && (
              <span className="flex items-center gap-1 text-teal-500">
                <Mail className="w-2.5 h-2.5" />
                Emailed
              </span>
            )}
            {invite.usedByName && (
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle className="w-2.5 h-2.5" />
                {invite.usedByName}
              </span>
            )}
          </div>

          {/* Inline email input */}
          {showingEmailInput && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="email"
                autoFocus
                placeholder="Enter email address"
                value={emailInput}
                onChange={e => onEmailInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onEmailInputSubmit(); if (e.key === 'Escape') onEmailInputCancel() }}
                className={`flex-1 px-2.5 py-1.5 text-xs rounded-lg border ${
                  isDarkTheme(theme)
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <button
                onClick={onEmailInputSubmit}
                disabled={!emailInput}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                Send
              </button>
              <button onClick={onEmailInputCancel} className="text-gray-500 hover:text-gray-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onCopy(invite.url, invite.id)}
            title="Copy invite link only"
            className={`p-1.5 rounded-lg transition-colors ${
              isCopiedLink
                ? 'text-green-400'
                : isDarkTheme(theme) ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            {isCopiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onCopyMessage}
            title="Copy message + link — paste into your texting app (no extra service)"
            className={`p-1.5 rounded-lg transition-colors ${
              isCopiedMessage
                ? 'text-green-400'
                : isDarkTheme(theme) ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            {isCopiedMessage ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onShowQr}
            title="Show QR code"
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkTheme(theme) ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <QrCode className="w-4 h-4" />
          </button>

          {canAct && (
            <button
              type="button"
              onClick={() => {
                if (invite.candidateEmail) {
                  onSendEmail(invite)
                } else {
                  onShowEmailInput()
                }
              }}
              disabled={isSending}
              title={invite.emailSentAt ? 'Re-send email' : 'Send invite email'}
              className={`p-1.5 rounded-lg transition-colors ${
                isEmailSent
                  ? 'text-green-400'
                  : isSending
                    ? 'opacity-50 cursor-wait'
                    : invite.emailSentAt
                      ? isDarkTheme(theme) ? 'text-teal-500 hover:text-teal-300 hover:bg-gray-700' : 'text-teal-500 hover:text-teal-600 hover:bg-gray-100'
                      : isDarkTheme(theme) ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEmailSent ? (
                <Check className="w-4 h-4" />
              ) : invite.emailSentAt ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
            </button>
          )}

          {canAct && (
            <button
              type="button"
              onClick={() => onCancel(invite.id)}
              title="Cancel invite (link stops working, row stays until removed)"
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkTheme(theme) ? 'text-gray-600 hover:text-red-400 hover:bg-gray-700' : 'text-gray-300 hover:text-red-500 hover:bg-gray-100'
              }`}
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemove(invite.id)}
            disabled={isRemoving}
            title="Remove from list"
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
              isDarkTheme(theme)
                ? 'text-gray-600 hover:text-orange-400 hover:bg-gray-700'
                : 'text-gray-400 hover:text-orange-600 hover:bg-gray-100'
            }`}
          >
            {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
