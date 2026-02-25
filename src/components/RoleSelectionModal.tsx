'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { Loader2, CheckCircle, AlertCircle, Building2 } from 'lucide-react'

// Whitelisted wallet addresses that bypass email requirement for employer (e.g., admins)
const EMPLOYER_WHITELIST_WALLETS = [
  '0x9499cD25C6737A8195e74262f3c5eAE6dA607df3', // Main admin account
].map(w => w.toLowerCase())

interface EmployerAccessStatus {
  hasAccess: boolean
  companyName?: string
  accessType?: 'owner' | 'team_invite' | 'team_member'
  role?: string
  message?: string
}

interface RoleSelectionModalProps {
  onSelectRole: (role: 'driver' | 'developer' | 'employer', companyName?: string, dotNumber?: string) => void
  isLoading?: boolean
  userEmail?: string // Used to check employer access
  walletAddress?: string // Used for whitelist check
  existingRole?: 'driver' | 'developer' | 'employer' | null // Current role if switching
  existingCompanyName?: string | null // Pre-populate for existing employers
}

export default function RoleSelectionModal({
  onSelectRole,
  isLoading,
  userEmail,
  walletAddress,
  existingRole,
  existingCompanyName,
}: RoleSelectionModalProps) {
  const { theme } = useTheme()
  // Pre-select existing role if switching, otherwise null
  const [selectedRole, setSelectedRole] = useState<
    'driver' | 'developer' | 'employer' | null
  >(existingRole ?? null)

  // Employer access check state
  const [employerAccess, setEmployerAccess] = useState<EmployerAccessStatus | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(false)

  // Check if user is whitelisted admin (bypasses email requirement)
  const isAdminWhitelisted = walletAddress && EMPLOYER_WHITELIST_WALLETS.includes(walletAddress.toLowerCase())

  // Employer check needs wallet or email (unless whitelisted)
  const needsEmailForEmployer = !userEmail && !walletAddress && !isAdminWhitelisted

  // Check employer access when user selects employer (uses wallet + email)
  const checkEmployerAccess = useCallback(async () => {
    // Whitelisted admins get automatic access
    if (isAdminWhitelisted) {
      setEmployerAccess({
        hasAccess: true,
        message: 'Admin access granted',
      })
      return
    }

    // Need either wallet or email to check
    if (!walletAddress && !userEmail) {
      return
    }

    setCheckingAccess(true)
    try {
      const res = await fetch('/api/user/check-employer-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userEmail,
          walletAddress: walletAddress,
        }),
      })
      const data = await res.json()
      setEmployerAccess(data)
    } catch (err) {
      console.error('Error checking employer access:', err)
      setEmployerAccess({
        hasAccess: false,
        message: 'Error checking access. Please try again.',
      })
    } finally {
      setCheckingAccess(false)
    }
  }, [userEmail, walletAddress, isAdminWhitelisted])

  // Check access when employer is selected - always verify fresh from API
  useEffect(() => {
    if (selectedRole === 'employer' && !checkingAccess) {
      // Always re-check when employer is selected (don't rely on cached data)
      checkEmployerAccess()
    }
    // Reset employer access when switching away from employer
    if (selectedRole !== 'employer') {
      setEmployerAccess(null)
    }
  }, [selectedRole]) // intentionally minimal deps - we want fresh check each time

  // Can proceed: driver/developer always, employer only if has access
  const canProceed = selectedRole !== null && (
    selectedRole !== 'employer' || 
    (employerAccess?.hasAccess === true) ||
    isAdminWhitelisted
  )

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalWidth = document.body.style.width

    // Lock scroll on mount
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'

    // Restore on unmount
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.width = originalWidth
    }
  }, [])

  const handleConfirm = () => {
    if (selectedRole && canProceed) {
      if (selectedRole === 'employer') {
        // Pass company name from access check (not user input anymore)
        onSelectRole(selectedRole, employerAccess?.companyName)
      } else {
        onSelectRole(selectedRole)
      }
    }
  }

  return (
    <div
      className='fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto overscroll-none'
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        style={{ touchAction: 'none' }}
      />

      {/* Modal - scrollable container */}
      <div
        className={`
          relative max-w-3xl w-full rounded-xl sm:rounded-2xl shadow-2xl 
          my-auto max-h-[95vh] flex flex-col overflow-hidden
          ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700'
              : 'bg-gradient-to-br from-white via-gray-50 to-white border border-gray-200'
          }
        `}
        style={{ touchAction: 'auto' }}
      >
        {/* Scrollable content wrapper */}
        <div className='overflow-y-auto overscroll-contain flex-1'>
          {/* Header */}
          <div
            className={`p-4 sm:p-8 text-center border-b ${theme === 'dark' ? 'border-brand-mint/30' : 'border-brand-sage/30'}`}
          >
            <div className='inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-brand-sage to-brand-mint mb-3 sm:mb-4'>
              <span className='text-2xl sm:text-3xl'>⛈️</span>
            </div>
            <h2
              className={`text-xl sm:text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'}`}
            >
              Welcome to StormChain!
            </h2>
            <p
              className={`text-sm sm:text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Let's get you set up. What brings you here?
            </p>
          </div>

          {/* Role Options */}
          <div className='p-4 sm:p-8 grid gap-4 sm:gap-6 md:grid-cols-3'>
            {/* Driver Option */}
            <button
              onClick={() => setSelectedRole('driver')}
              disabled={isLoading}
              className={`
                group relative p-4 sm:p-6 rounded-lg sm:rounded-xl transition-all duration-300 text-left
                ${
                  selectedRole === 'driver'
                    ? theme === 'dark'
                      ? 'bg-gradient-to-br from-brand-sage to-brand-sage-dark border-2 border-brand-mint shadow-lg shadow-brand-mint/50'
                      : 'bg-gradient-to-br from-brand-sage to-brand-sage-dark border-2 border-brand-sage shadow-lg shadow-brand-sage/50'
                    : theme === 'dark'
                      ? 'bg-brand-sage-light/10 border-2 border-brand-mint/30 hover:border-brand-mint hover:bg-brand-sage-light/20'
                      : 'bg-white border-2 border-brand-sage/30 hover:border-brand-sage hover:bg-brand-sage/5'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98] sm:hover:scale-[1.02]'}
              `}
            >
              {/* Icon */}
              <div
                className={`
                inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-lg mb-3 sm:mb-4
                ${
                  selectedRole === 'driver'
                    ? 'bg-white/20'
                    : theme === 'dark'
                      ? 'bg-brand-mint/20 group-hover:bg-brand-mint/30'
                      : 'bg-brand-sage/20 group-hover:bg-brand-sage/30'
                }
              `}
              >
                <span className='text-2xl sm:text-3xl'>🚗</span>
              </div>

              {/* Content */}
              <h3
                className={`text-lg sm:text-xl font-bold mb-1 sm:mb-2 ${selectedRole === 'driver' ? 'text-white' : theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'}`}
              >
                Driver
              </h3>
              <p
                className={`text-xs sm:text-sm mb-3 sm:mb-4 ${selectedRole === 'driver' ? 'text-brand-cream/90' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Build your verified DQ file
              </p>

              {/* Features */}
              <ul className='space-y-1.5 sm:space-y-2'>
                {['DOT applications', 'MVR & credentials', 'Career Card'].map(
                  (feature, idx) => (
                    <li
                      key={idx}
                      className='flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm'
                    >
                      <span
                        className={
                          selectedRole === 'driver'
                            ? 'text-brand-mint/90'
                            : theme === 'dark'
                              ? 'text-brand-mint'
                              : 'text-brand-sage'
                        }
                      >
                        ✓
                      </span>
                      <span
                        className={
                          selectedRole === 'driver'
                            ? 'text-white'
                            : theme === 'dark'
                              ? 'text-gray-300'
                              : 'text-gray-700'
                        }
                      >
                        {feature}
                      </span>
                    </li>
                  )
                )}
              </ul>

              {/* Selected Indicator */}
              {selectedRole === 'driver' && (
                <div className='absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center'>
                  <svg
                    className='w-4 h-4 sm:w-5 sm:h-5 text-brand-sage'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path
                      fillRule='evenodd'
                      d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
              )}
            </button>

            {/* Software Engineer Option */}
            <button
              onClick={() => setSelectedRole('developer')}
              disabled={isLoading}
              className={`
                group relative p-4 sm:p-6 rounded-lg sm:rounded-xl transition-all duration-300 text-left
                ${
                  selectedRole === 'developer'
                    ? theme === 'dark'
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-700 border-2 border-indigo-400 shadow-lg shadow-indigo-500/50'
                      : 'bg-gradient-to-br from-indigo-600 to-purple-700 border-2 border-indigo-500 shadow-lg shadow-indigo-500/50'
                    : theme === 'dark'
                      ? 'bg-brand-sage-light/10 border-2 border-brand-mint/30 hover:border-indigo-400 hover:bg-indigo-500/10'
                      : 'bg-white border-2 border-brand-sage/30 hover:border-indigo-500 hover:bg-indigo-50'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98] sm:hover:scale-[1.02]'}
              `}
            >
              {/* Icon */}
              <div
                className={`
                inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-lg mb-3 sm:mb-4
                ${
                  selectedRole === 'developer'
                    ? 'bg-white/20'
                    : theme === 'dark'
                      ? 'bg-indigo-500/20 group-hover:bg-indigo-500/30'
                      : 'bg-indigo-100 group-hover:bg-indigo-200'
                }
              `}
              >
                <span className='text-2xl sm:text-3xl'>💻</span>
              </div>

              {/* Content */}
              <h3
                className={`text-lg sm:text-xl font-bold mb-1 sm:mb-2 ${selectedRole === 'developer' ? 'text-white' : theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'}`}
              >
                Software Engineer
              </h3>
              <p
                className={`text-xs sm:text-sm mb-3 sm:mb-4 ${selectedRole === 'developer' ? 'text-white/90' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Showcase your work
              </p>

              {/* Features */}
              <ul className='space-y-1.5 sm:space-y-2'>
                {[
                  'Portfolio & GitHub',
                  'Verified work history',
                  'Career Card',
                ].map((feature, idx) => (
                  <li
                    key={idx}
                    className='flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm'
                  >
                    <span
                      className={
                        selectedRole === 'developer'
                          ? 'text-indigo-200'
                          : theme === 'dark'
                            ? 'text-indigo-400'
                            : 'text-indigo-600'
                      }
                    >
                      ✓
                    </span>
                    <span
                      className={
                        selectedRole === 'developer'
                          ? 'text-white'
                          : theme === 'dark'
                            ? 'text-gray-300'
                            : 'text-gray-700'
                      }
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Selected Indicator */}
              {selectedRole === 'developer' && (
                <div className='absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center'>
                  <svg
                    className='w-4 h-4 sm:w-5 sm:h-5 text-indigo-600'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path
                      fillRule='evenodd'
                      d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
              )}
            </button>

            {/* Employer Option */}
            <button
              onClick={() => setSelectedRole('employer')}
              disabled={isLoading}
              className={`
                group relative p-4 sm:p-6 rounded-lg sm:rounded-xl transition-all duration-300 text-left
                ${
                  selectedRole === 'employer'
                    ? theme === 'dark'
                      ? 'bg-gradient-to-br from-brand-mint to-teal-600 border-2 border-brand-mint shadow-lg shadow-brand-mint/50'
                      : 'bg-gradient-to-br from-brand-mint to-teal-600 border-2 border-brand-mint shadow-lg shadow-brand-mint/50'
                    : theme === 'dark'
                      ? 'bg-brand-sage-light/10 border-2 border-brand-mint/30 hover:border-brand-mint hover:bg-brand-sage-light/20'
                      : 'bg-white border-2 border-brand-sage/30 hover:border-brand-mint hover:bg-brand-mint/5'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98] sm:hover:scale-[1.02]'}
              `}
            >
              {/* Icon */}
              <div
                className={`
                inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-lg mb-3 sm:mb-4
                ${
                  selectedRole === 'employer'
                    ? 'bg-white/20'
                    : theme === 'dark'
                      ? 'bg-brand-mint/20 group-hover:bg-brand-mint/30'
                      : 'bg-brand-mint/20 group-hover:bg-brand-mint/30'
                }
              `}
              >
                <span className='text-2xl sm:text-3xl'>🏢</span>
              </div>

              {/* Content */}
              <h3
                className={`text-lg sm:text-xl font-bold mb-1 sm:mb-2 ${
                  selectedRole === 'employer'
                    ? 'text-white'
                    : theme === 'dark'
                      ? 'text-brand-cream'
                      : 'text-gray-900'
                }`}
              >
                Employer
              </h3>
              <p
                className={`text-xs sm:text-sm mb-3 sm:mb-4 ${
                  selectedRole === 'employer'
                    ? 'text-white/90'
                    : theme === 'dark'
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}
              >
                Hire verified talent
              </p>

              {/* Features */}
              <ul className='space-y-1.5 sm:space-y-2'>
                {[
                  'Post job openings',
                  'Review applicants',
                  'Manage pipeline',
                ].map((feature, idx) => (
                  <li
                    key={idx}
                    className='flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm'
                  >
                    <span
                      className={
                        selectedRole === 'employer'
                          ? 'text-white/80'
                          : theme === 'dark'
                            ? 'text-brand-mint'
                            : 'text-brand-mint'
                      }
                    >
                      ✓
                    </span>
                    <span
                      className={
                        selectedRole === 'employer'
                          ? 'text-white'
                          : theme === 'dark'
                            ? 'text-gray-300'
                            : 'text-gray-700'
                      }
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Selected Indicator */}
              {selectedRole === 'employer' && (
                <div className='absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center'>
                  <svg
                    className='w-4 h-4 sm:w-5 sm:h-5 text-brand-mint'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path
                      fillRule='evenodd'
                      d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
              )}
            </button>
          </div>

          {/* Employer Access Status - appears when employer is selected */}
          {selectedRole === 'employer' && (
            <div className={`mx-4 sm:mx-8 mb-4 p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 ${
              theme === 'dark'
                ? employerAccess?.hasAccess 
                  ? 'bg-green-900/20 border-green-500/40'
                  : 'bg-yellow-900/20 border-yellow-500/40'
                : employerAccess?.hasAccess
                  ? 'bg-green-50 border-green-300'
                  : 'bg-yellow-50 border-yellow-300'
            }`}>
              {/* Loading state */}
              {checkingAccess && (
                <div className='flex items-center gap-3'>
                  <Loader2 className={`w-5 h-5 animate-spin ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`} />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    Checking employer access...
                  </span>
                </div>
              )}

              {/* Email required */}
              {!checkingAccess && needsEmailForEmployer && (
                <div className='flex items-start gap-3'>
                  <AlertCircle className='w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0' />
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      Email required
                    </p>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      Please connect with an email address to access employer features.
                      Your email is used to verify company membership.
                    </p>
                  </div>
                </div>
              )}

              {/* Access granted */}
              {!checkingAccess && !needsEmailForEmployer && employerAccess?.hasAccess && (
                <div className='flex items-start gap-3'>
                  <CheckCircle className='w-5 h-5 text-green-500 mt-0.5 flex-shrink-0' />
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                      Access granted
                    </p>
                    {employerAccess.companyName && (
                      <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg ${
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      }`}>
                        <Building2 className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`} />
                        <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {employerAccess.companyName}
                        </span>
                        {employerAccess.accessType === 'owner' && (
                          <span className='text-xs px-2 py-0.5 rounded-full bg-brand-mint/20 text-brand-mint'>
                            Owner
                          </span>
                        )}
                        {employerAccess.accessType === 'team_invite' && (
                          <span className='text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400'>
                            Invited as {employerAccess.role}
                          </span>
                        )}
                        {employerAccess.accessType === 'team_member' && (
                          <span className='text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400'>
                            {employerAccess.role}
                          </span>
                        )}
                      </div>
                    )}
                    <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {employerAccess.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Access denied */}
              {!checkingAccess && !needsEmailForEmployer && employerAccess && !employerAccess.hasAccess && (
                <div className='flex items-start gap-3'>
                  <AlertCircle className='w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0' />
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      Invitation required
                    </p>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {employerAccess.message || 'Employer access requires an invitation from a company admin.'}
                    </p>
                    <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      If you are an employer, contact your company admin or reach out to{' '}
                      <a href='mailto:support@stormchain.com' className='text-brand-mint hover:underline'>
                        support@stormchain.com
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div
            className={`p-4 sm:p-8 pt-4 flex justify-center border-t ${theme === 'dark' ? 'border-brand-mint/30' : 'border-brand-sage/30'}`}
          >
            <button
              onClick={handleConfirm}
              disabled={!canProceed || isLoading}
              className={`
                w-full sm:w-auto px-6 sm:px-8 py-3 rounded-lg font-semibold text-base sm:text-lg transition-all duration-300
                ${
                  canProceed && !isLoading
                    ? selectedRole === 'driver'
                      ? 'bg-gradient-to-r from-brand-sage to-brand-sage-dark hover:from-brand-sage-dark hover:to-brand-sage text-white shadow-lg shadow-brand-sage/50 active:scale-[0.98] sm:hover:scale-105'
                      : selectedRole === 'developer'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/50 active:scale-[0.98] sm:hover:scale-105'
                        : 'bg-gradient-to-r from-brand-mint to-teal-600 hover:from-teal-600 hover:to-brand-mint text-white shadow-lg shadow-brand-mint/50 active:scale-[0.98] sm:hover:scale-105'
                    : theme === 'dark'
                      ? 'bg-brand-sage-light/20 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isLoading ? (
                <span className='flex items-center justify-center gap-2'>
                  <svg
                    className='animate-spin h-4 w-4 sm:h-5 sm:w-5'
                    viewBox='0 0 24 24'
                  >
                    <circle
                      className='opacity-25'
                      cx='12'
                      cy='12'
                      r='10'
                      stroke='currentColor'
                      strokeWidth='4'
                      fill='none'
                    />
                    <path
                      className='opacity-75'
                      fill='currentColor'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                    />
                  </svg>
                  Setting up...
                </span>
              ) : selectedRole ? (
                selectedRole === 'employer' && !canProceed
                  ? checkingAccess 
                    ? 'Checking access...'
                    : 'Invitation required'
                  : selectedRole === 'employer' && employerAccess?.accessType === 'team_invite'
                    ? `Join ${employerAccess.companyName || 'company'}`
                    : `Continue as ${selectedRole === 'driver' ? 'Driver' : selectedRole === 'developer' ? 'Software Engineer' : 'Employer'}`
              ) : (
                'Select a role to continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
