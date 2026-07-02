'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * Product guardrail: Storm is not a batch-apply tool. Lenses improve the
 * quality of a single application; they do not multiply clicks. Do not add
 * an "apply to N jobs with lens X" surface — that re-creates AIApply's spam
 * dynamic and burns our employer-trust moat.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Briefcase, CheckCircle, AlertCircle, User, X, Sparkles } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import type { StormiUsageInfo } from '@/lib/ava-chat'
import { useSimpleModeStore } from '@/stores/simple-mode-store'
import { useLenses } from '@/stores/career-card-lenses-store'

const StormiCreditModal = dynamic(() => import('@/components/StormiCreditModal'), { ssr: false })
import {
  computeCareerApplyReadiness,
  canApplyWithCareerCard,
  getStatusColor,
  getStatusMessage,
} from '@/lib/profile-completeness'
import type { ProjectedCareerCard } from '@/types/career-card'

interface Job {
  id: string
  title: string
  company: string
  location: string
  salary?: string
  description?: string
  redirect_url?: string
  /** Optional context for apply + cover-letter prefill (Adzuna passes these). */
  salary_min?: number
  salary_max?: number
  created?: string
  category?: string
  contract_type?: string
  is_external?: boolean
}

interface ApplyWithStormChainModalProps {
  isOpen: boolean
  onClose: () => void
  job: Job | null
  userAddress: string | null
  onApplicationSubmitted?: () => void
}

export default function ApplyWithStormChainModal({
  isOpen,
  onClose,
  job,
  userAddress,
  onApplicationSubmitted,
}: ApplyWithStormChainModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [card, setCard] = useState<ProjectedCareerCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [generatingLetter, setGeneratingLetter] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)

  // Career Card Lens in effect for this submission. Simple Mode keeps the
  // active lens id in the store; the modal just reads it. If empty, the
  // server resolves to the default "Full profile" lens.
  const activeLensId = useSimpleModeStore((s) => s.activeLensId)
  const lenses = useLenses()
  const activeLens = useMemo(() => {
    if (activeLensId) return lenses.find((l) => l.id === activeLensId) ?? null
    return lenses.find((l) => l.isDefault) ?? null
  }, [activeLensId, lenses])

  const resetState = useCallback(() => {
    setCard(null)
    setLoading(true)
    setSubmitting(false)
    setCoverLetter('')
    setError(null)
    setSuccess(false)
    setGeneratingLetter(false)
    setShowCreditModal(false)
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
        const response = await fetch(`/api/career-card${qs}`)
        const data = await response.json()
        if (!response.ok || !data.card) {
          setError(data.error || 'Could not load your career card.')
          setCard(null)
          return
        }
        setCard(data.card as ProjectedCareerCard)
      } catch (err) {
        console.error('[ApplyModal] career card fetch:', err)
        setError('Failed to load your career card.')
        setCard(null)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [isOpen, userAddress, resetState, activeLensId])

  const handleGenerateCoverLetter = async () => {
    if (!job || !userAddress) return
    setGeneratingLetter(true)
    setError(null)
    try {
      const response = await fetch('/api/ai/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          jobTitle: job.title,
          company: job.company,
          location: job.location,
          description: job.description ?? '',
        }),
      })
      const data = await response.json()
      if (response.status === 402) {
        setShowCreditModal(true)
        return
      }
      if (!response.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not generate cover letter')
        return
      }
      const text = typeof data.coverLetter === 'string' ? data.coverLetter : ''
      setCoverLetter(text.slice(0, 1000))
    } catch (err) {
      console.error('[ApplyModal] cover letter:', err)
      setError('Failed to generate cover letter.')
    } finally {
      setGeneratingLetter(false)
    }
  }

  const handleSubmit = async () => {
    if (!job || !userAddress || !card) return
    const gate = canApplyWithCareerCard(card)
    if (!gate.canApply) return

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionUserId: userAddress,
          jobId: job.id,
          jobTitle: job.title,
          employerName: job.company,
          jobLocation: job.location,
          jobUrl: job.redirect_url,
          coverLetter: coverLetter.trim() || undefined,
          // Lens snapshot — server validates + rejects stray ids. The default
          // lens submits `null` (server stores NULLs), which is intentional.
          lensId: activeLens && !activeLens.isDefault ? activeLens.id : undefined,
          lensName: activeLens && !activeLens.isDefault ? activeLens.name : undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          onClose()
          onApplicationSubmitted?.()
        }, 2000)
      } else {
        setError(data.error || 'Failed to submit application')
      }
    } catch (err) {
      console.error('Error submitting application:', err)
      setError('Failed to submit application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !job) return null

  const readiness = card ? computeCareerApplyReadiness(card) : null
  const eligibility = card ? canApplyWithCareerCard(card) : { canApply: false }
  const readinessColors = readiness ? getStatusColor(readiness.status) : null

  return (
    <>
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div>
        <div
          className={`sticky top-0 border-b p-6 flex items-center justify-between z-10 ${
            isDark ? 'bg-gray-800/90 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isDark
                  ? 'bg-teal-500/20 border border-teal-500/30'
                  : 'bg-teal-100 border border-teal-200'
              }`}
            >
              <Briefcase className={`w-6 h-6 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Easy apply with Career Card
              </h2>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                One submission — your ZKnight profile snapshot
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="md" className="!p-2 shrink-0" onClick={onClose} aria-label="Close">
            <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
          </Button>
        </div>

        {success && (
          <div className="p-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">
                Application Submitted!
              </h3>
              <p className="text-green-700 dark:text-green-300">
                Your ZKnight application has been sent to {job.company}
              </p>
            </div>
          </div>
        )}

        {loading && !success && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 rounded-full animate-spin mx-auto mb-4" />
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading your career card…</p>
          </div>
        )}

        {error && !success && !loading && (
          <div className="p-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-900 dark:text-red-100 font-semibold">Error</p>
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !success && card && readiness && readinessColors && (
          <div className="p-6 space-y-6">
            <div
              className={`rounded-xl p-4 border ${
                isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{job.title}</h3>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {job.company} • {job.location}
              </p>
              {job.salary && (
                <p className="text-sm text-green-600 dark:text-green-400 font-semibold mt-1">{job.salary}</p>
              )}
            </div>

            <div className={`rounded-xl p-6 ${readinessColors.bg} border-2 ${readinessColors.border}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className={`text-lg font-bold ${readinessColors.text}`}>Application readiness</h3>
                  <p className={`text-sm ${readinessColors.text} opacity-80`}>
                    {getStatusMessage(readiness.status)}
                  </p>
                </div>
                <div className={`text-3xl font-bold ${readinessColors.text}`}>{readiness.percentage}</div>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-teal-500 dark:bg-teal-400 transition-all"
                  style={{ width: `${readiness.score}%` }}
                />
              </div>
              {readiness.hints.length > 0 && (
                <ul className={`text-sm space-y-1 ${readinessColors.text} opacity-90 list-disc list-inside`}>
                  {readiness.hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
            </div>

            {!eligibility.canApply && eligibility.reason && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-900 dark:text-red-100 font-semibold">Complete your career card</p>
                  <p className="text-red-700 dark:text-red-300 text-sm">{eligibility.reason}</p>
                </div>
              </div>
            )}

            <div
              className={`rounded-xl p-4 border flex gap-3 ${
                isDark ? 'bg-gray-800/80 border-gray-600' : 'bg-white border-gray-200'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-gray-700' : 'bg-gray-100'
                }`}
              >
                <User className={`w-6 h-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
              </div>
              <div className="min-w-0">
                <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{card.name}</p>
                {card.occupation && (
                  <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{card.occupation}</p>
                )}
                {card.location && (
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{card.location}</p>
                )}
              </div>
            </div>

            <div>
              <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Included in your application
              </h3>
              <div className="space-y-2">
                {card.sections.length === 0 ? (
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    No career card sections yet — add blocks on your hub.
                  </p>
                ) : (
                  card.sections.map((s) => (
                    <div key={`${s.blockType}-${s.label}`} className="flex items-center gap-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                      <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{s.label}</span>
                    </div>
                  ))
                )}
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    Shareable application link (view count for you)
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className={`block text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Cover letter <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleGenerateCoverLetter()}
                  disabled={generatingLetter || submitting}
                  isLoading={generatingLetter}
                >
                  {!generatingLetter && <Sparkles className="w-3.5 h-3.5 shrink-0" />}
                  Generate with AI
                </Button>
              </div>
              <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                3 free per day (Sonnet), then uses your AI credits (Haiku).
              </p>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Why are you a great fit for this position?"
                className={`w-full h-32 px-4 py-3 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                  isDark
                    ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                maxLength={1000}
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {coverLetter.length} / 1000 characters
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => void handleSubmit()}
                disabled={submitting || !eligibility.canApply}
                isLoading={submitting}
              >
                {eligibility.canApply
                  ? activeLens && !activeLens.isDefault
                    ? `Apply \u00b7 ${activeLens.name}`
                    : 'Submit application'
                  : 'Complete career card to apply'}
              </Button>
            </div>

            {activeLens && !activeLens.isDefault && (
              <p className={`text-xs text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Submitting with your <span className="font-semibold">{activeLens.name}</span> lens.
                <span className="opacity-60"> Change in Simple Mode before submitting.</span>
              </p>
            )}

            <p className={`text-xs text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              By submitting, employers receive your ZKnight application snapshot and link.
              <br />
              Track status in My Applications.
            </p>
          </div>
        )}
      </div>
    </Modal>

      {showCreditModal && (
        <StormiCreditModal
          sessionUserId={userAddress}
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
