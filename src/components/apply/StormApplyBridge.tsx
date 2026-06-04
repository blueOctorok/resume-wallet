'use client'

/**
 * StormApplyBridge — the preparation modal for external (Adzuna) job
 * applications. Instead of dumping the user on the employer site with nothing,
 * this modal assembles everything they need to apply in 30 seconds:
 *
 *   1. Career card share URL (copy to paste into "Portfolio" fields)
 *   2. Resume PDF (download link)
 *   3. AI cover letter (optional, same flow as StormChain modal)
 *   4. Pre-filled screener answers (copy-per-field)
 *   5. "Go apply" — opens employer site + records the application
 */

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import {
  ExternalLink,
  Copy,
  Check,
  Download,
  Sparkles,
  ChevronDown,
  Loader2,
  Briefcase,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { deriveScreenerAnswers, type ScreenerAnswer } from '@/lib/screener-answers'
import { useSimpleModeStore } from '@/stores/simple-mode-store'
import { useLenses } from '@/stores/career-card-lenses-store'
import type { ProjectedCareerCard } from '@/types/career-card'
import type { StormiUsageInfo } from '@/lib/ava-chat'

const StormiCreditModal = dynamic(() => import('@/components/StormiCreditModal'), { ssr: false })

export interface BridgeJob {
  id: string
  title: string
  company: string
  location: string
  salary?: string
  description?: string
  redirect_url?: string
  salary_min?: number
  salary_max?: number
}

interface StormApplyBridgeProps {
  isOpen: boolean
  onClose: () => void
  job: BridgeJob | null
  userAddress: string | null
  onApplicationRecorded?: () => void
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label ? `Copy ${label}` : 'Copy'}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer shrink-0',
        copied
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
          : isDark
            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function StormApplyBridge({
  isOpen,
  onClose,
  job,
  userAddress,
  onApplicationRecorded,
}: StormApplyBridgeProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const [card, setCard] = useState<ProjectedCareerCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [generatingLetter, setGeneratingLetter] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const [screenersOpen, setScreenersOpen] = useState(false)

  const activeLensId = useSimpleModeStore((s) => s.activeLensId)
  const lenses = useLenses()
  const activeLens = useMemo(() => {
    if (activeLensId) return lenses.find((l) => l.id === activeLensId) ?? null
    return lenses.find((l) => l.isDefault) ?? null
  }, [activeLensId, lenses])

  const resetState = useCallback(() => {
    setCard(null)
    setLoading(true)
    setError(null)
    setCoverLetter('')
    setGeneratingLetter(false)
    setShowCreditModal(false)
    setRecording(false)
    setRecorded(false)
    setScreenersOpen(false)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      resetState()
      return
    }
    if (!userAddress) {
      setLoading(false)
      setError('Connect your wallet to apply.')
      return
    }
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const qs = activeLensId ? `?lens=${encodeURIComponent(activeLensId)}` : ''
        const res = await fetch(`/api/career-card${qs}`)
        const data = await res.json()
        if (!res.ok || !data.card) {
          setError(data.error || 'Could not load your career card.')
          return
        }
        setCard(data.card as ProjectedCareerCard)
      } catch {
        setError('Failed to load your career card.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [isOpen, userAddress, resetState, activeLensId])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = card?.shareToken ? `${origin}/card/${card.shareToken}` : null

  const screenerAnswers = useMemo<ScreenerAnswer[]>(
    () => (card ? deriveScreenerAnswers(card, origin) : []),
    [card, origin],
  )

  const resumeSection = useMemo(() => {
    if (!card) return null
    const sec = card.sections.find((s) =>
      ['storm-resume', 'driver-resume', 'developer-resume', 'general-resume'].includes(s.blockType),
    )
    if (!sec) return null
    const d = sec.data as {
      ipfsHash?: string
      documentUrl?: string | null
      filename?: string
      title?: string
      id?: string
    }
    if (d.id === '__storm_resume_placeholder__' || !d.documentUrl) return null
    return {
      title: d.title || d.filename || 'Resume',
      url: d.documentUrl,
    }
  }, [card])

  const handleGenerateCoverLetter = async () => {
    if (!job || !userAddress) return
    setGeneratingLetter(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': userAddress },
        body: JSON.stringify({
          jobTitle: job.title,
          company: job.company,
          location: job.location,
          description: job.description ?? '',
        }),
      })
      const data = await res.json()
      if (res.status === 402) { setShowCreditModal(true); return }
      if (!res.ok) { setError(data.error || 'Could not generate cover letter'); return }
      setCoverLetter((typeof data.coverLetter === 'string' ? data.coverLetter : '').slice(0, 1000))
    } catch {
      setError('Failed to generate cover letter.')
    } finally {
      setGeneratingLetter(false)
    }
  }

  const handleGoApply = useCallback(async () => {
    if (!job || !userAddress) return

    // Open employer site immediately
    if (job.redirect_url) {
      window.open(job.redirect_url, '_blank', 'noopener,noreferrer')
    }

    // Record the application in the background
    setRecording(true)
    try {
      const lensPayload = activeLens && !activeLens.isDefault
        ? { lensId: activeLens.id, lensName: activeLens.name }
        : {}

      const res = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          jobId: job.id,
          jobTitle: job.title,
          employerName: job.company,
          jobLocation: job.location,
          jobUrl: job.redirect_url,
          jobSalaryMin: job.salary_min,
          jobSalaryMax: job.salary_max,
          coverLetter: coverLetter.trim() || undefined,
          jobSource: 'adzuna',
          ...lensPayload,
        }),
      })

      if (res.ok) {
        setRecorded(true)
        onApplicationRecorded?.()
      } else {
        const data = await res.json()
        // 409 = already applied — still a success from the user's perspective
        if (res.status === 409) {
          setRecorded(true)
        } else {
          setError(data.error || 'Could not record your application.')
        }
      }
    } catch {
      setError('Failed to record application.')
    } finally {
      setRecording(false)
    }
  }, [job, userAddress, activeLens, coverLetter, onApplicationRecorded])

  if (!isOpen || !job) return null

  const groupedAnswers = {
    identity: screenerAnswers.filter((a) => a.group === 'identity'),
    career: screenerAnswers.filter((a) => a.group === 'career'),
    credentials: screenerAnswers.filter((a) => a.group === 'credentials'),
  }
  const hasAnswers = screenerAnswers.length > 0

  return (
    <>
      <Modal onClose={onClose} maxWidth="max-w-2xl" panelShape="block">
        <ModalHeader
          title="Apply with Storm"
          subtitle={`${job.title} at ${job.company}`}
          onClose={onClose}
          variant="block"
        />

        {loading && (
          <div className="p-10 text-center">
            <Loader2 className={cn('w-6 h-6 animate-spin mx-auto mb-3', isDark ? 'text-gray-400' : 'text-slate-500')} />
            <p className={isDark ? 'text-gray-400 text-sm' : 'text-slate-600 text-sm'}>
              Preparing your application toolkit...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="p-5">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          </div>
        )}

        {!loading && card && (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-none">
            {/* Career card share URL — the moat */}
            {shareUrl && (
              <div
                className={cn(
                  'rounded-xl border p-4',
                  isDark ? 'border-teal-500/30 bg-teal-500/5' : 'border-teal-200 bg-teal-50/60',
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div>
                    <p className={cn('text-sm font-semibold', isDark ? 'text-teal-100' : 'text-teal-900')}>
                      Your verified career card
                    </p>
                    <p className={cn('text-xs', isDark ? 'text-teal-300/70' : 'text-teal-700/70')}>
                      Paste this into &ldquo;Portfolio URL&rdquo; or &ldquo;Personal Website&rdquo; on the form
                    </p>
                  </div>
                  <CopyButton value={shareUrl} label="career card URL" />
                </div>
                <p className={cn(
                  'text-xs font-mono truncate rounded-md px-2 py-1.5',
                  isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-slate-700',
                )}>
                  {shareUrl}
                </p>
              </div>
            )}

            {/* Resume download */}
            {resumeSection && (
              <div
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3',
                  isDark ? 'border-gray-700 bg-gray-800/50' : 'border-slate-200 bg-slate-50',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Briefcase className={cn('w-4 h-4 shrink-0', isDark ? 'text-gray-400' : 'text-slate-500')} />
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-slate-900')}>
                      {resumeSection.title}
                    </p>
                    <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-slate-500')}>
                      Download to attach on the form
                    </p>
                  </div>
                </div>
                <a
                  href={resumeSection.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors shrink-0',
                    isDark
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  )}
                >
                  <Download className="w-3 h-3" />
                  Download
                </a>
              </div>
            )}

            {/* Cover letter */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  Cover letter <span className={isDark ? 'text-gray-500' : 'text-slate-500'} style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  {coverLetter && <CopyButton value={coverLetter} label="cover letter" />}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleGenerateCoverLetter()}
                    disabled={generatingLetter}
                    isLoading={generatingLetter}
                  >
                    {!generatingLetter && <Sparkles className="w-3.5 h-3.5 shrink-0" />}
                    Generate with Stormi
                  </Button>
                </div>
              </div>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Why are you a great fit? Generate one with Stormi or write your own — copy and paste it on the form."
                className={cn(
                  'w-full h-28 px-3 py-2.5 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
                  isDark
                    ? 'bg-gray-800 border border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400',
                )}
                maxLength={1000}
              />
            </div>

            {/* Screener answers */}
            {hasAnswers && (
              <div>
                <button
                  type="button"
                  onClick={() => setScreenersOpen((o) => !o)}
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-semibold cursor-pointer',
                    isDark ? 'text-gray-300 hover:text-white' : 'text-slate-700 hover:text-slate-900',
                  )}
                >
                  <ChevronDown className={cn('w-4 h-4 transition-transform', screenersOpen && 'rotate-180')} />
                  Quick-copy answers ({screenerAnswers.length})
                </button>
                {screenersOpen && (
                  <div className={cn(
                    'mt-2 rounded-xl border divide-y',
                    isDark ? 'border-gray-700 divide-gray-700/50' : 'border-slate-200 divide-slate-100',
                  )}>
                    {(['identity', 'career', 'credentials'] as const).map((group) => {
                      const items = groupedAnswers[group]
                      if (!items.length) return null
                      return items.map((a) => (
                        <div
                          key={a.label}
                          className={cn(
                            'flex items-center justify-between gap-3 px-3 py-2',
                            isDark ? 'bg-gray-800/30' : 'bg-slate-50/60',
                          )}
                        >
                          <div className="min-w-0">
                            <p className={cn('text-[11px] font-medium', isDark ? 'text-gray-500' : 'text-slate-500')}>
                              {a.label}
                            </p>
                            <p className={cn('text-xs truncate', isDark ? 'text-gray-200' : 'text-slate-800')}>
                              {a.value}
                            </p>
                          </div>
                          <CopyButton value={a.value} label={a.label} />
                        </div>
                      ))
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Action bar */}
            <div className="pt-2 space-y-3">
              {recorded ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                    Application recorded — track it in My Applications
                  </p>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => void handleGoApply()}
                  disabled={recording || !job.redirect_url}
                  isLoading={recording}
                >
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  {recording ? 'Recording...' : 'Go apply on employer site'}
                </Button>
              )}

              {activeLens && !activeLens.isDefault && (
                <p className={cn('text-xs text-center', isDark ? 'text-gray-500' : 'text-slate-500')}>
                  Applying with your <span className="font-semibold">{activeLens.name}</span> lens.
                </p>
              )}

              <p className={cn('text-xs text-center', isDark ? 'text-gray-500' : 'text-slate-500')}>
                The employer site opens in a new tab. Use the info above to fill out their form quickly.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {showCreditModal && (
        <StormiCreditModal
          walletAddress={userAddress}
          onClose={() => setShowCreditModal(false)}
          onSuccess={(_usage: StormiUsageInfo) => {
            setShowCreditModal(false)
            void handleGenerateCoverLetter()
          }}
        />
      )}
    </>
  )
}
