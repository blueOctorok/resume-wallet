'use client'

import { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, ChevronDown, RefreshCw, Car, Code, Building2, Sparkles, HelpCircle, MessageSquare, User, Home, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  navShellClass,
  navShellShapeClass,
  navHairlineTopClass,
  navControlButtonClass,
  navTextLinkClass,
  navStormiButtonClass,
  navHubGradientRingClass,
  navHubInnerButtonClass,
  navRowDividerClass,
  navDropdownPanelClass,
  navDropdownItemClass,
  navDropdownItemBorderClass,
  navStormPillClass,
} from '@/lib/navigation-styles'
import ThemeToggle from './ThemeToggle'
import StormChainWordmark from '@/components/ui/StormChainWordmark'
import StormTokenMark from '@/components/ui/StormTokenMark'
import Button from '@/components/ui/Button'
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
  const isDark = theme === 'dark'
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
    setIsMenuOpen(false)
    onNavigate?.(page)
  }

  return (
    <header
      className='sticky top-4 z-50 px-4 sm:px-6 pointer-events-none'
      style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
    >
      <nav className={navShellClass()}>
        <div className={navShellShapeClass(isDark)} aria-hidden />
        <div className={navHairlineTopClass()} aria-hidden />

        <div className='relative z-[2] px-4 sm:px-6 py-3 sm:py-4'>
          <div className='flex flex-col gap-3 sm:gap-3.5'>
            {/* Top Row: Logo and Controls */}
            <div className='flex items-center justify-between gap-3'>
              {/* Left side — Wallet (desktop) or Sign In */}
              <div className='hidden sm:flex flex-shrink-0 items-center gap-2'>
                {isAuthenticated ? (
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      onStatusClick?.()
                    }}
                    className={cn(
                      'relative group flex flex-col items-center space-y-1.5 p-2.5 cursor-pointer',
                      navControlButtonClass(isDark),
                    )}
                    aria-label='View account status'
                  >
                    <div className='w-2.5 h-2.5 rounded-full bg-teal-500 shadow-[0_0_10px_rgb(13_148_136/0.45)]' />
                    <span className='text-[11px] font-semibold uppercase tracking-wide'>Wallet</span>
                  </button>
                ) : (
                  <Button type='button' variant='primary' size='sm' onClick={() => handleNavigation('signin')}>
                    Sign in
                  </Button>
                )}
              </div>

              {/* Center — stacked Storm / StormTokenMark / Chain (matches LoadingScreen + whitepaper) */}
              <div className='flex-1 flex justify-center sm:-ml-6 lg:-ml-10 pointer-events-none'>
                <h1 className='pointer-events-none' aria-label='StormChain'>
                  <StormChainWordmark size='nav' />
                </h1>
              </div>

              {/* Right side — Desktop: Messages, Notifications, Stormi | Mobile: Hamburger only */}
              <div className='flex-shrink-0 flex items-center gap-2'>
                {/* Desktop-only controls */}
                {isAuthenticated && (
                  <button
                    type='button'
                    onClick={() => navigateToMessages()}
                    aria-label={`Messages${unreadMessageCount > 0 ? ` (${unreadMessageCount} unread)` : ''}`}
                    className={cn(
                      'hidden sm:flex relative items-center justify-center w-9 h-9 cursor-pointer',
                      navControlButtonClass(isDark),
                    )}
                  >
                    <MessageSquare className='w-4 h-4' />
                    {unreadMessageCount > 0 && (
                      <span
                        className={cn(
                          'absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full border-2',
                          isDark ? 'border-gray-950' : 'border-white',
                        )}
                      >
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
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onTClick?.()
                    }}
                    className={cn(
                      'hidden md:flex relative group items-center justify-center cursor-pointer',
                      navStormiButtonClass(isDark),
                      tHasUnread && 'animate-pulse',
                    )}
                    aria-label='Open Stormi assistant'
                  >
                    <span className='text-sm font-bold tracking-wide'>Stormi</span>
                    {tHasUnread && (
                      <span
                        className={cn(
                          'absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 shadow-lg',
                          isDark ? 'border-gray-950' : 'border-white',
                        )}
                      />
                    )}
                  </button>
                )}

                {/* Hamburger — mobile only */}
                <button
                  type='button'
                  onClick={toggleMenu}
                  className={cn('relative sm:hidden p-2.5 cursor-pointer', navControlButtonClass(isDark))}
                  aria-label='Toggle menu'
                >
                  {/* Badge dot when there are unread items */}
                  {isAuthenticated && (unreadMessageCount > 0 || notifications.some(n => !n.read)) && (
                    <span
                      className={cn(
                        'absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 z-10',
                        isDark ? 'border-gray-950' : 'border-white',
                      )}
                    />
                  )}
                  <div className='w-5 h-5 flex flex-col justify-center items-center gap-1'>
                    <div
                      className={cn(
                        'w-full h-0.5 transition-all duration-300',
                        isDark ? 'bg-gray-300' : 'bg-gray-700',
                        isMenuOpen && 'rotate-45 translate-y-1.5',
                      )}
                    />
                    <div
                      className={cn(
                        'w-full h-0.5 transition-all duration-300',
                        isDark ? 'bg-gray-300' : 'bg-gray-700',
                        isMenuOpen && 'opacity-0',
                      )}
                    />
                    <div
                      className={cn(
                        'w-full h-0.5 transition-all duration-300',
                        isDark ? 'bg-gray-300' : 'bg-gray-700',
                        isMenuOpen && '-rotate-45 -translate-y-1.5',
                      )}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Bottom Row: Navigation Links */}
            <div
              className={cn(
                isMenuOpen ? 'flex' : 'hidden',
                'sm:flex flex-col sm:flex-row items-center gap-2 sm:gap-2.5 pt-3 sm:pt-3.5 relative',
                navRowDividerClass(isDark),
              )}
            >
              {/* Mobile-only quick actions row */}
              {isAuthenticated && (
                <div
                  className={cn(
                    'sm:hidden w-full flex items-center justify-between gap-2 pb-2 border-b',
                    isDark ? 'border-gray-700/80' : 'border-gray-200/80',
                  )}
                >
                  {/* Wallet */}
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      onStatusClick?.()
                      setIsMenuOpen(false)
                    }}
                    className={cn('flex items-center gap-2 px-3 py-2', navControlButtonClass(isDark))}
                  >
                    <div className='w-2.5 h-2.5 rounded-full bg-teal-500 shadow-[0_0_8px_rgb(13_148_136/0.4)]' />
                    <span className='text-xs font-semibold'>Wallet</span>
                  </button>

                  {/* Messages */}
                  <button
                    type='button'
                    onClick={() => {
                      navigateToMessages()
                      setIsMenuOpen(false)
                    }}
                    className={cn('relative flex items-center gap-2 px-3 py-2', navControlButtonClass(isDark))}
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

              {/* Guest: browse like Indeed before wallet — hub stays dumb until connect */}
              {!isAuthenticated && (
                <div className='w-full sm:w-auto flex flex-wrap items-center justify-center gap-2'>
                  <button
                    type='button'
                    onClick={() => {
                      handleNavigation('home')
                      setIsMenuOpen(false)
                    }}
                    className={cn('flex items-center gap-2 px-4 py-2', navTextLinkClass(isDark))}
                  >
                    <Home className='w-4 h-4' />
                    Home
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      handleNavigation('jobs')
                      setIsMenuOpen(false)
                    }}
                    className={cn('flex items-center gap-2 px-4 py-2', navTextLinkClass(isDark, 'teal'))}
                  >
                    <Briefcase className='w-4 h-4' />
                    Browse jobs
                  </button>
                </div>
              )}

              {/* MVR Status Badge - Shows status without being a button */}
              {isAuthenticated && userRole === 'driver' && mvrWalletAddress && (
                <div className='w-full sm:w-auto flex justify-center sm:justify-start'>
                  <MvrStatusBadge walletAddress={mvrWalletAddress} />
                </div>
              )}

              {/* Mobile-only Stormi assistant access */}
              {isAuthenticated && onTClick && (
                <button
                  type='button'
                  onClick={() => {
                    onTClick()
                    setIsMenuOpen(false)
                  }}
                  className={cn(
                    'sm:hidden w-full px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer',
                    navStormiButtonClass(isDark),
                  )}
                >
                  <Sparkles className='w-4 h-4' />
                  <span>{tHasUnread ? 'Stormi has updates' : 'Chat with Stormi'}</span>
                  {tHasUnread && (
                    <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
                  )}
                </button>
              )}

              {/* Hub Button with Dropdown - Center position with gold rotating border */}
              {userRole && isAuthenticated && (
                <div
                  ref={hubDropdownRef}
                  className='relative z-[100] sm:absolute sm:left-1/2 sm:-translate-x-1/2 w-full sm:w-auto'
                >
                  <div className={navHubGradientRingClass()}>
                    <button
                      type='button'
                      onClick={() => setIsHubDropdownOpen(!isHubDropdownOpen)}
                      className={cn(navHubInnerButtonClass(), 'cursor-pointer')}
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
                    <div className={navDropdownPanelClass(isDark)}>
                      <button
                        type='button'
                        onClick={() => {
                          handleNavigation('hub')
                          setIsMenuOpen(false)
                          setIsHubDropdownOpen(false)
                        }}
                        className={navDropdownItemClass(isDark)}
                      >
                        <LayoutDashboard className='w-4 h-4' />
                        Go to Hub
                      </button>
                      {onSwitchRole && (
                        <button
                          type='button'
                          onClick={() => {
                            onSwitchRole()
                            setIsMenuOpen(false)
                            setIsHubDropdownOpen(false)
                          }}
                          className={cn(navDropdownItemClass(isDark), navDropdownItemBorderClass(isDark))}
                        >
                          <RefreshCw className='w-4 h-4' />
                          Switch Role
                        </button>
                      )}
                      {/* Journey Tips Toggle */}
                      <button
                        type='button'
                        onClick={() => setShowJourneyModals(!showJourneyModals)}
                        className={cn(
                          navDropdownItemClass(isDark),
                          navDropdownItemBorderClass(isDark),
                          'justify-between',
                        )}
                      >
                        <span className='flex items-center gap-3'>
                          <Sparkles className='w-4 h-4' />
                          Journey Tips
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            showJourneyModals
                              ? isDark
                                ? 'bg-teal-500/20 text-teal-400'
                                : 'bg-teal-100 text-teal-800'
                              : isDark
                                ? 'bg-gray-800 text-gray-400'
                                : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {showJourneyModals ? 'On' : 'Off'}
                        </span>
                      </button>
                      {/* Stormi journey help */}
                      <button
                        type='button'
                        onClick={() => {
                          openGuide()
                          setIsHubDropdownOpen(false)
                          setIsMenuOpen(false)
                        }}
                        className={cn(
                          navDropdownItemClass(isDark),
                          navDropdownItemBorderClass(isDark),
                          isDark ? 'text-teal-400' : 'text-teal-700',
                        )}
                      >
                        <HelpCircle className='w-4 h-4' />
                        <span>Stormi Journey Guide</span>
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
                    type='button'
                    onClick={() => handleNavigation('stormchain')}
                    className={cn(navStormPillClass(isDark))}
                    title='View StormChain tokens'
                  >
                    <StormTokenMark size='xs' className='scale-90' />
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
