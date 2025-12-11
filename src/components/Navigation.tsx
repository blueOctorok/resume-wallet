'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Home } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'

// Dynamically import MVR payment button to avoid auth conflicts
const MvrPaymentButton = dynamic(() => import('./MvrPaymentButton'), {
  ssr: false,
})


interface NavigationProps {
  isAuthenticated?: boolean
  user?: {
    address: string
    message?: string
    signature?: string
    method?: string
  } | null
  userRole?: 'driver' | 'employer' | null
  onStatusClick?: () => void
  onWalletClick?: () => void
  onNavigate?: (page: 'signin' | 'resume' | 'dotapp' | 'jobs' | 'applications' | 'home') => void
  onMvrClick?: () => void
  tHasUnread?: boolean
  onTClick?: () => void
  onSwitchRole?: () => void
}

export default function Navigation({
  isAuthenticated = false,
  user,
  userRole,
  onStatusClick,
  onWalletClick,
  onNavigate,
  onSwitchRole,
  onMvrClick,
  tHasUnread = false,
  onTClick,
}: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDriverDropdownOpen, setIsDriverDropdownOpen] = useState(false)
  const [isEmployerDropdownOpen, setIsEmployerDropdownOpen] = useState(false)
  const { theme } = useTheme()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleNavigation = (page: 'signin' | 'resume' | 'dotapp' | 'jobs' | 'applications' | 'home') => {
    console.log(`🔗 [NAVIGATION] handleNavigation called with page:`, page)
    setIsMenuOpen(false)
    onNavigate?.(page)
  }

  // Theme-aware classes
  const navClasses =
    theme === 'light'
      ? 'max-w-2xl mx-auto bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-sage/40 relative'
      : 'max-w-2xl mx-auto bg-brand-sage-light/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-mint/30 relative'

  const innerShadowClasses =
    theme === 'light'
      ? 'absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.1)] pointer-events-none'
      : 'absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] pointer-events-none'

  const glowClasses =
    theme === 'light'
      ? 'absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-sage/20 to-transparent opacity-50 blur-sm -z-10'
      : 'absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-mint/20 to-transparent opacity-50 blur-sm -z-10'

  return (
    <header className='sticky top-4 z-50 px-4 sm:px-6'>
      <nav className={navClasses}>
        {/* Extra depth layer - inner shadow */}
        <div className={innerShadowClasses} />

        {/* Outer glow effect */}
        <div className={glowClasses} />

        <div className='relative px-4 sm:px-8 py-4 sm:py-6'>
          <div className='flex flex-col gap-3 sm:gap-4'>
            {/* Top Row: Logo and Status */}
            <div className='flex items-center justify-between gap-2 sm:gap-4'>
              {/* User Status Indicator and Home Button - Left */}
              <div className='flex-shrink-0 flex items-center gap-1.5 sm:gap-2'>
                {isAuthenticated ? (
                  <>
                    {/* Logged In Status Button with Elevated Glowing Effect */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onStatusClick?.()
                      }}
                      className='relative group flex flex-col items-center space-y-1 sm:space-y-1.5 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-brand-sage/90 backdrop-blur-sm hover:bg-brand-sage/95 hover:border-brand-mint/70 transition-all duration-300 border-2 border-white/30'
                      aria-label='View account status'
                      style={{
                        boxShadow: '0 0 20px rgba(255, 255, 255, 0.25), 0 0 40px rgba(255, 255, 255, 0.15), 0 0 60px rgba(255, 255, 255, 0.05), inset 0 0 15px rgba(255, 255, 255, 0.1), 0 4px 12px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.15)'
                      }}
                    >
                      {/* Blinking green dot */}
                      <div className='w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50' />

                      {/* "Logged in" text */}
                      <span className='text-[10px] sm:text-xs text-brand-cream/90 font-medium'>
                        Logged in
                      </span>

                      {/* Tooltip */}
                      <div className='absolute left-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
                        Click to view account
                      </div>
                    </button>

                    {/* Home Icon Button */}
                    <button
                      onClick={() => handleNavigation('home')}
                      className={`relative group p-2 sm:p-2.5 rounded-lg sm:rounded-xl backdrop-blur-sm transition-all duration-300 shadow-lg hover:shadow-xl border ${
                        theme === 'light'
                          ? 'bg-brand-sage/60 hover:bg-brand-sage/80 border-brand-sage/40 hover:border-brand-mint/70 text-white'
                          : 'bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-mint/30 hover:border-brand-mint/50 text-brand-cream'
                      }`}
                      aria-label='Go to home'
                    >
                      <Home className='w-4 h-4 sm:w-5 sm:h-5' strokeWidth={2} />
                      
                      {/* Tooltip */}
                      <div className='absolute left-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
                        Home
                      </div>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleNavigation('signin')}
                    className={`px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 ${
                      theme === 'light'
                        ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark'
                        : 'text-brand-cream bg-brand-mint/20 hover:bg-brand-mint/30 border-brand-mint/40 hover:border-brand-mint/60'
                    }`}
                  >
                    Sign In
                  </button>
                )}
              </div>

              {/* Logo - Slightly Left of Center */}
              <div className='flex-1 flex justify-center min-w-0 -ml-0 sm:-ml-12'>
                <h1
                  className={`text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-wide ${
                    theme === 'light'
                      ? 'text-gray-800 drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                      : 'text-brand-cream drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                  }`}
                >
                  Veree
                </h1>
              </div>

              {/* AvA Assistant Indicator (Dynamic Island) and Theme Toggle - Right */}
              <div className='flex-shrink-0 flex justify-end items-center gap-2'>
                {/* AvA Assistant Dynamic Island */}
                {isAuthenticated && onTClick && (
                  <button
                    onClick={onTClick}
                    className={`hidden md:flex relative group items-center justify-center p-2 rounded-full transition-all duration-300 ${
                      theme === 'light'
                        ? 'bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 border border-brand-sage/40'
                        : 'bg-brand-sage-light/20 backdrop-blur-sm hover:bg-brand-sage-light/30 border border-brand-mint/30'
                    } ${tHasUnread ? 'animate-pulse' : ''}`}
                    aria-label='Open AvA Assistant'
                  >
                    <span className={`text-sm font-semibold ${theme === 'light' ? 'text-white' : 'text-brand-mint'}`}>
                      AvA
                    </span>
                    {tHasUnread && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white" />
                    )}
                    {/* Tooltip */}
                    <div className='absolute right-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
                      {tHasUnread ? 'AvA has a new message' : 'Open AvA Assistant'}
                    </div>
                  </button>
                )}
                <button
                  onClick={toggleMenu}
                  className='md:hidden p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 hover:border-brand-mint/70 transition-all duration-300 shadow-lg hover:shadow-xl'
                  aria-label='Toggle menu'
                >
                  <div className='w-4 h-4 sm:w-5 sm:h-5 flex flex-col justify-center items-center gap-1'>
                    <div
                      className={`w-full h-0.5 bg-white transition-all duration-300 ${
                        isMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                      }`}
                    />
                    <div
                      className={`w-full h-0.5 bg-white transition-all duration-300 ${
                        isMenuOpen ? 'opacity-0' : ''
                      }`}
                    />
                    <div
                      className={`w-full h-0.5 bg-white transition-all duration-300 ${
                        isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
                      }`}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Bottom Row: Navigation Links */}
            <div
              className={`${
                isMenuOpen ? 'flex' : 'hidden'
              } md:flex flex-col md:flex-row items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-brand-mint/30 relative`}
            >
              {/* Driver Options Dropdown - Perfectly Centered in bottom row */}
              {userRole === 'driver' && isAuthenticated && (
                <div className="relative md:absolute md:left-1/2 md:-translate-x-1/2 w-full md:w-auto">
                  {theme === 'dark' ? (
                    <div className="rotating-gold-border w-full md:w-auto">
                      <button
                        onClick={() => {
                          setIsDriverDropdownOpen(!isDriverDropdownOpen)
                          setIsEmployerDropdownOpen(false)
                        }}
                        className="w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-[10px] text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 transition-all duration-300 flex items-center justify-center gap-2 relative z-10"
                      >
                        Driver Options
                        <svg 
                          className={`w-4 h-4 transition-transform ${isDriverDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="rotating-gold-border w-full md:w-auto">
                      <button
                        onClick={() => {
                          setIsDriverDropdownOpen(!isDriverDropdownOpen)
                          setIsEmployerDropdownOpen(false)
                        }}
                        className="w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-[10px] text-white bg-brand-sage hover:bg-brand-sage-dark transition-all duration-300 flex items-center justify-center gap-2 relative z-10 shadow-lg hover:shadow-xl hover:scale-105"
                      >
                        Driver Options
                        <svg 
                          className={`w-4 h-4 transition-transform ${isDriverDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  )}
                  
                  {isDriverDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsDriverDropdownOpen(false)}
                      />
                      <div className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 z-20 w-[180px] rounded-xl shadow-2xl border ${
                        theme === 'light'
                          ? 'bg-white border-brand-sage/40'
                          : 'bg-gray-800/95 border-gray-700'
                      }`}>
                        <div className="p-2 space-y-1">
                          <button
                            onClick={() => {
                              handleNavigation('resume')
                              setIsDriverDropdownOpen(false)
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                              theme === 'light'
                                ? 'text-gray-700 hover:bg-brand-sage/10 hover:text-brand-sage'
                                : 'text-brand-cream hover:bg-brand-sage-light/20'
                            }`}
                          >
                            📄 Resume
                          </button>
                          <button
                            onClick={() => {
                              handleNavigation('jobs')
                              setIsDriverDropdownOpen(false)
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                              theme === 'light'
                                ? 'text-gray-700 hover:bg-brand-sage/10 hover:text-brand-sage'
                                : 'text-brand-cream hover:bg-brand-sage-light/20'
                            }`}
                          >
                            🔍 Browse Jobs
                          </button>
                          <button
                            onClick={() => {
                              handleNavigation('applications')
                              setIsDriverDropdownOpen(false)
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                              theme === 'light'
                                ? 'text-gray-700 hover:bg-brand-sage/10 hover:text-brand-sage'
                                : 'text-brand-cream hover:bg-brand-sage-light/20'
                            }`}
                          >
                            📋 My Applications
                          </button>
                          <button
                            onClick={() => {
                              handleNavigation('dotapp')
                              setIsDriverDropdownOpen(false)
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                              theme === 'light'
                                ? 'text-gray-700 hover:bg-brand-sage/10 hover:text-brand-sage'
                                : 'text-brand-cream hover:bg-brand-sage-light/20'
                            }`}
                          >
                            📝 DOT App
                          </button>
                          {onMvrClick && (
                            <button
                              onClick={() => {
                                onMvrClick()
                                setIsDriverDropdownOpen(false)
                              }}
                              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                theme === 'light'
                                  ? 'text-gray-700 hover:bg-brand-sage/10 hover:text-brand-sage'
                                  : 'text-brand-cream hover:bg-brand-sage-light/20'
                              }`}
                            >
                              🚗 Order MVR
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Employer Options Dropdown */}
              {userRole === 'employer' && isAuthenticated && (
                <div className="relative">
                  {theme === 'dark' ? (
                    <div className="rotating-gold-border w-full md:w-auto">
                      <button
                        onClick={() => {
                          setIsEmployerDropdownOpen(!isEmployerDropdownOpen)
                          setIsDriverDropdownOpen(false)
                        }}
                        className="w-full px-6 py-2.5 text-sm font-semibold rounded-[10px] text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 transition-all duration-300 flex items-center gap-2 relative z-10"
                      >
                        Employer Options
                        <svg 
                          className={`w-4 h-4 transition-transform ${isEmployerDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsEmployerDropdownOpen(!isEmployerDropdownOpen)
                        setIsDriverDropdownOpen(false)
                      }}
                      className="w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 flex items-center gap-2 text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105"
                    >
                      Employer Options
                      <svg 
                        className={`w-4 h-4 transition-transform ${isEmployerDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  
                  {isEmployerDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsEmployerDropdownOpen(false)}
                      />
                      <div className={`absolute top-full mt-2 left-0 z-20 min-w-[200px] rounded-xl shadow-2xl border ${
                        theme === 'light'
                          ? 'bg-white border-brand-sage/40'
                          : 'bg-gray-800/95 border-gray-700'
                      }`}>
                        <div className="p-2">
                          <div className={`px-4 py-2.5 text-sm ${
                            theme === 'light' ? 'text-gray-500' : 'text-brand-cream/60'
                          }`}>
                            🚧 Coming soon
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Mobile-only T Assistant access - Below Driver Options */}
              {isAuthenticated && onTClick && (
                <button
                  onClick={() => {
                    onTClick()
                    setIsMenuOpen(false)
                  }}
                  className={`md:hidden w-full px-4 py-2 text-xs font-medium rounded-lg border transition-all duration-300 flex items-center justify-center gap-1.5 ${
                    theme === 'light'
                      ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105'
                      : 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105'
                  }`}
                >
                  <span className='text-sm'>🤖</span>
                  <span>{tHasUnread ? 'AvA has updates' : 'Chat with AvA'}</span>
                  {tHasUnread && (
                    <span className='ml-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse' />
                  )}
                </button>
              )}

              {/* Theme Toggle - Bottom Right */}
              <div className='w-full md:w-auto flex justify-end md:ml-auto'>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
