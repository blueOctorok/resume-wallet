'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
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
  Car,
  Code,
  Users,
  QrCode,
  X,
  RefreshCw,
  ChevronDown,
  Search,
  UserCheck,
  MapPin,
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

type InviteType = 'driver_dot' | 'developer_card' | 'general'
type InviteStatus = 'pending' | 'viewed' | 'in_progress' | 'completed' | 'expired' | 'cancelled'

interface Invite {
  id: string
  token: string
  url: string
  type: InviteType
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
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: InviteType; label: string; icon: React.ReactNode; description: string; color: string; badge: string }[] = [
  {
    value: 'driver_dot',
    label: 'Driver DOT App',
    icon: <Car className="w-4 h-4" />,
    description: 'Invite a driver to complete a DOT application',
    color: 'border-teal-500 bg-teal-500/10 text-teal-400',
    badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  },
  {
    value: 'developer_card',
    label: 'Developer Card',
    icon: <Code className="w-4 h-4" />,
    description: 'Invite a developer to set up their career card',
    color: 'border-indigo-500 bg-indigo-500/10 text-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  {
    value: 'general',
    label: 'General Onboarding',
    icon: <Users className="w-4 h-4" />,
    description: 'Invite anyone to join StormChain and pick their role',
    color: 'border-slate-500 bg-slate-500/10 text-slate-300',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  },
]

const STATUS_CONFIG: Record<InviteStatus, { label: string; icon: React.ReactNode; classes: string }> = {
  pending: { label: 'Pending', icon: <Clock className="w-3 h-3" />, classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  viewed: { label: 'Viewed', icon: <Eye className="w-3 h-3" />, classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  in_progress: { label: 'In Progress', icon: <Loader2 className="w-3 h-3" />, classes: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  completed: { label: 'Completed', icon: <CheckCircle className="w-3 h-3" />, classes: 'bg-green-500/15 text-green-400 border-green-500/30' },
  expired: { label: 'Expired', icon: <Clock className="w-3 h-3" />, classes: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  cancelled: { label: 'Cancelled', icon: <XCircle className="w-3 h-3" />, classes: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: InviteType }) {
  const cfg = TYPE_OPTIONS.find(o => o.value === type)!
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
      {cfg.icon}
      {cfg.label}
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

function QrModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 240,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
    }
  }, [url])

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl text-center max-w-xs w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white text-sm">Scan to Open Invite</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-white rounded-xl p-3 inline-block mb-3">
          <canvas ref={canvasRef} />
        </div>
        <p className="text-gray-500 text-xs truncate">{name || 'Invite Link'}</p>
        <p className="text-gray-600 text-xs mt-1">Share this QR or copy the link below</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CandidateOutreach({ walletAddress }: CandidateOutreachProps) {
  const { theme } = useTheme()

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
  const [showEmailInput, setShowEmailInput] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [showAll, setShowAll] = useState(false)

  const [form, setForm] = useState<{
    type: InviteType
    candidateEmail: string
    candidateName: string
    candidateUserId: string   // set when employer selects an existing profile
    jobPostingId: string
    welcomeMessage: string
  }>({
    type: 'driver_dot',
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

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/employer/invites', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (res.ok) {
        const data = await res.json()
        setInvites(data.invites || [])
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

  // Debounced search: fires 300 ms after the user stops typing
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
          // API returns camelCase; normalize to ProfileResult (snake_case) so keys and display work
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

  // Close dropdown when clicking outside
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
    setForm({ type: 'driver_dot', candidateEmail: '', candidateName: '', candidateUserId: '', jobPostingId: '', welcomeMessage: '' })
    setSelectedProfile(null)
    setProfileQuery('')
    setProfileResults([])
  }

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/employer/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({
          type: form.type,
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
      setInvites(prev => [{ ...invite, emailSentAt: null }, ...prev])
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
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeInvites = invites.filter(i => !['cancelled', 'completed'].includes(i.status))
  const displayed = showAll ? invites : invites.slice(0, 6)
  const isDriver = form.type === 'driver_dot'

  // ── Shared styling shortcuts ───────────────────────────────────────────────
  const card = theme === 'dark'
    ? 'bg-gray-800/50 border-gray-700'
    : 'bg-white/80 border-gray-200'

  const inputBase = `w-full px-3 py-2 rounded-lg text-sm border transition-colors outline-none focus:ring-2 focus:ring-teal-500/50 ${
    theme === 'dark'
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`

  const label = `block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`

  return (
    <>
      <div className={`rounded-2xl border shadow-lg ${card}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-teal-900/40' : 'bg-teal-100'}`}>
              <Link2 className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Candidate Outreach
              </h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {activeInvites.length > 0 ? `${activeInvites.length} active` : 'No active invites'}
                {' · '}Send invite links to drivers, developers, or anyone
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); setError(null); resetForm() }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Outreach
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className={`px-6 py-5 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50/80'}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Create Outreach Link
              </h4>
              <button
                onClick={() => { setShowForm(false); setError(null); resetForm() }}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type picker — always visible first */}
            <div className="mb-4">
              <p className={label}>Outreach type *</p>
              <div className="grid grid-cols-3 gap-2">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center text-xs font-medium transition-all ${
                      form.type === opt.value
                        ? opt.color
                        : theme === 'dark'
                          ? 'border-gray-600 text-gray-400 hover:border-gray-500'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className={`text-xs mt-1.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {TYPE_OPTIONS.find(o => o.value === form.type)?.description}
              </p>
            </div>

            {/* ── Profile search (links invite to an existing StormChain account) ── */}
            <div className="mb-3" ref={profileSearchRef}>
              <label className={label}>
                Search existing StormChain profiles
                <span className={`ml-1 font-normal ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
                  — connects invite for in-app notifications
                </span>
              </label>

              {selectedProfile ? (
                // Connected profile badge
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-teal-900/30 border-teal-700/50'
                    : 'bg-teal-50 border-teal-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <div>
                      <p className={`text-sm font-medium ${theme === 'dark' ? 'text-teal-300' : 'text-teal-700'}`}>
                        {selectedProfile.full_name || selectedProfile.email}
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-teal-500' : 'text-teal-500'}`}>
                        Connected to StormChain · In-app notification will fire when email is sent
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearProfile}
                    className={`text-xs font-medium flex items-center gap-1 cursor-pointer ${
                      theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                </div>
              ) : (
                // Search input
                <div className="relative">
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
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
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                      {profileResults.map((profile, index) => (
                        <button
                          key={profile.user_id || `profile-${index}`}
                          onClick={() => handleSelectProfile(profile)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b last:border-b-0 cursor-pointer ${
                            theme === 'dark'
                              ? 'hover:bg-gray-700 border-gray-700/60'
                              : 'hover:bg-gray-50 border-gray-100'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            theme === 'dark' ? 'bg-teal-900/50' : 'bg-teal-100'
                          }`}>
                            <UserCheck className="w-3.5 h-3.5 text-teal-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {profile.full_name || profile.email || 'Unknown'}
                            </p>
                            <div className={`flex items-center gap-2 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
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
                            theme === 'dark' ? 'bg-teal-900/50 text-teal-400' : 'bg-teal-100 text-teal-700'
                          }`}>
                            StormChain
                          </span>
                        </button>
                      ))}
                      <div className={`px-3 py-2 text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
                        Or fill in name and email below for someone not on StormChain
                      </div>
                    </div>
                  )}

                  {showProfileDropdown && profileQuery.trim().length >= 2 && !isSearchingProfiles && profileResults.length === 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 px-3 py-3 text-xs ${
                      theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-white border-gray-200 text-gray-400'
                    }`}>
                      No StormChain profiles found — fill in name and email below for an email-only invite
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Manual name/email (always visible; pre-filled when profile selected) ── */}
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

            {/* Only show job picker for driver_dot invites */}
            {isDriver && jobs.length > 0 && (
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
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {creating ? 'Creating…' : 'Create & Copy Link'}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null); resetForm() }}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Invite list */}
        <div className="divide-y divide-gray-700/50">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Loading outreach…</span>
            </div>
          ) : invites.length === 0 ? (
            <div className="py-10 text-center">
              <Link2 className={`w-10 h-10 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={`font-medium text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                No outreach yet
              </p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
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
                sendingEmailId={sendingEmailId}
                emailSentId={emailSentId}
                showEmailInput={showEmailInput}
                emailInput={emailInput}
                onCopy={copyToClipboard}
                onShowQr={() => setQrInvite(invite)}
                onCancel={handleCancel}
                onSendEmail={handleSendEmail}
                onShowEmailInput={(id) => { setShowEmailInput(id); setEmailInput('') }}
                onEmailInputChange={setEmailInput}
                onEmailInputSubmit={() => handleSendEmail(invite, emailInput)}
                onEmailInputCancel={() => { setShowEmailInput(null); setEmailInput('') }}
              />
            ))
          )}
        </div>

        {/* Show more */}
        {!loading && invites.length > 6 && (
          <div className={`px-6 py-3 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={() => setShowAll(v => !v)}
              className={`flex items-center gap-1 text-xs font-medium ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
              {showAll ? 'Show less' : `Show ${invites.length - 6} more`}
            </button>
          </div>
        )}
      </div>

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

// ─── Invite row ───────────────────────────────────────────────────────────────

interface InviteRowProps {
  invite: Invite
  theme: string
  copiedId: string | null
  sendingEmailId: string | null
  emailSentId: string | null
  showEmailInput: string | null
  emailInput: string
  onCopy: (url: string, id: string) => void
  onShowQr: () => void
  onCancel: (id: string) => void
  onSendEmail: (invite: Invite, email?: string) => void
  onShowEmailInput: (id: string) => void
  onEmailInputChange: (v: string) => void
  onEmailInputSubmit: () => void
  onEmailInputCancel: () => void
}

function InviteRow({
  invite,
  theme,
  copiedId,
  sendingEmailId,
  emailSentId,
  showEmailInput,
  emailInput,
  onCopy,
  onShowQr,
  onCancel,
  onSendEmail,
  onShowEmailInput,
  onEmailInputChange,
  onEmailInputSubmit,
  onEmailInputCancel,
}: InviteRowProps) {
  const isSending = sendingEmailId === invite.id
  const isEmailSent = emailSentId === invite.id
  const isCopied = copiedId === invite.id
  const showingEmailInput = showEmailInput === invite.id
  const canAct = !['cancelled', 'completed', 'expired'].includes(invite.status)

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  return (
    <div className={`px-6 py-4 ${theme === 'dark' ? 'hover:bg-gray-700/20' : 'hover:bg-gray-50/60'} transition-colors`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
            <TypeBadge type={invite.type} />
            <StatusBadge status={invite.status} />
            {invite.jobTitle && (
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                · {invite.jobTitle}
              </span>
            )}
          </div>

          {/* Candidate info */}
          <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {invite.candidateName || invite.candidateEmail || (
              <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>Anonymous invite</span>
            )}
          </p>
          {invite.candidateName && invite.candidateEmail && (
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              {invite.candidateEmail}
            </p>
          )}

          {/* Meta */}
          <div className={`flex items-center gap-3 mt-1.5 text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
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
                  theme === 'dark'
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
          {/* Copy link */}
          <button
            onClick={() => onCopy(invite.url, invite.id)}
            title="Copy invite link"
            className={`p-1.5 rounded-lg transition-colors ${
              isCopied
                ? 'text-green-400'
                : theme === 'dark' ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* QR code */}
          <button
            onClick={onShowQr}
            title="Show QR code"
            className={`p-1.5 rounded-lg transition-colors ${
              theme === 'dark' ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <QrCode className="w-4 h-4" />
          </button>

          {/* Send / re-send email */}
          {canAct && (
            <button
              onClick={() => {
                if (invite.candidateEmail) {
                  onSendEmail(invite)
                } else {
                  onShowEmailInput(invite.id)
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
                      ? theme === 'dark' ? 'text-teal-500 hover:text-teal-300 hover:bg-gray-700' : 'text-teal-500 hover:text-teal-600 hover:bg-gray-100'
                      : theme === 'dark' ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
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

          {/* Cancel */}
          {canAct && (
            <button
              onClick={() => onCancel(invite.id)}
              title="Cancel invite"
              className={`p-1.5 rounded-lg transition-colors ${
                theme === 'dark' ? 'text-gray-600 hover:text-red-400 hover:bg-gray-700' : 'text-gray-300 hover:text-red-500 hover:bg-gray-100'
              }`}
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
