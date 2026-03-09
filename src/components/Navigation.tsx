'use client'

import { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, Coins, ChevronDown, RefreshCw, Car, Code, Building2, Sparkles, HelpCircle } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'
import { usePreferencesStore, useJourneyStore } from '@/stores'
import MvrStatusBadge from './MvrStatusBadge'
import NotificationBell from './ui/NotificationBell'

// Define the navigation page type
type NavPage =
  | 'signin'
  | 'resume'
  | 'dotapp'
  | 'jobs'
  | 'applications'
  | 'home'
  | 'hub'
  | 'stormchain'

interface NavigationProps {
  isAuthenticated?: boolean
  userRole?: 'driver' | 'developer' | 'employer' | null
  onStatusClick?: () => void
  onNavigate?: (page: NavPage) => void
  mvrWalletAddress?: string | null
  walletAddress?: string | null
  tHasUnread?: boolean
  onTClick?: () => void
  /** StormChain token balance for drivers - shown in nav */
  stormTokens?: number
  /** Callback to switch user role */
  onSwitchRole?: () => void
}

export default function Navigation({
  isAuthenticated = false,
  userRole,
  onStatusClick,
  onNavigate,
  mvrWalletAddress,
  walletAddress,
  tHasUnread = false,
  onTClick,
  stormTokens = 0,
  onSwitchRole,
}: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isHubDropdownOpen, setIsHubDropdownOpen] = useState(false)
  const hubDropdownRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const { showJourneyModals, setShowJourneyModals } = usePreferencesStore()
  const { openGuide } = useJourneyStore()

  // Close hub dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hubDropdownRef.current && !hubDropdownRef.current.contains(event.target as Node)) {
        setIsHubDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleNavigation = (page: NavPage) => {
    console.log(`🔗 [NAVIGATION] handleNavigation called with page:`, page)
    setIsMenuOpen(false)
    onNavigate?.(page)
  }

  // Same surface as employment verification: bg-gray-800/50 (dark) / bg-white/70 (light)
  const navClasses =
    theme === 'light'
      ? 'max-w-2xl mx-auto bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200 relative'
      : 'max-w-2xl mx-auto bg-gray-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700 relative'

  const innerShadowClasses =
    theme === 'light'
      ? 'absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.06)] pointer-events-none'
      : 'absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.2)] pointer-events-none'

  const glowClasses =
    theme === 'light'
      ? 'absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-gray-400/10 to-transparent opacity-40 blur-sm -z-10'
      : 'absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-gray-500/20 to-transparent opacity-40 blur-sm -z-10'

  return (
    <header
      className='sticky top-4 z-50 px-4 sm:px-6 pointer-events-none'
      style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
    >
      <nav className={`${navClasses} pointer-events-auto`}>
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
                      className={`relative group flex flex-col items-center space-y-1 sm:space-y-1.5 p-2 sm:p-2.5 rounded-lg sm:rounded-xl backdrop-blur-sm transition-all duration-300 border cursor-pointer ${
                        theme === 'light'
                          ? 'bg-gray-100 border-gray-200 hover:bg-gray-200/80 text-gray-800'
                          : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-gray-200'
                      }`}
                      aria-label='View account status'
                    >
                      {/* Green dot */}
                      <div className='w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50' />

                      {/* "Wallet" text */}
                      <span className='text-[10px] sm:text-xs font-medium'>
                        Wallet
                      </span>

                      {/* Tooltip */}
                      <div className='absolute left-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
                        Click to view wallet
                      </div>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleNavigation('signin')}
                    className={`px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 cursor-pointer ${
                      theme === 'light'
                        ? 'text-white bg-indigo-600 hover:bg-indigo-700 border-indigo-600'
                        : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border-indigo-500/40'
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
                      ? 'text-gray-800 drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
                      : 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                  }`}
                >
                  StormChain
                </h1>
              </div>

              {/* AvA Assistant Indicator (Dynamic Island) and Theme Toggle - Right */}
              <div className='flex-shrink-0 flex justify-end items-center gap-2'>
                {/* Notification Bell */}
                {isAuthenticated && walletAddress && (
                  <NotificationBell walletAddress={walletAddress} />
                )}

                {/* AvA Assistant Dynamic Island */}
                {isAuthenticated && onTClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      if (onTClick) {
                        onTClick()
                      }
                    }}
                    className={`hidden md:flex relative group items-center justify-center px-4 py-2.5 rounded-2xl transition-all duration-300 border cursor-pointer ${
                      theme === 'light'
                        ? 'bg-indigo-500/20 text-indigo-700 border-indigo-300 hover:bg-indigo-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/30'
                    } ${tHasUnread ? 'animate-pulse' : ''}`}
                    aria-label='Open AvA Assistant'
                    type='button'
                    style={{ pointerEvents: 'auto', zIndex: 9999 }}
                  >
                    <span className='text-sm font-bold tracking-wide'>
                      AvA
                    </span>
                    {tHasUnread && (
                      <span className='absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white shadow-lg' />
                    )}
                    {/* Tooltip */}
                    <div className='absolute right-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50'>
                      {tHasUnread
                        ? 'AvA has a new message'
                        : 'Open AvA Assistant'}
                    </div>
                  </button>
                )}
                <button
                  onClick={toggleMenu}
                  className={`md:hidden p-2 sm:p-2.5 rounded-lg sm:rounded-xl backdrop-blur-sm transition-all duration-300 cursor-pointer ${
                    theme === 'light'
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      : 'bg-gray-600/50 hover:bg-gray-500/50 text-gray-200 border border-gray-500'
                  }`}
                  aria-label='Toggle menu'
                >
                  <div className='w-4 h-4 sm:w-5 sm:h-5 flex flex-col justify-center items-center gap-1'>
                    <div
                      className={`w-full h-0.5 ${theme === 'light' ? 'bg-gray-700' : 'bg-gray-300'} transition-all duration-300 ${
                        isMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                      }`}
                    />
                    <div
                      className={`w-full h-0.5 ${theme === 'light' ? 'bg-gray-700' : 'bg-gray-300'} transition-all duration-300 ${
                        isMenuOpen ? 'opacity-0' : ''
                      }`}
                    />
                    <div
                      className={`w-full h-0.5 ${theme === 'light' ? 'bg-gray-700' : 'bg-gray-300'} transition-all duration-300 ${
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
              } md:flex flex-col md:flex-row items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t ${
                theme === 'light' ? 'border-gray-200' : 'border-gray-600'
              } relative`}
            >
              {/* MVR Status Badge - Shows status without being a button */}
              {isAuthenticated && userRole === 'driver' && mvrWalletAddress && (
                <div className='w-full md:w-auto flex justify-center md:justify-start'>
                  <MvrStatusBadge walletAddress={mvrWalletAddress} />
                </div>
              )}

              {/* Mobile-only T Assistant access - Second on mobile */}
              {isAuthenticated && onTClick && (
                <button
                  onClick={() => {
                    onTClick()
                    setIsMenuOpen(false)
                  }}
                  className={`md:hidden w-full px-4 py-2 text-xs font-medium rounded-lg border transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                    theme === 'light'
                      ? 'text-indigo-700 bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-300'
                      : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border-indigo-500/40'
                  }`}
                >
                  <span className='text-sm'>🤖</span>
                  <span>
                    {tHasUnread ? 'AvA has updates' : 'Chat with AvA'}
                  </span>
                  {tHasUnread && (
                    <span className='ml-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse' />
                  )}
                </button>
              )}

              {/* Hub Button with Dropdown - Center position with gold rotating border */}
              {userRole && isAuthenticated && (
                <div 
                  ref={hubDropdownRef}
                  className='relative md:absolute md:left-1/2 md:-translate-x-1/2 w-full md:w-auto'
                >
                  <div className='rotating-gold-border w-full md:w-auto'>
                    {/* Single unified button - clicking opens dropdown */}
                    <button
                      onClick={() => setIsHubDropdownOpen(!isHubDropdownOpen)}
                      className='w-full md:w-auto px-5 py-2.5 text-sm font-semibold rounded-[10px] flex items-center justify-center gap-2 relative z-10 cursor-pointer text-white bg-gray-800 hover:bg-gray-700 transition-colors'
                    >
                      {userRole === 'driver' && <Car className='w-4 h-4' />}
                      {userRole === 'employer' && <Building2 className='w-4 h-4' />}
                      {userRole === 'developer' && <Code className='w-4 h-4' />}
                      {userRole === 'driver' && 'Driver Hub'}
                      {userRole === 'employer' && 'Employer Hub'}
                      {userRole === 'developer' && 'Developer Hub'}
                      <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isHubDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Dropdown menu */}
                  {isHubDropdownOpen && (
                    <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-xl border overflow-hidden z-50 ${
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700'
                        : 'bg-white border-gray-200'
                    }`}>
                      <button
                        onClick={() => {
                          handleNavigation('hub')
                          setIsMenuOpen(false)
                          setIsHubDropdownOpen(false)
                        }}
                        className={`w-full px-4 py-3 text-sm font-medium flex items-center gap-3 transition-colors ${
                          theme === 'dark'
                            ? 'text-white hover:bg-gray-800'
                            : 'text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <LayoutDashboard className='w-4 h-4' />
                        Go to Hub
                      </button>
                      {onSwitchRole && (
                        <button
                          onClick={() => {
                            onSwitchRole()
                            setIsMenuOpen(false)
                            setIsHubDropdownOpen(false)
                          }}
                          className={`w-full px-4 py-3 text-sm font-medium flex items-center gap-3 border-t transition-colors ${
                            theme === 'dark'
                              ? 'text-gray-300 hover:bg-gray-800 border-gray-700'
                              : 'text-gray-700 hover:bg-gray-50 border-gray-100'
                          }`}
                        >
                          <RefreshCw className='w-4 h-4' />
                          Switch Role
                        </button>
                      )}
                      {/* Journey Tips Toggle */}
                      <button
                        onClick={() => setShowJourneyModals(!showJourneyModals)}
                        className={`w-full px-4 py-3 text-sm font-medium flex items-center justify-between border-t transition-colors ${
                          theme === 'dark'
                            ? 'text-gray-300 hover:bg-gray-800 border-gray-700'
                            : 'text-gray-700 hover:bg-gray-50 border-gray-100'
                        }`}
                      >
                        <span className='flex items-center gap-3'>
                          <Sparkles className='w-4 h-4' />
                          Journey Tips
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          showJourneyModals
                            ? theme === 'dark' ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
                            : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {showJourneyModals ? 'On' : 'Off'}
                        </span>
                      </button>
                      {/* AvA Help Button */}
                      <button
                        onClick={() => {
                          openGuide()
                          setIsHubDropdownOpen(false)
                          setIsMenuOpen(false)
                        }}
                        className={`w-full px-4 py-3 text-sm font-medium flex items-center gap-3 border-t transition-colors ${
                          theme === 'dark'
                            ? 'text-teal-400 hover:bg-gray-800 border-gray-700'
                            : 'text-teal-600 hover:bg-gray-50 border-gray-100'
                        }`}
                      >
                        <HelpCircle className='w-4 h-4' />
                        <span>AvA Journey Guide</span>
                        <span className='ml-auto text-xs opacity-60'>?</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* StormChain Token Counter & Theme Toggle - Bottom Right */}
              <div className='w-full md:w-auto flex items-center justify-end gap-3 md:ml-auto'>
                {/* Show Token counter for drivers and developers - employers don't earn tokens */}
                {(userRole === 'driver' || userRole === 'developer') && (
                  <button
                    onClick={() => handleNavigation('stormchain')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 cursor-pointer ${
                      theme === 'light'
                        ? 'text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-200'
                        : 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30'
                    }`}
                    title='View StormChain tokens'
                  >
                    <Coins className='w-3.5 h-3.5' />
                    <span className='font-mono'>
                      {stormTokens.toLocaleString()}
                    </span>
                    <span className='hidden sm:inline text-[10px] opacity-70'>
                      STORM
                    </span>
                  </button>
                )}
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
