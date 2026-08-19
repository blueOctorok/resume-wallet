'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard,
  ChevronDown,
  Building2,
  MessageSquare,
  User,
  Home,
  Briefcase,
  Search,
  Plus,
  Users,
  Shield,
  CheckCircle,
  Blocks,
  Gift,
  LogOut,
  Menu,
  Settings,
  Bell,
  Orbit,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  navControlButtonClass,
  navTextLinkClass,
  navDropdownPanelClass,
  navDropdownItemClass,
  navDropdownItemBorderClass,
} from '@/lib/navigation-styles'
import ProvvenWordmark from '@/components/ui/ProvvenWordmark'
import Button from '@/components/ui/Button'
import { useTheme, type Theme } from '@/contexts/ThemeContext'
import { useUIStore } from '@/stores'
import type { PageType, UserRole } from '@/stores/types'
import { useNotificationStore } from '@/stores/notification-store'
import MvrStatusBadge from './MvrStatusBadge'
import ReferralModal from '@/components/hub/ReferralModal'
import NotificationBell from './ui/NotificationBell'
import { getDisplayRole } from '@/lib/employer-roles'

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

interface NavigationProps {
  isAuthenticated?: boolean
  userRole?: UserRole
  /** Signs the user out (Supabase). Replaces the legacy wallet/status modal. */
  onLogout?: () => void
  onNavigate?: (page: NavPage) => void
  /** @deprecated Use sessionUserId; kept for backwards compatibility. */
  mvrWalletAddress?: string | null
  sessionUserId?: string | null
  /**
   * Guests' "Browse jobs" button calls this instead of navigating to a route.
   * page.tsx flips a `showGuidedMode` flag and renders `SimpleModeShell` for
   * unauthenticated users — this is the Indeed-style lazy-auth entry point.
   */
  onBrowseGuided?: () => void
}

const HUB_LABELS: Partial<Record<NonNullable<UserRole>, string>> = {
  // Legacy driver/developer labels share the candidate surface
  driver: 'My Hub',
  employer: 'Employer Hub',
  developer: 'My Hub',
  candidate: 'My Hub',
}

function HubRoleIcon({ userRole }: { userRole: UserRole }) {
  if (userRole === 'employer') return <Building2 className='w-4 h-4' />
  // Candidate surface (includes legacy driver/developer roles)
  return <User className='w-4 h-4' />
}

/**
 * Light / Dark toggle — same segmented chrome as Career Card · Build.
 * Lives between Career Card / Build and Options so appearance isn't buried in a menu.
 */
function ThemeModeToggle({ isDark }: { isDark: boolean }) {
  const { theme, setTheme } = useTheme()
  const options: { id: Theme; label: string; icon: LucideIcon }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Orbit },
  ]

  return (
    <div
      role='tablist'
      aria-label='Appearance'
      className={cn(
        'flex h-9 items-center rounded-full border p-0.5',
        isDark ? 'border-white/12 bg-white/[0.04]' : 'border-stone-300/80 bg-stone-900/[0.04]',
      )}
    >
      {options.map(({ id, label, icon: Icon }) => {
        const selected = theme === id
        return (
          <button
            key={id}
            type='button'
            role='tab'
            aria-selected={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(id)}
            className={cn(
              'flex h-8 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-all cursor-pointer sm:gap-1.5 sm:px-2.5 sm:text-xs',
              selected
                ? isDark
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-dark-amber text-white shadow-sm'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-ironside hover:text-[#173150]',
            )}
          >
            <Icon className='h-3.5 w-3.5 shrink-0' aria-hidden />
            <span className='whitespace-nowrap'>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

function UnreadBadge({ count, isDark }: { count: number; isDark: boolean }) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
        'bg-teal-500',
        isDark ? 'ring-1 ring-white/10' : '',
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

/**
 * Account options — Messages, Notifications, referrals, log out.
 * Appearance lives on the Light/Dark toggle next to this menu (not buried here).
 * The gear shows a badge when Messages or Notifications have unread items.
 */
function NavOptionsMenu({
  isDark,
  onLogout,
  sessionUserId,
  onOpenNotifications,
}: {
  isDark: boolean
  onLogout?: () => void
  sessionUserId?: string | null
  onOpenNotifications?: () => void
}) {
  const navigateToMessages = useUIStore((s) => s.navigateToMessages)
  const { notifications, unreadCount } = useNotificationStore()
  const unreadMessageCount = notifications.filter((n) => n.type === 'new_message' && !n.read).length

  const [open, setOpen] = useState(false)
  const [referralOpen, setReferralOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const hasAttention = unreadCount > 0 || unreadMessageCount > 0

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className='relative'>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative hidden sm:flex h-9 w-9 items-center justify-center cursor-pointer',
          navControlButtonClass(isDark),
        )}
        aria-label={hasAttention ? 'Options — you have unread items' : 'Options'}
        aria-expanded={open}
        aria-haspopup='menu'
        title='Options'
      >
        <Settings className='h-4 w-4' />
        {hasAttention && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-teal-500',
              isDark ? 'ring-2 ring-gray-950' : 'ring-2 ring-white',
            )}
          />
        )}
      </button>

      {open && (
        <div
          role='menu'
          aria-label='Options'
          className={cn(
            'absolute right-0 top-full z-[200] mt-2 w-[min(100vw-2rem,16.5rem)] overflow-hidden rounded-xl border shadow-xl ring-1 animate-menu-pop origin-top-right',
            isDark
              ? 'border-gray-600/80 bg-gray-950 ring-white/[0.04]'
              : 'border-stone-300/90 bg-white ring-stone-900/[0.04]',
          )}
        >
          <div>
            <button
              type='button'
              role='menuitem'
              onClick={() => {
                setOpen(false)
                navigateToMessages()
              }}
              className={navDropdownItemClass(isDark)}
            >
              <MessageSquare className='h-4 w-4 shrink-0' />
              <span className='flex-1 text-left'>Messages</span>
              <UnreadBadge count={unreadMessageCount} isDark={isDark} />
            </button>
            {sessionUserId && (
              <button
                type='button'
                role='menuitem'
                onClick={() => {
                  setOpen(false)
                  onOpenNotifications?.()
                }}
                className={navDropdownItemClass(isDark)}
              >
                <Bell className='h-4 w-4 shrink-0' />
                <span className='flex-1 text-left'>Notifications</span>
                <UnreadBadge count={unreadCount} isDark={isDark} />
              </button>
            )}
            <button
              type='button'
              role='menuitem'
              onClick={() => {
                setOpen(false)
                setReferralOpen(true)
              }}
              className={navDropdownItemClass(isDark)}
            >
              <Gift className='h-4 w-4 shrink-0' />
              Refer a friend
            </button>
            <button
              type='button'
              role='menuitem'
              onClick={() => {
                setOpen(false)
                onLogout?.()
              }}
              className={cn(navDropdownItemClass(isDark), isDark ? 'text-red-300 hover:bg-red-500/10' : 'text-red-700 hover:bg-red-50')}
            >
              <LogOut className='h-4 w-4 shrink-0' />
              Log out
            </button>
          </div>
        </div>
      )}

      {referralOpen && <ReferralModal onClose={() => setReferralOpen(false)} />}
    </div>
  )
}

type CandidateHubView = 'build' | 'career-card'

/**
 * Hub toggle: Build (the workspace) · Career Card (the showroom).
 * Lives in the nav center on every breakpoint — never buried in Options/hamburger.
 * One outer box; the selected segment fills gold so the switch is unmistakable.
 */
function CandidateViewToggle({
  active,
  onSelect,
  isDark,
}: {
  active: CandidateHubView
  onSelect: (view: CandidateHubView) => void
  isDark: boolean
}) {
  // Career Card first (left) — it's the default home after login
  const options: { id: CandidateHubView; label: string; icon: LucideIcon }[] = [
    { id: 'career-card', label: 'Career Card', icon: LayoutDashboard },
    { id: 'build', label: 'Build', icon: Blocks },
  ]

  return (
    <div
      role='tablist'
      aria-label='Hub view'
      className={cn(
        'flex h-9 items-center rounded-full border p-0.5',
        isDark ? 'border-white/12 bg-white/[0.04]' : 'border-stone-300/80 bg-stone-900/[0.04]',
      )}
    >
      {options.map(({ id, label, icon: Icon }) => {
        const selected = active === id
        return (
          <button
            key={id}
            type='button'
            role='tab'
            aria-selected={selected}
            aria-label={label}
            title={label}
            onClick={() => onSelect(id)}
            className={cn(
              'flex h-8 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-all cursor-pointer sm:gap-1.5 sm:px-2.5 sm:text-xs',
              selected
                ? isDark
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-dark-amber text-white shadow-sm'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-ironside hover:text-[#173150]',
            )}
          >
            <Icon className='h-3.5 w-3.5 shrink-0' />
            {/* Labels eat the wordmark on a phone; icons + aria-label stay. */}
            <span className='hidden whitespace-nowrap sm:inline'>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Career Card is home (null / career-card). Build is the DQ board.
// Work pages (dotapp, mvr, …) keep the Build segment selected so the
// driver knows they're in the workshop.
function candidateHubViewFromPage(page: PageType): CandidateHubView {
  return page === 'career-card' || page === null ? 'career-card' : 'build'
}

function pageFromCandidateHubView(view: CandidateHubView): PageType {
  return view === 'build' ? 'build' : 'career-card'
}

/**
 * Traditional top bar — wordmark left, controls right, mobile menu below.
 * Heritage chrome: translucent ink-navy / cream bar with a hairline bottom
 * border and a champagne-gold ledger line (neutral zinc on paper/ink themes).
 */
export default function Navigation({
  isAuthenticated = false,
  userRole,
  onLogout,
  onNavigate,
  mvrWalletAddress,
  sessionUserId,
  onBrowseGuided,
}: NavigationProps) {
  const mvrIdentity = sessionUserId ?? mvrWalletAddress ?? null
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // Mobile menu has its own referral trigger (theme toggle is always in the bar / menu chrome)
  const [mobileReferralOpen, setMobileReferralOpen] = useState(false)
  // Shared: Options (desktop) + hamburger (mobile) both open this panel
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isHubDropdownOpen, setIsHubDropdownOpen] = useState(false)
  const hubDropdownRef = useRef<HTMLDivElement>(null)
  const notificationsAnchorRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const { navigateToMessages, setCurrentPage } = useUIStore()
  const currentPage = useUIStore((s) => s.currentPage)
  const employerNavSnapshot = useUIStore((s) => s.employerNavSnapshot)
  const { notifications, unreadCount } = useNotificationStore()
  // Bar is the opposite of the page: cream on Dark, ink-navy on Light.
  const isDark = !isDarkTheme(theme)
  // Derive unread message count from existing notification store — no extra fetch needed
  const unreadMessageCount = notifications.filter(n => n.type === 'new_message' && !n.read).length
  const hasNavAttention = unreadCount > 0 || unreadMessageCount > 0

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

  const handleNavigation = (page: NavPage) => {
    setIsMenuOpen(false)
    onNavigate?.(page)
  }

  /** Nav to an in-shell page (inbox, employer shortcuts, …) and close menus */
  const goToPage = (page: Parameters<typeof setCurrentPage>[0]) => {
    setCurrentPage(page)
    setIsMenuOpen(false)
    setIsHubDropdownOpen(false)
  }

  const barClass = isDark
    ? 'bg-[#173150]/85 border-white/[0.08]'
    : 'bg-[#fbf8f1]/92 border-stone-300/70'

  const wordmarkButtonLabel = isAuthenticated ? 'Go to your hub' : 'Go to home'

  const hubTriggerClass = cn(
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors cursor-pointer',
    isDark ? 'text-gray-200 hover:bg-white/[0.06]' : 'text-stone-800 hover:bg-stone-900/[0.05]',
  )

  const employerSnapshot = userRole === 'employer' && employerNavSnapshot && (
    <div className='flex min-w-0 max-w-[16rem] flex-col text-left'>
      <div className='flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1'>
        <span
          className={cn('truncate text-xs font-semibold', isDark ? 'text-gray-100' : 'text-gray-900')}
          title={employerNavSnapshot.companyName}
        >
          {employerNavSnapshot.companyName}
        </span>
        {employerNavSnapshot.userRole && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
              employerNavSnapshot.userRole === 'owner'
                ? isDark
                  ? 'border-purple-500/40 bg-purple-500/15 text-purple-300'
                  : 'border-purple-200 bg-purple-50 text-purple-800'
                : employerNavSnapshot.userRole === 'admin'
                  ? isDark
                    ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                    : 'border-blue-200 bg-blue-50 text-blue-800'
                  : employerNavSnapshot.userRole === 'viewer'
                    ? isDark
                      ? 'border-gray-500/40 bg-gray-500/15 text-gray-400'
                      : 'border-gray-200 bg-gray-100 text-gray-700'
                    : isDark
                      ? 'border-teal-500/40 bg-teal-500/15 text-teal-300'
                      : 'border-teal-200 bg-teal-50 text-teal-800',
            )}
          >
            {getDisplayRole(employerNavSnapshot.userRole)}
          </span>
        )}
        {employerNavSnapshot.verified && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-800',
            )}
            title='Verified company'
          >
            <CheckCircle className='h-2.5 w-2.5 shrink-0' aria-hidden />
            Verified
          </span>
        )}
      </div>
      {(employerNavSnapshot.subtitle || employerNavSnapshot.memberSinceLabel) && (
        <p
          className='mt-0.5 truncate text-[10px] leading-tight text-gray-500'
          title={[employerNavSnapshot.subtitle, employerNavSnapshot.memberSinceLabel].filter(Boolean).join(' · ')}
        >
          {[employerNavSnapshot.subtitle, employerNavSnapshot.memberSinceLabel].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )

  const hubDropdownItems = (
    <>
      {/* Legacy driver/developer hubs — candidates use CandidateViewToggle instead */}
      {userRole !== 'employer' && userRole !== 'candidate' && (
        <button type='button' onClick={() => { handleNavigation('hub'); setIsHubDropdownOpen(false) }} className={navDropdownItemClass(isDark)}>
          <LayoutDashboard className='w-4 h-4' />
          Career Card
        </button>
      )}
      {/* Employer shortcuts — EmployerShell reads currentPage from UIStore */}
      {userRole === 'employer' && (
        <>
          <button type='button' onClick={() => { handleNavigation('hub'); setIsHubDropdownOpen(false) }} className={navDropdownItemClass(isDark)}>
            <LayoutDashboard className='w-4 h-4' />
            Dashboard
          </button>
          <button type='button' onClick={() => goToPage('talent-search')} className={cn(navDropdownItemClass(isDark), navDropdownItemBorderClass(isDark))}>
            <Search className='w-4 h-4' />
            Find Talent
          </button>
          <button type='button' onClick={() => goToPage('post-job')} className={cn(navDropdownItemClass(isDark), navDropdownItemBorderClass(isDark))}>
            <Plus className='w-4 h-4' />
            Post Job
          </button>
          <button type='button' onClick={() => goToPage('applicants')} className={cn(navDropdownItemClass(isDark), navDropdownItemBorderClass(isDark))}>
            <Users className='w-4 h-4' />
            Applicants
          </button>
          <button type='button' onClick={() => goToPage('company-profile')} className={cn(navDropdownItemClass(isDark), navDropdownItemBorderClass(isDark))}>
            <Building2 className='w-4 h-4' />
            Company Profile
          </button>
          <button type='button' onClick={() => goToPage('team')} className={cn(navDropdownItemClass(isDark), navDropdownItemBorderClass(isDark))}>
            <Shield className='w-4 h-4' />
            Team
          </button>
        </>
      )}
    </>
  )

  return (
    <header className='sticky top-0 z-50'>
      <div className={cn('relative border-b backdrop-blur-xl', barClass)}>
        <nav className='mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8' aria-label='Main navigation'>
          {/* Relative so the candidate toggle can sit at true viewport-center
              without being shoved by unequal left/right control widths. */}
          <div className='relative flex h-16 items-center justify-between gap-4'>
            {/* Left — wordmark (home link) + hub menu */}
            <div className='z-10 flex min-w-0 items-center gap-2 sm:gap-5'>
              <button
                type='button'
                onClick={() => handleNavigation(isAuthenticated ? 'hub' : 'home')}
                className='min-w-0 cursor-pointer transition-opacity hover:opacity-85'
                aria-label={wordmarkButtonLabel}
              >
                <h1 className='text-[1.05rem] leading-none sm:text-[1.6rem]'>
                  <ProvvenWordmark
                    tone='auto'
                    isDark={isDark}
                    className='tracking-[0.04em] sm:tracking-[0.08em]'
                  />
                </h1>
              </button>

              {/* Employers + legacy roles keep the hub dropdown */}
              {isAuthenticated && userRole && userRole !== 'candidate' && (
                <div ref={hubDropdownRef} className='relative hidden sm:block'>
                  <button
                    type='button'
                    onClick={() => setIsHubDropdownOpen(!isHubDropdownOpen)}
                    className={hubTriggerClass}
                    aria-expanded={isHubDropdownOpen}
                  >
                    <HubRoleIcon userRole={userRole} />
                    {HUB_LABELS[userRole] ?? 'My Hub'}
                    <ChevronDown className={cn('w-4 h-4 transition-transform', isHubDropdownOpen && 'rotate-180')} />
                  </button>
                  {isHubDropdownOpen && <div className={navDropdownPanelClass(isDark)}>{hubDropdownItems}</div>}
                </div>
              )}

              {isAuthenticated && <div className='hidden min-w-0 xl:block'>{employerSnapshot}</div>}
            </div>

            {/* Center — Build / Career Card (true middle of the bar on every breakpoint) */}
            {isAuthenticated && userRole === 'candidate' && (
              <div className='pointer-events-none absolute inset-x-0 flex justify-center'>
                <div className='pointer-events-auto'>
                  <CandidateViewToggle
                    isDark={isDark}
                    active={candidateHubViewFromPage(currentPage)}
                    onSelect={(view) => goToPage(pageFromCandidateHubView(view))}
                  />
                </div>
              </div>
            )}

            {/* Right — controls */}
            <div className='z-10 flex shrink-0 items-center gap-2'>
              {!isAuthenticated && (
                <>
                  <button
                    type='button'
                    onClick={() => handleNavigation('home')}
                    className={cn('hidden sm:flex items-center gap-2 px-3.5 py-2', navTextLinkClass(isDark))}
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
                    className={cn('hidden sm:flex items-center gap-2 px-3.5 py-2', navTextLinkClass(isDark, 'teal'))}
                  >
                    <Briefcase className='w-4 h-4' />
                    Browse jobs
                  </button>
                  <Button type='button' variant='primary' size='sm' onClick={() => handleNavigation('signin')}>
                    Sign in
                  </Button>
                </>
              )}

              {isAuthenticated && (
                <>
                  {/* Legacy driver MVR status */}
                  {userRole === 'driver' && mvrIdentity && (
                    <div className='hidden lg:block'>
                      <MvrStatusBadge sessionUserId={mvrIdentity} />
                    </div>
                  )}

                  <div className='hidden sm:block'>
                    <ThemeModeToggle isDark={isDark} />
                  </div>

                  <div ref={notificationsAnchorRef} className='relative'>
                    <NavOptionsMenu
                      isDark={isDark}
                      onLogout={onLogout}
                      sessionUserId={sessionUserId}
                      onOpenNotifications={() => setNotificationsOpen(true)}
                    />
                    {/* One bell instance for desktop Options + mobile menu — keeps polling alive */}
                    {sessionUserId && (
                      <NotificationBell
                        sessionUserId={sessionUserId}
                        hideTrigger
                        open={notificationsOpen}
                        onOpenChange={setNotificationsOpen}
                      />
                    )}
                  </div>
                </>
              )}

              {/* Guests: same Light/Dark toggle as signed-in (was a nested ThemePicker) */}
              {!isAuthenticated && (
                <div className='hidden sm:block'>
                  <ThemeModeToggle isDark={isDark} />
                </div>
              )}

              {/* Hamburger — mobile only */}
              <button
                type='button'
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={cn('relative sm:hidden flex h-9 w-9 items-center justify-center cursor-pointer', navControlButtonClass(isDark))}
                aria-label='Toggle menu'
                aria-expanded={isMenuOpen}
              >
                {isAuthenticated && !isMenuOpen && hasNavAttention && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 z-10 bg-red-500',
                      isDark ? 'border-gray-950' : 'border-white',
                    )}
                  />
                )}
                {isMenuOpen ? <X className='w-5 h-5' /> : <Menu className='w-5 h-5' />}
              </button>
            </div>
          </div>

          {/* Mobile menu — stacked, traditional */}
          {isMenuOpen && (
            <div className={cn('sm:hidden border-t py-3 space-y-1 animate-menu-drop', isDark ? 'border-white/[0.08]' : 'border-stone-300/60')}>
              {!isAuthenticated && (
                <>
                  <button type='button' onClick={() => handleNavigation('home')} className={cn('w-full flex items-center gap-3 px-3 py-2.5', navTextLinkClass(isDark))}>
                    <Home className='w-4 h-4' />
                    Home
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      onBrowseGuided?.()
                      setIsMenuOpen(false)
                    }}
                    className={cn('w-full flex items-center gap-3 px-3 py-2.5', navTextLinkClass(isDark, 'teal'))}
                  >
                    <Briefcase className='w-4 h-4' />
                    Browse jobs
                  </button>
                </>
              )}

              {isAuthenticated && (
                <>
                  {userRole === 'driver' && mvrIdentity && (
                    <div className='flex justify-center pb-1'>
                      <MvrStatusBadge sessionUserId={mvrIdentity} />
                    </div>
                  )}

                  {/* Employers + legacy roles — flattened hub links */}
                  {userRole && userRole !== 'candidate' && (
                    <div className={cn('overflow-hidden rounded-xl border', isDark ? 'border-white/[0.08]' : 'border-stone-300/60')}>
                      {hubDropdownItems}
                    </div>
                  )}

                </>
              )}

              <div className='flex justify-center py-2'>
                <ThemeModeToggle isDark={isDark} />
              </div>

              {isAuthenticated && (
                <div
                  className={cn(
                    'mt-1 overflow-hidden rounded-xl border',
                    isDark ? 'border-white/[0.08]' : 'border-stone-300/60',
                  )}
                >
                  <button
                    type='button'
                    onClick={() => {
                      setIsMenuOpen(false)
                      navigateToMessages()
                    }}
                    className={navDropdownItemClass(isDark)}
                  >
                    <MessageSquare className='h-4 w-4' />
                    <span className='flex-1 text-left'>Messages</span>
                    <UnreadBadge count={unreadMessageCount} isDark={isDark} />
                  </button>
                  {sessionUserId && (
                    <button
                      type='button'
                      onClick={() => {
                        setIsMenuOpen(false)
                        setNotificationsOpen(true)
                      }}
                      className={navDropdownItemClass(isDark)}
                    >
                      <Bell className='h-4 w-4' />
                      <span className='flex-1 text-left'>Notifications</span>
                      <UnreadBadge count={unreadCount} isDark={isDark} />
                    </button>
                  )}
                  <button
                    type='button'
                    onClick={() => {
                      setIsMenuOpen(false)
                      setMobileReferralOpen(true)
                    }}
                    className={cn(
                      navDropdownItemClass(isDark),
                      'border-t',
                      isDark ? 'border-white/[0.08]' : 'border-stone-200',
                    )}
                  >
                    <Gift className='h-4 w-4' />
                    Refer a friend
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      onLogout?.()
                      setIsMenuOpen(false)
                    }}
                    className={cn(
                      navDropdownItemClass(isDark),
                      'border-t',
                      isDark ? 'border-white/[0.08] text-red-300' : 'border-stone-200 text-red-700',
                    )}
                  >
                    <LogOut className='h-4 w-4' />
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Champagne ledger hairline under the bar */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent to-transparent',
            isDark ? 'via-[#f15a2b]/45' : 'via-[#f15a2b]/40',
          )}
        />
      </div>

      {mobileReferralOpen && <ReferralModal onClose={() => setMobileReferralOpen(false)} />}
    </header>
  )
}
