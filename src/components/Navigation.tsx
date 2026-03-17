'use client'

import { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, Coins, ChevronDown, RefreshCw, Car, Code, Building2, Sparkles, HelpCircle, MessageSquare, User } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'
import { usePreferencesStore, useJourneyStore, useUIStore } from '@/stores'
import type { UserRole } from '@/stores/types'
import { useNotificationStore } from '@/stores/notification-store'
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
  userRole?: UserRole
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
  const { navigateToMessages } = useUIStore()
  const { notifications } = useNotificationStore()
  // Derive unread message count from existing notification store — no extra fetch needed
  const unreadMessageCount = notifications.filter(n => n.type === 'new_message' && !n.read).length

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

        <div className='relative px-4 sm:px-8 py-3 sm:py-6'>
          <div className='flex flex-col gap-3 sm:gap-4'>
            {/* Top Row: Logo and Controls */}
            <div className='flex items-center justify-between gap-3'>
              {/* Left side — Wallet (desktop) or Sign In */}
              <div className='hidden sm:flex flex-shrink-0 items-center gap-2'>
                {isAuthenticated ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onStatusClick?.()
                    }}
                    className={`relative group flex flex-col items-center space-y-1.5 p-2.5 rounded-xl backdrop-blur-sm transition-all duration-300 border cursor-pointer ${
                      theme === 'light'
                        ? 'bg-gray-100 border-gray-200 hover:bg-gray-200/80 text-gray-800'
                        : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-gray-200'
                    }`}
                    aria-label='View account status'
                  >
                    <div className='w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50' />
                    <span className='text-xs font-medium'>Wallet</span>
                  </button>
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

              {/* Center — Logo */}
              <div className='flex-1 flex justify-center sm:-ml-12'>
                <h1
                  className={`text-2xl sm:text-4xl lg:text-5xl font-extralight tracking-wide ${
                    theme === 'light'
                      ? 'text-gray-800 drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
                      : 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                  }`}
                >
                  StormChain
                </h1>
              </div>

              {/* Right side — Desktop: Messages, Notifications, AvA | Mobile: Hamburger only */}
              <div className='flex-shrink-0 flex items-center gap-2'>
                {/* Desktop-only controls */}
                {isAuthenticated && (
                  <button
                    onClick={() => navigateToMessages()}
                    aria-label={`Messages${unreadMessageCount > 0 ? ` (${unreadMessageCount} unread)` : ''}`}
                    className={`hidden sm:flex relative items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200 cursor-pointer ${
                      theme === 'light'
                        ? 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700'
                        : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-gray-300'
                    }`}
                  >
                    <MessageSquare className='w-4 h-4' />
                    {unreadMessageCount > 0 && (
                      <span className='absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full border-2 border-white'>
                        {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                      </span>
                    )}
                  </button>
                )}

                {isAuthenticated && walletAddress && (
                  <div className='hidden sm:block'>
                    <NotificationBell walletAddress={walletAddress} />
                  </div>
                )}

                {isAuthenticated && onTClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onTClick?.()
                    }}
                    className={`hidden md:flex relative group items-center justify-center px-4 py-2.5 rounded-2xl transition-all duration-300 border cursor-pointer ${
                      theme === 'light'
                        ? 'bg-indigo-500/20 text-indigo-700 border-indigo-300 hover:bg-indigo-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/30'
                    } ${tHasUnread ? 'animate-pulse' : ''}`}
                    aria-label='Open AvA Assistant'
                  >
                    <span className='text-sm font-bold tracking-wide'>AvA</span>
                    {tHasUnread && (
                      <span className='absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white shadow-lg' />
                    )}
                  </button>
                )}

                {/* Hamburger — mobile only */}
                <button
                  onClick={toggleMenu}
                  className={`relative sm:hidden p-2.5 rounded-xl backdrop-blur-sm transition-all duration-300 cursor-pointer ${
                    theme === 'light'
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      : 'bg-gray-600/50 hover:bg-gray-500/50 text-gray-200 border border-gray-500'
                  }`}
                  aria-label='Toggle menu'
                >
                  {/* Badge dot when there are unread items */}
                  {isAuthenticated && (unreadMessageCount > 0 || notifications.some(n => !n.read)) && (
                    <span className='absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-800 z-10' />
                  )}
                  <div className='w-5 h-5 flex flex-col justify-center items-center gap-1'>
                    <div className={`w-full h-0.5 ${theme === 'light' ? 'bg-gray-700' : 'bg-gray-300'} transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                    <div className={`w-full h-0.5 ${theme === 'light' ? 'bg-gray-700' : 'bg-gray-300'} transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`} />
                    <div className={`w-full h-0.5 ${theme === 'light' ? 'bg-gray-700' : 'bg-gray-300'} transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
                  </div>
                </button>
              </div>
            </div>

            {/* Bottom Row: Navigation Links */}
            <div
              className={`${
                isMenuOpen ? 'flex' : 'hidden'
              } sm:flex flex-col sm:flex-row items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t ${
                theme === 'light' ? 'border-gray-200' : 'border-gray-600'
              } relative`}
            >
              {/* Mobile-only quick actions row */}
              {isAuthenticated && (
                <div className='sm:hidden w-full flex items-center justify-between gap-2 pb-2 border-b border-gray-700/50'>
                  {/* Wallet */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onStatusClick?.()
                      setIsMenuOpen(false)
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      theme === 'light'
                        ? 'bg-gray-100 border-gray-200 text-gray-800'
                        : 'bg-gray-700/50 border-gray-600 text-gray-200'
                    }`}
                  >
                    <div className='w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse' />
                    <span className='text-xs font-medium'>Wallet</span>
                  </button>

                  {/* Messages */}
                  <button
                    onClick={() => {
                      navigateToMessages()
                      setIsMenuOpen(false)
                    }}
                    className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      theme === 'light'
                        ? 'bg-gray-100 border-gray-200 text-gray-700'
                        : 'bg-gray-700/50 border-gray-600 text-gray-300'
                    }`}
                  >
                    <MessageSquare className='w-4 h-4' />
                    <span className='text-xs font-medium'>Messages</span>
                    {unreadMessageCount > 0 && (
                      <span className='flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full'>
                        {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications */}
                  {walletAddress && (
                    <NotificationBell walletAddress={walletAddress} />
                  )}
                </div>
              )}

              {/* MVR Status Badge - Shows status without being a button */}
              {isAuthenticated && userRole === 'driver' && mvrWalletAddress && (
                <div className='w-full sm:w-auto flex justify-center sm:justify-start'>
                  <MvrStatusBadge walletAddress={mvrWalletAddress} />
                </div>
              )}

              {/* Mobile-only AvA Assistant access */}
              {isAuthenticated && onTClick && (
                <button
                  onClick={() => {
                    onTClick()
                    setIsMenuOpen(false)
                  }}
                  className={`sm:hidden w-full px-4 py-2.5 text-sm font-medium rounded-lg border transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    theme === 'light'
                      ? 'text-indigo-700 bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-300'
                      : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border-indigo-500/40'
                  }`}
                >
                  <Sparkles className='w-4 h-4' />
                  <span>{tHasUnread ? 'AvA has updates' : 'Chat with AvA'}</span>
                  {tHasUnread && (
                    <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
                  )}
                </button>
              )}

              {/* Hub Button with Dropdown - Center position with gold rotating border */}
              {userRole && isAuthenticated && (
                <div 
                  ref={hubDropdownRef}
                  className='relative sm:absolute sm:left-1/2 sm:-translate-x-1/2 w-full sm:w-auto'
                >
                  <div className='rotating-gold-border w-full sm:w-auto'>
                    {/* Single unified button - clicking opens dropdown */}
                    <button
                      onClick={() => setIsHubDropdownOpen(!isHubDropdownOpen)}
                      className='w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-[10px] flex items-center justify-center gap-2 relative z-10 cursor-pointer text-white bg-gray-800 hover:bg-gray-700 transition-colors'
                    >
                      {userRole === 'driver' && <Car className='w-4 h-4' />}
                      {userRole === 'employer' && <Building2 className='w-4 h-4' />}
                      {userRole === 'developer' && <Code className='w-4 h-4' />}
                      {userRole === 'candidate' && <User className='w-4 h-4' />}
                      {userRole === 'driver' && 'Driver Hub'}
                      {userRole === 'employer' && 'Employer Hub'}
                      {userRole === 'developer' && 'Developer Hub'}
                      {userRole === 'candidate' && 'My Hub'}
                      <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isHubDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Dropdown menu */}
                  {isHubDropdownOpen && (
                    <div className={`absolute top-full left-1/2 -translate-x-1/2 min-w-[200px] mt-2 rounded-xl shadow-xl border overflow-hidden z-50 ${
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
              <div className='w-full sm:w-auto flex items-center justify-end gap-3 sm:ml-auto'>
                {/* STORM token counter — all roles earn tokens */}
                {userRole && (
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
