'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

// Common personal email domains - Employer requires company email
const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'live.com',
  'msn.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'tutanota.com',
]

// Whitelisted wallet addresses that bypass personal email restriction (e.g., admins)
const EMPLOYER_WHITELIST_WALLETS = [
  '0x9499cD25C6737A8195e74262f3c5eAE6dA607df3', // Main admin account
].map(w => w.toLowerCase())

function isPersonalEmail(email?: string, walletAddress?: string): boolean {
  // Check whitelist first - case-insensitive wallet comparison
  if (walletAddress && EMPLOYER_WHITELIST_WALLETS.includes(walletAddress.toLowerCase())) {
    return false // Whitelisted, allow employer access
  }
  if (!email) return true // No email = treat as personal
  const domain = email.split('@')[1]?.toLowerCase()
  return PERSONAL_EMAIL_DOMAINS.includes(domain)
}

interface RoleSelectionModalProps {
  onSelectRole: (role: 'driver' | 'developer' | 'employer', companyName?: string, dotNumber?: string) => void
  isLoading?: boolean
  userEmail?: string // Used to gate Employer option
  walletAddress?: string // Used for whitelist check
}

export default function RoleSelectionModal({
  onSelectRole,
  isLoading,
  userEmail,
  walletAddress,
}: RoleSelectionModalProps) {
  const { theme } = useTheme()
  const [selectedRole, setSelectedRole] = useState<
    'driver' | 'developer' | 'employer' | null
  >(null)
  // Company info for employer signup (prevents orphan "My Company" records)
  const [companyName, setCompanyName] = useState('')
  const [dotNumber, setDotNumber] = useState('')

  // Check if user can select Employer (requires company email or whitelisted wallet)
  const isEmployerDisabled = isPersonalEmail(userEmail, walletAddress)
  
  // Employer needs company name to proceed
  const canProceed = selectedRole && (selectedRole !== 'employer' || companyName.trim().length >= 2)

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
        onSelectRole(selectedRole, companyName.trim(), dotNumber.trim() || undefined)
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
              onClick={() => !isEmployerDisabled && setSelectedRole('employer')}
              disabled={isLoading || isEmployerDisabled}
              className={`
                group relative p-4 sm:p-6 rounded-lg sm:rounded-xl transition-all duration-300 text-left
                ${
                  isEmployerDisabled
                    ? theme === 'dark'
                      ? 'bg-gray-800/50 border-2 border-gray-700 cursor-not-allowed opacity-60'
                      : 'bg-gray-100 border-2 border-gray-300 cursor-not-allowed opacity-60'
                    : selectedRole === 'employer'
                      ? theme === 'dark'
                        ? 'bg-gradient-to-br from-brand-mint to-teal-600 border-2 border-brand-mint shadow-lg shadow-brand-mint/50'
                        : 'bg-gradient-to-br from-brand-mint to-teal-600 border-2 border-brand-mint shadow-lg shadow-brand-mint/50'
                      : theme === 'dark'
                        ? 'bg-brand-sage-light/10 border-2 border-brand-mint/30 hover:border-brand-mint hover:bg-brand-sage-light/20'
                        : 'bg-white border-2 border-brand-sage/30 hover:border-brand-mint hover:bg-brand-mint/5'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : !isEmployerDisabled ? 'cursor-pointer active:scale-[0.98] sm:hover:scale-[1.02]' : ''}
              `}
            >
              {/* Icon */}
              <div
                className={`
                inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-lg mb-3 sm:mb-4
                ${
                  isEmployerDisabled
                    ? theme === 'dark'
                      ? 'bg-gray-700'
                      : 'bg-gray-200'
                    : selectedRole === 'employer'
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
                  isEmployerDisabled
                    ? theme === 'dark'
                      ? 'text-gray-500'
                      : 'text-gray-400'
                    : selectedRole === 'employer'
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
                  isEmployerDisabled
                    ? theme === 'dark'
                      ? 'text-gray-600'
                      : 'text-gray-400'
                    : selectedRole === 'employer'
                      ? 'text-white/90'
                      : theme === 'dark'
                        ? 'text-gray-400'
                        : 'text-gray-600'
                }`}
              >
                {isEmployerDisabled
                  ? 'Requires company email'
                  : 'Hire verified talent'}
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
                        isEmployerDisabled
                          ? theme === 'dark'
                            ? 'text-gray-600'
                            : 'text-gray-400'
                          : selectedRole === 'employer'
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
                        isEmployerDisabled
                          ? theme === 'dark'
                            ? 'text-gray-600'
                            : 'text-gray-400'
                          : selectedRole === 'employer'
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
              {selectedRole === 'employer' && !isEmployerDisabled && (
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

              {/* Disabled overlay badge */}
              {isEmployerDisabled && (
                <div
                  className={`absolute top-3 right-3 sm:top-4 sm:right-4 px-2 py-1 rounded text-[10px] sm:text-xs font-medium ${
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-400'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  Company email only
                </div>
              )}
            </button>
          </div>

          {/* Employer Company Info - appears when employer is selected */}
          {selectedRole === 'employer' && !isEmployerDisabled && (
            <div className={`mx-4 sm:mx-8 mb-4 p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 ${
              theme === 'dark'
                ? 'bg-brand-mint/10 border-brand-mint/40'
                : 'bg-brand-mint/5 border-brand-mint/30'
            }`}>
              <h3 className={`text-base sm:text-lg font-semibold mb-3 ${
                theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'
              }`}>
                Tell us about your company
              </h3>
              
              <div className='space-y-3'>
                {/* Company Name - Required */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Company Name <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='text'
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder='e.g. PACE Drivers LLC'
                    className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-mint'
                    } focus:outline-none focus:ring-2 focus:ring-brand-mint/30`}
                    disabled={isLoading}
                  />
                </div>

                {/* DOT Number - Optional */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    DOT Number <span className='text-gray-400 font-normal'>(optional)</span>
                  </label>
                  <input
                    type='text'
                    value={dotNumber}
                    onChange={(e) => setDotNumber(e.target.value)}
                    placeholder='e.g. 1234567'
                    className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-mint'
                    } focus:outline-none focus:ring-2 focus:ring-brand-mint/30`}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <p className={`mt-3 text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                You can add more details later in your company profile.
              </p>
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
                selectedRole === 'employer' && !companyName.trim() 
                  ? 'Enter company name to continue'
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
