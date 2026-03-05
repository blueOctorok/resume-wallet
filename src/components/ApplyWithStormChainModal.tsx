'use client'

import { useState, useEffect } from 'react'
import { X, Briefcase, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import ProfileCompleteness from './ProfileCompleteness'
import { calculateProfileScore, canApplyToJobs } from '@/lib/profile-completeness'

interface Job {
  id: string
  title: string
  company: string
  location: string
  salary?: string
  description?: string
  redirect_url?: string
}

interface ApplyWithStormChainModalProps {
  isOpen: boolean
  onClose: () => void
  job: Job | null
  userAddress: string | null
  onApplicationSubmitted?: () => void
}

interface DriverProfile {
  id: string
  resume_url: string | null
  cdl_class: string | null
  cdl_endorsements: string[] | null
  experience_years: number | null
  profile_completion_score: number
  dot_application_data: any
}

export default function ApplyWithStormChainModal({
  isOpen,
  onClose,
  job,
  userAddress,
  onApplicationSubmitted
}: ApplyWithStormChainModalProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [profile, setProfile] = useState<DriverProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen && userAddress) {
      fetchDriverProfile()
    }
  }, [isOpen, userAddress])

  const fetchDriverProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/driver/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userAddress })
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
      } else {
        setError('Failed to load your profile. Please complete your DOT application first.')
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Failed to load your profile.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!job || !userAddress || !profile) return

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          jobId: job.id,
          jobTitle: job.title,
          employerName: job.company,
          jobLocation: job.location,
          jobUrl: job.redirect_url,
          coverLetter: coverLetter.trim() || undefined
        })
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

  const cardClass = isDark
    ? 'bg-gray-800/90 border border-gray-700'
    : 'bg-white border border-gray-200'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${cardClass}`}>
        
        {/* Header */}
        <div className={`sticky top-0 border-b p-6 flex items-center justify-between z-10 ${
          isDark ? 'bg-gray-800/90 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isDark
                ? 'bg-teal-500/20 border border-teal-500/30'
                : 'bg-teal-100 border border-teal-200'
            }`}>
              <Briefcase className={`w-6 h-6 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Apply with StormChain
              </h2>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                Your verified application
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <X className={isDark ? 'text-gray-400' : 'text-gray-600'} />
          </button>
        </div>

        {/* Success State */}
        {success && (
          <div className="p-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">
                Application Submitted!
              </h3>
              <p className="text-green-700 dark:text-green-300">
                Your StormChain application has been sent to {job.company}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !success && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 rounded-full animate-spin mx-auto mb-4" />
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading your profile...</p>
          </div>
        )}

        {/* Error State */}
        {error && !success && (
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

        {/* Main Content */}
        {!loading && !success && profile && (() => {
          const completeness = calculateProfileScore(profile)
          const eligibility = canApplyToJobs(profile)

          return (
            <div className="p-6 space-y-6">
              
              {/* Job Details */}
              <div className={`rounded-xl p-4 border ${
                isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}>
                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {job.title}
                </h3>
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  {job.company} • {job.location}
                </p>
                {job.salary && (
                  <p className="text-sm text-green-600 dark:text-green-400 font-semibold mt-1">
                    {job.salary}
                  </p>
                )}
              </div>

              {/* Profile Completeness - Full Component */}
              <ProfileCompleteness 
                completeness={completeness}
                showDetails={true}
              />

              {/* Eligibility Warning */}
              {!eligibility.canApply && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-900 dark:text-red-100 font-semibold">Profile Incomplete</p>
                    <p className="text-red-700 dark:text-red-300 text-sm">{eligibility.reason}</p>
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                      Please complete your DOT application and add your CDL information.
                    </p>
                  </div>
                </div>
              )}

              {/* What Will Be Sent */}
              <div>
              <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                What we'll send to the employer:
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    Your complete DOT application
                  </span>
                </div>
                {profile.resume_url && (
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      Resume (blockchain-verified)
                    </span>
                  </div>
                )}
                {profile.cdl_class && (
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      CDL Class {profile.cdl_class}
                      {profile.cdl_endorsements && profile.cdl_endorsements.length > 0 && 
                        ` with ${profile.cdl_endorsements.join(', ')} endorsements`
                      }
                    </span>
                  </div>
                )}
                {profile.experience_years && (
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      {profile.experience_years} years of experience
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    Shareable StormChain profile link
                  </span>
                </div>
              </div>
            </div>

            {/* Cover Letter (Optional) */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Cover Letter <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
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

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                disabled={submitting}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 ${
                  isDark
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !profile || !eligibility.canApply}
                className="flex-1 px-6 py-3 rounded-xl font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    {eligibility.canApply ? 'Submit Application' : 'Complete Profile to Apply'}
                  </>
                )}
              </button>
            </div>

            {/* Disclaimer */}
            <p className={`text-xs text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              By submitting, your StormChain application will be sent directly to {job.company}.
              <br />
              You can track the status in "My Applications".
            </p>

          </div>
          )
        })()}

      </div>
    </div>
  )
}
