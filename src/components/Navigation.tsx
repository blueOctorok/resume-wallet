'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard,
  ChevronDown,
  RefreshCw,
  Car,
  Code,
  Building2,
  Sparkles,
  HelpCircle,
  MessageSquare,
  User,
  Home,
  Briefcase,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  navControlButtonClass,
  navTextLinkClass,
  navStormiButtonClass,
  navHubGradientRingClass,
  navHubInnerButtonClass,
  navHubRefreshInnerButtonClass,
  navRowDividerClass,
  navDropdownPanelClass,
  navDropdownItemClass,
  navDropdownItemBorderClass,
  navStormPillClass,
} from '@/lib/navigation-styles'
import ThemePicker from './ThemePicker'
import StormChainWordmark from '@/components/ui/StormChainWordmark'
import NavVaultShell from '@/components/ui/NavVaultShell'
import StormTokenMark from '@/components/ui/StormTokenMark'
import Button from '@/components/ui/Button'
import { useTheme } from '@/contexts/ThemeContext'
import { usePreferencesStore, useJourneyStore, useUIStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import type { UserRole } from '@/stores/types'
import { useNotificationStore } from '@/stores/notification-store'
import MvrStatusBadge from './MvrStatusBadge'
import NotificationBell from './ui/NotificationBell'
import ModeToggle from './ui/ModeToggle'
import { useStormTokenBalance } from '@/hooks/use-storm-token-balance'

// Define the navigation page type
//
// 'jobs' is no longer a navigable target from this component — guests use
// `onBrowseGuided` instead, which flips the page-level guided-mode flag and
// renders `SimpleModeShell`. The string lingers in `PageType` for legacy
// shells (see `CandidateShell`'s redirect effect).
type NavPage =
  | 'signin'
  | 'resume'
  | 'dotapp'
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
  /** Callback to switch user role */
  onSwitchRole?: () => void
  /**
   * Guests' "Browse jobs" button calls this instead of navigating to a route.
   * page.tsx flips a `showGuidedMode` flag and renders `SimpleModeShell` for
   * unauthenticated users — this is the Indeed-style lazy-auth entry point.
   */
  onBrowseGuided?: () => void
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
  onSwitchRole,
  onBrowseGuided,
}: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isHubDropdownOpen, setIsHubDropdownOpen] = useState(false)
  const hubDropdownRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const showJourneyModals = usePreferencesStore((s) => s.showJourneyModals)
  const setShowJourneyModals = usePreferencesStore((s) => s.setShowJourneyModals)
  const walkthroughDismissed = useHubBlocksStore((s) => s.walkthroughDismissed)
  const setWalkthroughDismissed = useHubBlocksStore((s) => s.setWalkthroughDismissed)
  const requestWalkthrough = useJourneyStore((s) => s.requestWalkthrough)
  const { navigateToMessages, requestHubRefresh } = useUIStore()
  const hubBlocksLoading = useHubBlocksStore((s) => s.isLoading)
  const { notifications } = useNotificationStore()
  const isDark = isDarkTheme(theme)
  const isPaperLight = !isDark && theme === 'paper'
  // Derive unread message count from existing notification store — no extra fetch needed
  const unreadMessageCount = notifications.filter(n => n.type === 'new_message' && !n.read).length

  // STORM pill only renders when userRole is set; fetch balance for that smart-account address only.
  const { display: stormBalanceDisplay, loading: stormBalanceLoading } = useStormTokenBalance(
    userRole ? walletAddress ?? null : null,
  )

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
      className='sticky top-4 z-50 px-3 sm:px-5 pointer-events-none'
      style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
    >
      <NavVaultShell isDark={isDark}>
        <nav className='relative flex w-full flex-col gap-3 sm:gap-3.5' aria-label='Main navigation'>
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
                      navControlButtonClass(isDark, theme),
                    )}
                    aria-label='View account status'
                  >
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        isPaperLight
                          ? 'bg-zinc-500 shadow-[0_0_10px_rgb(63_63_70/0.35)]'
                          : 'bg-teal-500 shadow-[0_0_10px_rgb(13_148_136/0.45)]',
                      )}
                    />
                    <span className='text-[11px] font-semibold uppercase tracking-wide'>Wallet</span>
                  </button>
                ) : (
                  <Button type='button' variant='primary' size='sm' onClick={() => handleNavigation('signin')}>
                    Sign in
                  </Button>
                )}
              </div>

              {/* Center — stacked Storm / StormTokenMark / Chain (matches LoadingScreen + whitepaper) */}
              <div className='pointer-events-none flex flex-1 justify-center py-1 sm:-ml-6 sm:py-1.5 lg:-ml-10'>
                <h1 className='pointer-events-none' aria-label='Storm'>
                  <StormChainWordmark size='nav' vaultChrome={false} />
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
                      navControlButtonClass(isDark, theme),
                    )}
                  >
                    <MessageSquare className='w-4 h-4' />
                    {unreadMessageCount > 0 && (
                      <span
                        className={cn(
                          'absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full border-2',
                          isPaperLight ? 'bg-zinc-700' : 'bg-blue-500',
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
                      navStormiButtonClass(isDark, theme),
                      tHasUnread && 'animate-pulse',
                    )}
                    aria-label='Open Stormi assistant'
                  >
                    <span className='text-sm font-bold tracking-wide'>Stormi</span>
                    {tHasUnread && (
                      <span
                        className={cn(
                          'absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse border-2 shadow-lg',
                          isPaperLight ? 'bg-zinc-700' : 'bg-red-500',
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
                  className={cn('relative sm:hidden p-2.5 cursor-pointer', navControlButtonClass(isDark, theme))}
                  aria-label='Toggle menu'
                >
                  {/* Badge dot when there are unread items */}
                  {isAuthenticated && (unreadMessageCount > 0 || notifications.some(n => !n.read)) && (
                    <span
                      className={cn(
                        'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 z-10',
                        isPaperLight ? 'bg-zinc-700' : 'bg-red-500',
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
                    className={cn('flex items-center gap-2 px-3 py-2', navControlButtonClass(isDark, theme))}
                  >
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        isPaperLight
                          ? 'bg-zinc-500 shadow-[0_0_8px_rgb(63_63_70/0.3)]'
                          : 'bg-teal-500 shadow-[0_0_8px_rgb(13_148_136/0.4)]',
                      )}
                    />
                    <span className='text-xs font-semibold'>Wallet</span>
                  </button>

                  {/* Messages */}
                  <button
                    type='button'
                    onClick={() => {
                      navigateToMessages()
                      setIsMenuOpen(false)
                    }}
                    className={cn('relative flex items-center gap-2 px-3 py-2', navControlButtonClass(isDark, theme))}
                  >
                    <MessageSquare className='w-4 h-4' />
                    <span className='text-xs font-medium'>Messages</span>
                    {unreadMessageCount > 0 && (
                      <span
                        className={cn(
                          'flex items-center justify-center min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full',
                          isPaperLight ? 'bg-zinc-700' : 'bg-blue-500',
                        )}
                      >
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
                    className={cn('flex items-center gap-2 px-4 py-2', navTextLinkClass(isDark, undefined, theme))}
                  >
                    <Home className='w-4 h-4' />
                    Home
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      // Guest entry into Guided Mode — page.tsx renders
                      // SimpleModeShell with a null wallet, no signin required.
                      onBrowseGuided?.()
                      setIsMenuOpen(false)
                    }}
                    className={cn('flex items-center gap-2 px-4 py-2', navTextLinkClass(isDark, 'teal', theme))}
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
                    navStormiButtonClass(isDark, theme),
                  )}
                >
                  <Sparkles className='w-4 h-4' />
                  <span>{tHasUnread ? 'Stormi has updates' : 'Chat with Stormi'}</span>
                  {tHasUnread && (
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full animate-pulse',
                        isPaperLight ? 'bg-zinc-600' : 'bg-red-500',
                      )}
                    />
                  )}
                </button>
              )}

              {/* Hub row — flex-wrap so items flow naturally; My Hub stays centered via
                  auto margins, and the row wraps cleanly at narrow widths instead of overlapping. */}
              {userRole && isAuthenticated && (
                <div className='relative z-[100] flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-3'>
                  <div className='flex shrink-0 items-center gap-3'>
                    {userRole === 'candidate' && walletAddress ? (
                      <div className={cn(navHubGradientRingClass(theme), 'shrink-0')}>
                        <button
                          type='button'
                          onClick={() => {
                            requestHubRefresh()
                            setIsMenuOpen(false)
                          }}
                          disabled={hubBlocksLoading}
                          className={cn(navHubRefreshInnerButtonClass(theme), 'cursor-pointer')}
                          title='Refresh hub — pull latest blocks and files'
                          aria-label='Refresh hub — pull latest blocks and files'
                        >
                          {hubBlocksLoading ? (
                            <Loader2 className='h-4 w-4 animate-spin shrink-0' aria-hidden />
                          ) : (
                            <RefreshCw className='h-4 w-4 shrink-0' aria-hidden />
                          )}
                        </button>
                      </div>
                    ) : null}
                    {userRole === 'candidate' && (
                      <div className='flex shrink-0 items-center self-center'>
                        <ModeToggle variant='pill' onAfterToggle={() => setIsMenuOpen(false)} />
                      </div>
                    )}
                  </div>

                  <div
                    ref={hubDropdownRef}
                    className='relative z-[110] flex shrink-0 justify-center'
                  >
                    <div className={navHubGradientRingClass(theme)}>
                      <button
                        type='button'
                        onClick={() => setIsHubDropdownOpen(!isHubDropdownOpen)}
                        className={cn(navHubInnerButtonClass(theme), 'cursor-pointer')}
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
                        <button
                          type='button'
                          onClick={() => {
                            void (async () => {
                              // Candidates: tips tied to `users.stormi_walkthrough_dismissed_at` (per wallet).
                              if (userRole === 'candidate' && walletAddress) {
                                const nextDismissed = !walkthroughDismissed
                                const res = await fetch('/api/user/profile', {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'x-wallet-address': walletAddress,
                                  },
                                  body: JSON.stringify({ walkthrough_dismissed: nextDismissed }),
                                })
                                if (res.ok) {
                                  setWalkthroughDismissed(nextDismissed)
                                  if (!nextDismissed) {
                                    requestWalkthrough()
                                  }
                                }
                              } else {
                                if (!showJourneyModals) {
                                  usePreferencesStore.getState().resetCompletedJourneySteps()
                                }
                                setShowJourneyModals(!showJourneyModals)
                              }
                            })()
                            setIsHubDropdownOpen(false)
                            setIsMenuOpen(false)
                          }}
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
                              (userRole === 'candidate' ? !walkthroughDismissed : showJourneyModals)
                                ? isDark
                                  ? 'bg-teal-500/20 text-teal-400'
                                  : isPaperLight
                                    ? 'bg-zinc-200 text-zinc-800'
                                    : 'bg-teal-100 text-teal-800'
                                : isDark
                                  ? 'bg-gray-800 text-gray-400'
                                  : isPaperLight
                                    ? 'bg-zinc-100 text-zinc-600'
                                    : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {(userRole === 'candidate' ? !walkthroughDismissed : showJourneyModals)
                              ? 'On'
                              : 'Off'}
                          </span>
                        </button>
                        <button
                          type='button'
                          onClick={() => {
                            requestWalkthrough()
                            setIsHubDropdownOpen(false)
                            setIsMenuOpen(false)
                          }}
                          className={cn(
                            navDropdownItemClass(isDark),
                            navDropdownItemBorderClass(isDark),
                            isDark ? 'text-teal-400' : isPaperLight ? 'text-zinc-700' : 'text-teal-700',
                          )}
                        >
                          <HelpCircle className='w-4 h-4' />
                          <span>Stormi Journey Guide</span>
                          <span className='ml-auto text-xs opacity-60'>?</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className='flex shrink-0 items-center gap-3'>
                    {userRole && (
                      <button
                        type='button'
                        onClick={() => handleNavigation('stormchain')}
                        className={cn(navStormPillClass(isDark, theme))}
                        title={`STORM balance: ${stormBalanceDisplay}`}
                      >
                        <StormTokenMark size='xs' className='scale-90' />
                        {stormBalanceLoading ? (
                          <span
                            className={cn(
                              'inline-block h-4 w-10 animate-pulse rounded',
                              isDark ? 'bg-gray-700' : isPaperLight ? 'bg-zinc-300' : 'bg-slate-200',
                            )}
                            aria-hidden
                          />
                        ) : (
                          <span className='font-mono tabular-nums'>{stormBalanceDisplay}</span>
                        )}
                        <span className='hidden sm:inline text-[10px] opacity-70'>
                          STORM
                        </span>
                      </button>
                    )}
                    <ThemePicker />
                  </div>
                </div>
              )}
            </div>
        </nav>
      </NavVaultShell>
    </header>
  )
}
