'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search, UserCheck, X } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import SendBlocksPanel, { type SendSelection } from '@/components/employer/outreach/SendBlocksPanel'
import { getSendableOutreachBlocks } from '@/lib/outreach-sendable-blocks'
import { createAndDeliverInvites } from '@/lib/outreach-send-client'
import { useEmployerBlocksStore } from '@/stores/employer-blocks-store'

interface ProfileResult {
  user_id: string
  full_name: string | null
  email: string | null
  city: string | null
  state: string | null
  cdl_class: string | null
}

interface Job {
  id: string
  title: string
}

interface TalentHit {
  userId?: string
  user_id?: string
  name?: string
  full_name?: string | null
  email?: string | null
  city?: string | null
  state?: string | null
  location?: string | null
  cdlClass?: string | null
  cdl_class?: string | null
}

const EMPTY_FORM = {
  candidateEmail: '',
  candidatePhone: '',
  candidateName: '',
  candidateUserId: '',
  jobPostingId: '',
  welcomeMessage: '',
}

const inputBase =
  'w-full px-3 py-2 rounded-lg text-sm border border-stone-200 bg-white text-[#173150] placeholder-ironside outline-none transition-colors focus:ring-2 focus:ring-teal-500/40'
const label = 'block text-xs font-medium mb-1 text-ironside'

/**
 * Invite someone who is not already a row on the status board. Search finds a
 * person already on Provven; otherwise the recruiter types name, email, and
 * phone. Send uses the same invite API as the driver file.
 */
export default function NewOutreachModal({
  onClose,
  onSent,
}: {
  onClose: () => void
  onSent: () => void
}) {
  const installed = useEmployerBlocksStore((s) => s.installedBlocks)
  const sendableBlocks = useMemo(
    () => getSendableOutreachBlocks(installed.map((b) => b.blockType)),
    [installed],
  )

  const [form, setForm] = useState(EMPTY_FORM)
  const [jobs, setJobs] = useState<Job[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const [profileQuery, setProfileQuery] = useState('')
  const [profileResults, setProfileResults] = useState<ProfileResult[]>([])
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<ProfileResult | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileSearchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/employer/jobs')
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as { jobs?: Job[] }
        if (!cancelled) setJobs(data.jobs ?? [])
      })
      .catch(() => {
        /* A missing job list only hides the optional picker. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    const q = profileQuery.trim()
    if (q.length < 2) {
      setProfileResults([])
      setShowProfileDropdown(false)
      return
    }

    searchTimeout.current = setTimeout(() => {
      setIsSearchingProfiles(true)
      void fetch(`/api/employer/talent/search?search=${encodeURIComponent(q)}&limit=6`)
        .then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as { candidates?: TalentHit[] }
          const normalized = (data.candidates ?? []).map((c) => ({
            user_id: c.userId ?? c.user_id ?? '',
            full_name: c.name ?? c.full_name ?? null,
            email: c.email ?? null,
            city: c.city ?? (typeof c.location === 'string' ? c.location.split(',')[0]?.trim() ?? null : null),
            state: c.state ?? null,
            cdl_class: c.cdl_class ?? c.cdlClass ?? null,
          }))
          setProfileResults(normalized.filter((p) => p.user_id))
          setShowProfileDropdown(true)
        })
        .catch(() => {
          /* Search is a convenience. Typing the email still works. */
        })
        .finally(() => setIsSearchingProfiles(false))
    }, 300)

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [profileQuery])

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
    setCopiedLink(null)
    setForm((f) => ({
      ...f,
      candidateName: profile.full_name || '',
      candidateEmail: profile.email || '',
      candidateUserId: profile.user_id,
    }))
  }

  const handleClearProfile = () => {
    setSelectedProfile(null)
    setProfileQuery('')
    setForm((f) => ({
      ...f,
      candidateName: '',
      candidateEmail: '',
      candidateUserId: '',
    }))
  }

  const handleCreate = async (selection: SendSelection) => {
    setCreating(true)
    setError(null)
    try {
      const created = await createAndDeliverInvites(
        {
          candidateName: form.candidateName,
          candidateEmail: form.candidateEmail,
          candidatePhone: form.candidatePhone,
          candidateUserId: form.candidateUserId || null,
          jobPostingId: form.jobPostingId || null,
          welcomeMessage: form.welcomeMessage,
        },
        selection,
      )
      onSent()
      const first = created[0]
      if (!selection.viaEmail && !selection.viaSms && first) {
        const url = first.url
        try {
          await navigator.clipboard.writeText(url)
        } catch {
          /* The link stays on screen so they can copy it by hand. */
        }
        setCopiedLink(url)
        return
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      maxWidth="max-w-xl"
      panelShape="block"
      panelClassName="!border-stone-200 !bg-white !ring-[#173150]/10"
    >
      <ModalHeader
        title="New outreach"
        subtitle="Find or enter a candidate, then choose what to send."
        onClose={onClose}
        variant="block"
        paper
      />
      <div className="space-y-5 p-4 sm:p-5">
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
                  {profileResults.map((profile) => (
                    <button
                      key={profile.user_id}
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

        {copiedLink && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-xs font-medium text-[#173150]">Link copied</p>
            <p className="mt-1 break-all text-xs text-ironside">{copiedLink}</p>
          </div>
        )}

        <SendBlocksPanel
          blocks={sendableBlocks}
          email={form.candidateEmail.trim() || null}
          phone={form.candidatePhone.trim() || null}
          sending={creating}
          recipientFirstName={form.candidateName.trim().split(/\s+/)[0] || null}
          onSend={handleCreate}
        />
      </div>
    </Modal>
  )
}
