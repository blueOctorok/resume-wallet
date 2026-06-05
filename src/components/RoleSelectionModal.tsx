'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useTheme } from '@/contexts/ThemeContext'
import { Loader2, CheckCircle, AlertCircle, Building2, Clock, Lock } from 'lucide-react'

const MAX_REVIEW_NOTE_CHARS = 400

function truncateReviewNote(text: string, max = MAX_REVIEW_NOTE_CHARS) {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).trim()}…`
}

const EMPLOYER_WHITELIST_WALLETS = [
  '0x9499cD25C6737A8195e74262f3c5eAE6dA607df3',
].map(w => w.toLowerCase())

/**
 * Two-tier access model:
 *   company_owner → full control (blocks, team, company profile)
 *   team_member   → use features only; lower permissions in Storm
 *
 * The label is sent as `description` for Stormi + admin audit. An optional
 * job-title field provides additional context without cluttering the choice.
 */
const EMPLOYER_AUTH_TIERS = [
  {
    id: 'company_owner',
    label: 'Company Owner',
    description: 'I\'m authorized to set up and manage this company on Storm.',
  },
  {
    id: 'team_member',
    label: 'Team Member',
    description: 'My company is already on Storm — I\'m joining the team.',
  },
] as const

type EmployerAuthTierId = (typeof EMPLOYER_AUTH_TIERS)[number]['id']

interface EmployerAccessStatus {
  hasAccess: boolean
  companyName?: string
  accessType?: 'owner' | 'team_invite' | 'team_member'
  role?: string
  message?: string
}

interface RoleSelectionModalProps {
  onSelectRole: (role: 'candidate' | 'employer', companyName?: string, dotNumber?: string) => void
  isLoading?: boolean
  userEmail?: string
  sessionUserId?: string
  legacyWalletAddress?: string | null
  existingRole?: 'driver' | 'developer' | 'employer' | 'candidate' | null
  existingCompanyName?: string | null
}

export default function RoleSelectionModal({
  onSelectRole,
  isLoading,
  userEmail,
  sessionUserId,
  legacyWalletAddress,
  existingRole,
  existingCompanyName,
}: RoleSelectionModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  // Map legacy roles to the new two-option model
  const initialRole = existingRole === 'driver' || existingRole === 'developer'
    ? 'candidate'
    : existingRole ?? null
  const [selectedRole, setSelectedRole] = useState<'candidate' | 'employer' | null>(initialRole)

  const [employerAccess, setEmployerAccess] = useState<EmployerAccessStatus | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(false)

  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestFirstName, setRequestFirstName] = useState('')
  const [requestLastName, setRequestLastName] = useState('')
  const [requestEmail, setRequestEmail] = useState(userEmail ?? '')
  const [requestCompanyName, setRequestCompanyName] = useState('')
  /** Two-tier access: company_owner vs team_member — drives Stormi eval + audit. */
  const [employerAuthTier, setEmployerAuthTier] = useState<EmployerAuthTierId | null>(null)
  /** Optional job title for Stormi context (e.g. "Fleet Manager", "Recruiter"). */
  const [employerJobTitle, setEmployerJobTitle] = useState('')
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<{
    companyName: string
    createdAt: string
    message?: string
    status?: 'flagged' | 'pending'
    reviewNote?: string
  } | null>(null)

  const whitelistSource = (legacyWalletAddress || sessionUserId || '').toLowerCase()
  const isAdminWhitelisted =
    !!whitelistSource && EMPLOYER_WHITELIST_WALLETS.includes(whitelistSource)
  const needsEmailForEmployer = !userEmail && !sessionUserId && !isAdminWhitelisted
  /** Employer-linked wallets cannot use the candidate hub (same rule as POST /api/user/set-role). */
  const candidateDisabled = existingRole === 'employer'

  const checkEmployerAccess = useCallback(async () => {
    if (isAdminWhitelisted) {
      setEmployerAccess({ hasAccess: true, message: 'Admin access granted' })
      return
    }

    if (!sessionUserId && !userEmail) return

    setCheckingAccess(true)
    try {
      const res = await fetch('/api/user/check-employer-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, sessionUserId }),
      })
      const data = await res.json()
      setEmployerAccess(data)
    } catch (err) {
      console.error('Error checking employer access:', err)
      setEmployerAccess({ hasAccess: false, message: 'Error checking access. Please try again.' })
    } finally {
      setCheckingAccess(false)
    }
  }, [userEmail, sessionUserId, isAdminWhitelisted])

  const checkPendingRequest = useCallback(async () => {
    if (!sessionUserId) return
    try {
      const res = await fetch('/api/employer/access-request')
      const data = await res.json()
      if (data.hasPendingRequest && data.request) {
        setPendingRequest({
          companyName: data.request.company_name,
          createdAt: data.request.created_at,
          status: data.request.status === 'flagged' ? 'flagged' : 'pending',
          reviewNote:
            typeof data.request.ai_reason === 'string' && data.request.ai_reason.trim()
              ? truncateReviewNote(data.request.ai_reason)
              : undefined,
        })
      }
    } catch (err) {
      console.error('Error checking pending request:', err)
    }
  }, [sessionUserId])

  const resolvedRoleDescription = (): string => {
    if (!employerAuthTier) return ''
    const tier = EMPLOYER_AUTH_TIERS.find(t => t.id === employerAuthTier)
    if (!tier) return ''
    const title = employerJobTitle.trim()
    return title ? `${tier.label} (${title})` : tier.label
  }

  const isRequestFormValid =
    !!requestFirstName.trim() &&
    !!requestLastName.trim() &&
    !!requestEmail.trim() && requestEmail.includes('@') &&
    !!requestCompanyName.trim() &&
    !!employerAuthTier

  const handleSubmitRequest = async () => {
    if (!sessionUserId || !isRequestFormValid) return

    setSubmittingRequest(true)
    setRequestError(null)

    try {
      const res = await fetch('/api/employer/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: requestFirstName.trim(),
          lastName: requestLastName.trim(),
          email: requestEmail.trim(),
          companyName: requestCompanyName.trim(),
          description: resolvedRoleDescription().trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to submit request')

      // Stormi auto-approved new company — skip straight to employer role + onboarding
      if (data.autoApproved) {
        onSelectRole('employer', data.company?.name)
        return
      }

      // Domain-verified auto-join to existing company — skip onboarding entirely
      if (data.autoJoined) {
        onSelectRole('employer', data.company?.name)
        return
      }

      // Stormi blocked — show denial reason
      if (data.blocked) {
        setRequestError(data.message || 'Your request could not be approved at this time.')
        return
      }

      // Flagged / pending — explicit outcome (not silent "loading")
      setRequestSubmitted(true)
      setPendingRequest({
        companyName: data.request?.companyName || requestCompanyName.trim(),
        createdAt: new Date().toISOString(),
        status: data.request?.status === 'flagged' ? 'flagged' : 'pending',
        message: typeof data.message === 'string' ? data.message : undefined,
        reviewNote:
          typeof data.reviewNote === 'string' && data.reviewNote.trim()
            ? truncateReviewNote(data.reviewNote)
            : undefined,
      })
      setShowRequestForm(false)
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setSubmittingRequest(false)
    }
  }

  useEffect(() => {
    if (candidateDisabled && selectedRole === 'candidate') {
      setSelectedRole('employer')
    }
  }, [candidateDisabled, selectedRole])

  useEffect(() => {
    if (selectedRole !== 'employer') {
      setEmployerAccess(null)
      setShowRequestForm(false)
      setRequestError(null)
      setRequestSubmitted(false)
      return
    }
    checkEmployerAccess()
  }, [selectedRole, checkEmployerAccess])

  useEffect(() => {
    if (selectedRole === 'employer' && sessionUserId) {
      checkPendingRequest()
    }
  }, [selectedRole, sessionUserId, checkPendingRequest])

  const canProceed = selectedRole !== null && (
    selectedRole !== 'employer' ||
    (employerAccess?.hasAccess === true) ||
    isAdminWhitelisted
  )

  const handleConfirm = () => {
    if (selectedRole && canProceed) {
      if (selectedRole === 'employer') {
        onSelectRole(selectedRole, employerAccess?.companyName)
      } else {
        onSelectRole(selectedRole)
      }
    }
  }

  const inputClass = isDark
    ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'

  const checkmarkIcon = (
    <svg className='w-4 h-4 sm:w-5 sm:h-5 text-teal-600' fill='currentColor' viewBox='0 0 20 20'>
      <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
    </svg>
  )

  return (
    <Modal onClose={() => {}} disableBackdropClose zIndex={80} maxWidth="max-w-2xl">
      <div
        className={`max-h-[95vh] flex flex-col overflow-hidden ${
          isDark
            ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
            : 'bg-gradient-to-br from-white via-gray-50 to-white'
        }`}
      >
        <div className='overflow-y-auto overscroll-contain flex-1'>
          {/* Header */}
          <div className={`p-4 sm:p-8 text-center border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className='inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 mb-3 sm:mb-4'>
              <span className='text-2xl sm:text-3xl'>⛈️</span>
            </div>
            <h2 className={`text-xl sm:text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Welcome to Storm!
            </h2>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Let's get you set up. What brings you here?
            </p>
          </div>

          {/* Role Options — 2 columns */}
          <div className='p-4 sm:p-8 grid gap-4 sm:gap-6 md:grid-cols-2'>
            {/* Candidate Option — disabled for employer accounts (server-enforced too) */}
            <button
              type="button"
              onClick={() => {
                if (!candidateDisabled) setSelectedRole('candidate')
              }}
              disabled={isLoading || candidateDisabled}
              aria-disabled={candidateDisabled}
              className={`group relative p-4 sm:p-6 rounded-lg sm:rounded-xl transition-all duration-300 text-left ${
                candidateDisabled
                  ? isDark
                    ? 'bg-gray-900/40 border-2 border-gray-700 opacity-70 cursor-not-allowed'
                    : 'bg-gray-100 border-2 border-gray-200 opacity-75 cursor-not-allowed'
                  : selectedRole === 'candidate'
                    ? 'bg-gradient-to-br from-teal-600 to-teal-700 border-2 border-teal-400 shadow-lg shadow-teal-500/50'
                    : isDark
                      ? 'bg-gray-800/50 border-2 border-gray-700 hover:border-teal-500 hover:bg-gray-800'
                      : 'bg-white border-2 border-gray-200 hover:border-teal-500 hover:bg-gray-50'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : candidateDisabled ? '' : 'cursor-pointer active:scale-[0.98] sm:hover:scale-[1.02]'}`}
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-lg mb-3 sm:mb-4 ${
                selectedRole === 'candidate'
                  ? 'bg-white/20'
                  : isDark
                    ? 'bg-teal-500/20 group-hover:bg-teal-500/30'
                    : 'bg-teal-100 group-hover:bg-teal-200'
              }`}>
                <span className='text-2xl sm:text-3xl'>🧑‍💼</span>
              </div>

              <h3
                className={`text-lg sm:text-xl font-bold mb-1 sm:mb-2 flex items-center gap-2 ${
                  candidateDisabled
                    ? isDark
                      ? 'text-gray-500'
                      : 'text-gray-500'
                    : selectedRole === 'candidate'
                      ? 'text-white'
                      : isDark
                        ? 'text-white'
                        : 'text-gray-900'
                }`}
              >
                {candidateDisabled && (
                  <Lock className="w-5 h-5 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden />
                )}
                Candidate
              </h3>
              <p
                className={`text-xs sm:text-sm mb-3 sm:mb-4 ${
                  candidateDisabled
                    ? isDark
                      ? 'text-gray-500'
                      : 'text-gray-600'
                    : selectedRole === 'candidate'
                      ? 'text-white/90'
                      : isDark
                        ? 'text-gray-400'
                        : 'text-gray-600'
                }`}
              >
                {candidateDisabled
                  ? 'Not available — this wallet is tied to your company. Use another wallet for a candidate profile.'
                  : 'Build your professional profile'}
              </p>

              {!candidateDisabled && (
                <ul className='space-y-1.5 sm:space-y-2'>
                  {['Composable hub you build', 'Verified credentials & history', 'Shareable Career Card'].map((feature, idx) => (
                    <li key={idx} className='flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm'>
                      <span className={selectedRole === 'candidate' ? 'text-teal-200' : isDark ? 'text-teal-400' : 'text-teal-600'}>✓</span>
                      <span className={selectedRole === 'candidate' ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'}>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {selectedRole === 'candidate' && !candidateDisabled && (
                <div className='absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center'>
                  {checkmarkIcon}
                </div>
              )}
            </button>

            {/* Employer Option */}
            <button
              onClick={() => setSelectedRole('employer')}
              disabled={isLoading}
              className={`group relative p-4 sm:p-6 rounded-lg sm:rounded-xl transition-all duration-300 text-left ${
                selectedRole === 'employer'
                  ? 'bg-gradient-to-br from-teal-500 to-cyan-600 border-2 border-teal-400 shadow-lg shadow-teal-500/50'
                  : isDark
                    ? 'bg-gray-800/50 border-2 border-gray-700 hover:border-teal-400 hover:bg-gray-800'
                    : 'bg-white border-2 border-gray-200 hover:border-teal-500 hover:bg-teal-50'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98] sm:hover:scale-[1.02]'}`}
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-lg mb-3 sm:mb-4 ${
                selectedRole === 'employer'
                  ? 'bg-white/20'
                  : isDark
                    ? 'bg-teal-500/20 group-hover:bg-teal-500/30'
                    : 'bg-teal-100 group-hover:bg-teal-200'
              }`}>
                <span className='text-2xl sm:text-3xl'>🏢</span>
              </div>

              <h3 className={`text-lg sm:text-xl font-bold mb-1 sm:mb-2 ${
                selectedRole === 'employer' ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Employer
              </h3>
              <p className={`text-xs sm:text-sm mb-3 sm:mb-4 ${
                selectedRole === 'employer' ? 'text-white/90' : isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Hire verified talent
              </p>

              <ul className='space-y-1.5 sm:space-y-2'>
                {['Post job openings', 'Review applicants', 'Manage pipeline'].map((feature, idx) => (
                  <li key={idx} className='flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm'>
                    <span className={selectedRole === 'employer' ? 'text-white/80' : isDark ? 'text-teal-400' : 'text-teal-600'}>✓</span>
                    <span className={selectedRole === 'employer' ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'}>{feature}</span>
                  </li>
                ))}
              </ul>

              {selectedRole === 'employer' && (
                <div className='absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center'>
                  {checkmarkIcon}
                </div>
              )}
            </button>
          </div>

          {/* Employer Access Status */}
          {selectedRole === 'employer' && (
            <div className={`mx-4 sm:mx-8 mb-4 p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 ${
              isDark
                ? employerAccess?.hasAccess
                  ? 'bg-green-900/20 border-green-500/40'
                  : 'bg-yellow-900/20 border-yellow-500/40'
                : employerAccess?.hasAccess
                  ? 'bg-green-50 border-green-300'
                  : 'bg-yellow-50 border-yellow-300'
            }`}>
              {checkingAccess && (
                <div className='flex items-center gap-3'>
                  <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Checking employer access...</span>
                </div>
              )}

              {!checkingAccess && needsEmailForEmployer && (
                <div className='flex items-start gap-3'>
                  <AlertCircle className='w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0' />
                  <div>
                    <p className={`font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>Email required</p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Please connect with an email address to access employer features.
                    </p>
                  </div>
                </div>
              )}

              {!checkingAccess && !needsEmailForEmployer && employerAccess?.hasAccess && (
                <div className='flex items-start gap-3'>
                  <CheckCircle className='w-5 h-5 text-green-500 mt-0.5 flex-shrink-0' />
                  <div>
                    <p className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>Access granted</p>
                    {employerAccess.companyName && (
                      <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <Building2 className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{employerAccess.companyName}</span>
                        {employerAccess.accessType === 'owner' && (
                          <span className='text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400'>Owner</span>
                        )}
                        {employerAccess.accessType === 'team_invite' && (
                          <span className='text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400'>Invited as {employerAccess.role}</span>
                        )}
                        {employerAccess.accessType === 'team_member' && (
                          <span className='text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400'>{employerAccess.role}</span>
                        )}
                      </div>
                    )}
                    <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{employerAccess.message}</p>
                  </div>
                </div>
              )}

              {!checkingAccess && !needsEmailForEmployer && employerAccess && !employerAccess.hasAccess && (
                <div className='space-y-4'>
                  {(pendingRequest || requestSubmitted) && (
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
                      <div className='flex items-start gap-3'>
                        <Clock className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                        <div>
                          <p className={`font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Request submitted</p>
                          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {pendingRequest?.message || (
                              <>Your request to set up <strong>{pendingRequest?.companyName || requestCompanyName}</strong> is being reviewed by our team.</>
                            )}
                          </p>
                          <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            You&apos;ll be notified once your request is processed. You can close this and check back later.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {showRequestForm && !pendingRequest && !requestSubmitted && (
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                      <h4 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Set up your company on Storm
                      </h4>
                      <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        This request is for company owners, HR directors, or hiring managers.
                      </p>

                      <div className='space-y-3'>
                        <div className='grid grid-cols-2 gap-3'>
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              First Name <span className='text-red-400'>*</span>
                            </label>
                            <input
                              type='text'
                              value={requestFirstName}
                              onChange={(e) => setRequestFirstName(e.target.value)}
                              placeholder='John'
                              className={`w-full px-3 py-2 rounded-lg border transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Last Name <span className='text-red-400'>*</span>
                            </label>
                            <input
                              type='text'
                              value={requestLastName}
                              onChange={(e) => setRequestLastName(e.target.value)}
                              placeholder='Smith'
                              className={`w-full px-3 py-2 rounded-lg border transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${inputClass}`}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Company Email <span className='text-red-400'>*</span>
                          </label>
                          <input
                            type='email'
                            value={requestEmail}
                            onChange={(e) => setRequestEmail(e.target.value)}
                            placeholder='you@yourcompany.com'
                            className={`w-full px-3 py-2 rounded-lg border transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${inputClass}`}
                          />
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Must match your company domain for instant access
                          </p>
                        </div>

                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Legal Company Name <span className='text-red-400'>*</span>
                          </label>
                          <input
                            type='text'
                            value={requestCompanyName}
                            onChange={(e) => setRequestCompanyName(e.target.value)}
                            placeholder='e.g., Acme Trucking LLC'
                            className={`w-full px-3 py-2 rounded-lg border transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${inputClass}`}
                          />
                        </div>

                        <fieldset className='space-y-2'>
                          <legend className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Your Role <span className='text-red-400'>*</span>
                          </legend>

                          <div className='space-y-2'>
                            {EMPLOYER_AUTH_TIERS.map(({ id, label, description }) => (
                              <label
                                key={id}
                                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors ${
                                  employerAuthTier === id
                                    ? isDark
                                      ? 'border-teal-500/60 bg-teal-500/10'
                                      : 'border-teal-500 bg-teal-50'
                                    : isDark
                                      ? 'border-gray-600 hover:border-gray-500'
                                      : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type='radio'
                                  name='employer-auth-tier'
                                  checked={employerAuthTier === id}
                                  onChange={() => setEmployerAuthTier(id)}
                                  className='mt-0.5 border-gray-300 text-teal-600 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-900 dark:focus:ring-teal-500'
                                />
                                <div>
                                  <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{label}</span>
                                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
                                </div>
                              </label>
                            ))}
                          </div>

                          <div className='pt-1'>
                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Job title <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>(optional)</span>
                            </label>
                            <input
                              type='text'
                              value={employerJobTitle}
                              onChange={(e) => setEmployerJobTitle(e.target.value)}
                              placeholder='e.g., Fleet Manager, HR Director'
                              className={`w-full px-3 py-2 rounded-lg border transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${inputClass}`}
                            />
                          </div>
                        </fieldset>

                        <div className={`p-3 rounded-lg text-xs ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400' : 'bg-yellow-50 border border-yellow-200 text-yellow-700'}`}>
                          <strong>Owners</strong> get full control — manage blocks, team, and company settings.{' '}
                          <strong>Team members</strong> can use features but cannot manage the company. Choose the option that matches your role.
                        </div>

                        {requestError && <p className='text-sm text-red-500'>{requestError}</p>}

                        <div className='flex gap-2 pt-2'>
                          <Button
                            type='button'
                            variant='secondary'
                            className='flex-1'
                            onClick={() => setShowRequestForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type='button'
                            variant='primary'
                            className='flex-1'
                            isLoading={submittingRequest}
                            disabled={submittingRequest || !isRequestFormValid}
                            onClick={handleSubmitRequest}
                          >
                            Submit Request
                          </Button>
                        </div>
                      </div>

                      <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <strong>Team members:</strong> If your company is already on Storm, use your company email and you&apos;ll be added automatically.
                      </p>
                    </div>
                  )}

                  {!showRequestForm && !pendingRequest && !requestSubmitted && (
                    <div className='flex items-start gap-3'>
                      <Building2 className='w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0' />
                      <div className='flex-1'>
                        <p className={`font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>Company setup required</p>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          To access the employer dashboard, you need to set up your company or be invited.
                        </p>
                        <button
                          onClick={() => setShowRequestForm(true)}
                          className='mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-500 transition-colors'
                        >
                          Request Company Access
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className={`p-4 sm:p-8 pt-4 flex justify-center border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={handleConfirm}
              disabled={!canProceed || isLoading}
              className={`w-full sm:w-auto px-6 sm:px-8 py-3 rounded-lg font-semibold text-base sm:text-lg transition-all duration-300 ${
                canProceed && !isLoading
                  ? selectedRole === 'candidate'
                    ? 'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-600 text-white shadow-lg shadow-teal-500/50 active:scale-[0.98] sm:hover:scale-105'
                    : 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-cyan-600 hover:to-teal-500 text-white shadow-lg shadow-teal-500/50 active:scale-[0.98] sm:hover:scale-105'
                  : isDark
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <span className='flex items-center justify-center gap-2'>
                  <svg className='animate-spin h-4 w-4 sm:h-5 sm:w-5' viewBox='0 0 24 24'>
                    <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' fill='none' />
                    <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
                  </svg>
                  Setting up...
                </span>
              ) : selectedRole ? (
                selectedRole === 'employer' && !canProceed
                  ? checkingAccess
                    ? 'Checking access...'
                    : pendingRequest || requestSubmitted
                      ? 'Request pending review'
                      : 'Company setup required'
                  : selectedRole === 'employer' && employerAccess?.accessType === 'team_invite'
                    ? `Join ${employerAccess.companyName || 'company'}`
                    : `Continue as ${selectedRole === 'candidate' ? 'Candidate' : 'Employer'}`
              ) : 'Select a role to continue'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
