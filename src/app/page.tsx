'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
// NOTE: useState is only used for `mounted` (hydration guard) and nothing else.
// All application state lives in Zustand stores.
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import StormBackground from '@/components/StormBackground'
import UserStatusModal from '@/components/UserStatusModal'
import LoadingScreen from '@/components/LoadingScreen'
import { AssistantBridgeProvider } from '@/contexts/AssistantBridgeContext'
import type { ResumeUploadEvent } from '@/types/assistant'
import {
  useAuthStore,
  useUIStore,
} from '@/stores'
import { useHubBlocksStore, useNeedsOnboarding } from '@/stores/hub-blocks-store'
import { useCandidateShellHistory } from '@/hooks/use-candidate-shell-history'
import { createClient as createSupabaseBrowserClient } from '@/utils/supabase/client'
import type { PageType } from '@/stores'

// Shell components — each role gets its own shell
import DriverShell from '@/components/app/DriverShell'
import EmployerShell from '@/components/app/EmployerShell'
import DeveloperShell from '@/components/app/DeveloperShell'
import CandidateShell from '@/components/app/CandidateShell'
// Guests browsing jobs land in this shell (Indeed-style lazy auth).
import SimpleModeShell from '@/components/simple/SimpleModeShell'
import ErrorBoundary from '@/components/app/ErrorBoundary'
import { JourneyModal } from '@/components/ui'
import StormiJourneyGuide from '@/components/StormiJourneyGuide'

// Invite deep-link target stashed by /onboard/[token] before it redirects to `/`.
// sessionStorage survives the sign-in round-trip + guest-redirect hops that strip
// the ?onboard= query param. Key must stay in sync with src/app/onboard/[token]/page.tsx.
const ONBOARD_TARGET_KEY = 'storm_onboard_target'

const RoleSelectionModal = dynamic(
  () => import('@/components/RoleSelectionModal').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading...' fullScreen={false} /> }
)

const ProfileSetupModal = dynamic(
  () => import('@/components/ProfileSetupModal').then((mod) => mod.default),
  { ssr: false }
)

// ============================================================
// Inner component — auth state comes entirely from the Supabase session
// (bridged into the store by useSupabaseAuthSync). No wallet SDK.
// ============================================================
const HomeContent = () => {
  // Next.js hooks
  const searchParams = useSearchParams()
  const router = useRouter()

  // -------------------------------------------------------
  // Zustand Stores
  // -------------------------------------------------------
  const authStore = useAuthStore()
  const {
    user, setUser,
    walletAddress,
    sessionUserId,
    supabaseSessionChecked,
    userRole, setUserRole,
    isRoleLoading, setIsRoleLoading,
    showRoleSelection, setShowRoleSelection,
    isSettingRole, setIsSettingRole,
    companyName,
    setCompanyName,
    referralCode, setReferralCode,
  } = authStore

  const uiStore = useUIStore()
  const {
    currentPage, setCurrentPage,
    isModalOpen, setIsModalOpen,
    driverJourneyState,
    setLatestResumeIpfsHash,
    handleResumeUploadEvent,
  } = uiStore

  useCandidateShellHistory(
    !!user && userRole === 'candidate' && !isRoleLoading,
    currentPage,
  )

  // The Supabase-session → store bridge is mounted globally in the root layout
  // (<SupabaseAuthSync/>), so it covers every route — not just `/`. page.tsx just
  // reads the resulting `user`/`userRole`/`sessionSettled` from the store below.

  // Page-level routing flag for guests entering Guided Mode without signing in
  // (Indeed-style lazy auth). Local useState is appropriate here — this is a
  // transient routing toggle, not data anyone else needs to read.
  const [showGuidedMode, setShowGuidedMode] = useState(false)
  const enterGuidedMode = useCallback(() => {
    setShowGuidedMode(true)
    // Reset currentPage so a later setCurrentPage('signin') from
    // SimpleCardPanel's "Connect a wallet" button actually triggers
    // a state change (and thus the exit-guided-mode effect).
    setCurrentPage(null)
  }, [setCurrentPage])
  // When a wallet connects — or the user navigates to sign-in — we drop back
  // to the normal auth / landing flow so the guest flag never strands us.
  useEffect(() => {
    if (user || currentPage === 'signin') setShowGuidedMode(false)
  }, [user, currentPage])

  const {
    showProfileSetup,
    setShowProfileSetup,
    checkAndShowProfileSetup,
  } = authStore

  // Gate ProfileSetupModal so it never overlaps with HubOnboardingForm —
  // two simultaneous modals corrupt the shared openModalCount scroll-lock counter.
  const needsOnboarding = useNeedsOnboarding()
  const updateUserProfile = useHubBlocksStore((s) => s.updateUserProfile)

  // -------------------------------------------------------
  // Capture ?ref=CODE from URL for the referral system
  // -------------------------------------------------------
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref && !referralCode) {
      setReferralCode(ref)
      router.replace('/', { scroll: false })
    }
  }, [searchParams, referralCode, setReferralCode, router])

  // Preserve the Indeed-style "browse jobs without signing in" hook now that
  // /sign-in is the default front door: ?guided=1 drops a guest straight into
  // Guided Mode instead of being redirected to sign-in. Runs before the
  // session-settle window, so the guest-redirect effect never fires first.
  useEffect(() => {
    if (searchParams.get('guided') === '1') {
      setShowGuidedMode(true)
      router.replace('/', { scroll: false })
    }
  }, [searchParams, router])

  // -------------------------------------------------------
  // Fetch user role on login
  // -------------------------------------------------------
  useEffect(() => {
    if (!walletAddress) {
      setUserRole(null)
      setIsRoleLoading(false)
      setShowRoleSelection(false)
      return
    }

    setUserRole(null)
    setShowRoleSelection(false)
    setIsRoleLoading(true)

    const fetchRole = async () => {
      try {
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.profile) {
            const role = data.profile.role
            const validRole =
              role === 'driver' || role === 'employer' || role === 'developer' || role === 'candidate'
                ? role
                : null
            setUserRole(validRole)
            // Keep role modal company name in sync with backend; clear when not employer so stale "My Company" doesn't show
            if (validRole === 'employer' && data.profile.company) {
              setCompanyName((data.profile.company as { company_name?: string }).company_name ?? null)
            } else {
              setCompanyName(null)
            }
            if (!validRole) setShowRoleSelection(true)
            else {
              setShowRoleSelection(false)
              // Don't bounce to the hub when an invite deep-link is pending — the
              // onboard effect routes to the target block once role is known.
              // Resetting here races that effect and was dropping invited
              // candidates on the hub after the Supabase auth cutover.
              const hasPendingOnboard =
                searchParams.get('onboard') ||
                (typeof window !== 'undefined' &&
                  window.sessionStorage.getItem(ONBOARD_TARGET_KEY))
              if (!hasPendingOnboard && (!currentPage || currentPage === 'signin')) {
                setCurrentPage(null)
              }
            }
          } else {
            setUserRole(null)
            setShowRoleSelection(true)
          }
        } else {
          setUserRole(null)
          setShowRoleSelection(true)
        }
      } catch {
        setUserRole(null)
        setShowRoleSelection(true)
      } finally {
        setIsRoleLoading(false)
      }
    }

    fetchRole()
  }, [walletAddress])

  // -------------------------------------------------------
  // Resume an invite that lost its ?next during the Supabase auth round-trip.
  // /onboard/[token] stashes the token before bouncing to /sign-in. If the user
  // returns to `/` instead of the onboard page (the magic-link redirect can fall
  // back to the Site URL), pick the flow back up so role + block setup actually
  // runs — otherwise they're stranded on the hub with a role-selection prompt.
  // We clear the token before redirecting so a failed/invalid invite can't loop.
  // -------------------------------------------------------
  const didResumeInviteRef = useRef(false)
  useEffect(() => {
    if (didResumeInviteRef.current) return
    if (!sessionUserId && !user) return
    const pendingToken =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('stormchain_invite_token')
        : null
    if (!pendingToken) return
    didResumeInviteRef.current = true
    window.localStorage.removeItem('stormchain_invite_token')
    router.replace(`/onboard/${pendingToken}`)
  }, [sessionUserId, user, router])

  // -------------------------------------------------------
  // Handle onboard redirect (from /onboard/[token] flow)
  // When user logs in via invite, they land here with ?onboard=dot-application
  // We wait for role to be set, then navigate to the appropriate page
  // -------------------------------------------------------
  const didHandleOnboardRef = useRef(false)
  useEffect(() => {
    // Invite deep-links pass the target block via ?onboard=<route>. We ALSO read it
    // from sessionStorage (written by /onboard/[token]) as a fallback: the Supabase
    // sign-in round-trip and the guest-redirect below can strip the query string
    // before this effect runs, but the sessionStorage copy survives every hop.
    const storedTarget =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem(ONBOARD_TARGET_KEY)
        : null
    const onboardAction = searchParams.get('onboard') ?? storedTarget
    if (!onboardAction) return
    if (didHandleOnboardRef.current) return
    if (isRoleLoading || !userRole) return

    didHandleOnboardRef.current = true
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ONBOARD_TARGET_KEY)
    }

    // onboard param is the block's `pageRoute` from the registry (e.g. 'dotapp', 'resume', 'mvr').
    // Cast directly — these already match PageType values in CandidateShell.
    // 'jobs' intentionally absent — Guided Mode is the unified job-discovery surface.
    // Employer onboard invites for "browse jobs" route through `?guided=1` instead.
    const validOnboardPages: PageType[] = ['dotapp', 'resume', 'storm-resume', 'general-resume', 'developer-resume', 'mvr', 'psp', 'screening-consent', 'portfolio', 'github', 'hunt-desk', 'applications', 'employment-verification']
    const target = onboardAction as PageType
    if (validOnboardPages.includes(target)) {
      setCurrentPage(target)
    }

    // Clean up URL (remove query params)
    router.replace('/', { scroll: false })
  }, [searchParams, userRole, isRoleLoading, setCurrentPage, router])

  // -------------------------------------------------------
  // Check if user needs profile setup (first-time users with no name)
  // Logic lives in useAuthStore.checkAndShowProfileSetup
  // -------------------------------------------------------
  useEffect(() => {
    if (!isRoleLoading && userRole && walletAddress) {
      checkAndShowProfileSetup(walletAddress, userRole)
    }
  }, [userRole, isRoleLoading, walletAddress])

  // -------------------------------------------------------
  // Supabase /sign-in is the only front door.
  //
  // Unauthenticated visitors are redirected to /sign-in unless they're
  // browsing jobs in Guided Mode (Indeed-style lazy auth).
  //
  // Guards against a redirect LOOP with /sign-in (a user with a live Supabase
  // session would otherwise be bounced before the wallet-shaped `user`
  // hydrates):
  //   - `supabaseSessionChecked`: don't decide "guest" until Supabase's
  //     getUser() has actually resolved.
  //   - `!sessionUserId`: a resolved Supabase session counts as authenticated
  //     even before `user` is hydrated.
  // -------------------------------------------------------
  const sessionSettled = supabaseSessionChecked
  const awaitingGuestRedirect = !user && !sessionUserId && !showGuidedMode

  // Supabase session resolved but the wallet-shaped `user` hasn't hydrated yet
  // (the /api/auth/sync round-trip). Cover the gap so we don't flash a blank
  // hub or the wrong shell during that brief window.
  const awaitingSessionHydration = !user && !!sessionUserId

  useEffect(() => {
    if (sessionSettled && awaitingGuestRedirect) {
      router.push('/sign-in')
    }
  }, [sessionSettled, awaitingGuestRedirect, router])

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------
  const handleLogout = useCallback(async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('stormchain-admin-wallet')
    }
    // End the Supabase session. signOut fires onAuthStateChange →
    // use-supabase-auth-sync clears the store, but we clear below regardless
    // so the UI updates immediately even if the listener is slow.
    try {
      await createSupabaseBrowserClient().auth.signOut()
    } catch (err) {
      console.error('Supabase logout error:', err)
    }
    setUser(null)
  }, [setUser])

  const handleRoleSelection = useCallback(
    async (role: 'candidate' | 'employer', companyName?: string, dotNumber?: string) => {
      if (!walletAddress) return
      setIsSettingRole(true)
      try {
        const res = await fetch('/api/user/set-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            walletAddress,
            ...(role === 'employer' && companyName && { companyName, dotNumber }),
            ...(referralCode && { referralCode }),
          }),
        })
        if (res.ok) {
          setReferralCode(null) // consumed
          setUserRole(role)
          setShowRoleSelection(false)
          setCurrentPage(null)
        } else {
          const err = await res.json().catch(() => ({} as { error?: string; details?: string }))
          const msg = err.details ? `${err.error || 'Request failed'}\n\n${err.details}` : `Failed to set role: ${err.error || res.statusText}. Please try again.`
          alert(msg)
        }
      } catch {
        alert('An error occurred. Please try again.')
      } finally {
        setIsSettingRole(false)
      }
    },
    [walletAddress]
  )

  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <AssistantBridgeProvider
      journey={driverJourneyState}
      requestHelp={() => {}}
      primerSeen={true}
      setPrimerSeen={() => {}}
      notifyResumeUploadEvent={handleResumeUploadEvent}
    >
      <div className='min-h-screen overflow-x-hidden relative'>
        <StormBackground />

        {/* Global Navigation */}
        <Navigation
          isAuthenticated={!!user}
          userRole={userRole}
          onStatusClick={openModal}
          onNavigate={(page) => {
            // 'jobs' removed: navigation's "Browse jobs" guest button now flips into
            // Guided Mode via `onBrowseGuided` rather than navigating to a 'jobs' page.
            const validPages: PageType[] = ['signin', 'resume', 'dotapp', 'applications', 'mvr', 'psp']
            const mapped = page === 'home' || page === 'hub' ? null : page as PageType
            if (page === 'home' || page === 'hub' || validPages.includes(page as PageType)) {
              // Exit guest Guided Mode when going home or to sign-in so the
              // normal auth / landing flow renders instead of SimpleModeShell.
              if (page === 'home' || page === 'signin') setShowGuidedMode(false)
              setCurrentPage(mapped)
            }
          }}
          onBrowseGuided={enterGuidedMode}
          mvrWalletAddress={user?.address || null}
          walletAddress={walletAddress ?? null}
          onSwitchRole={userRole === 'employer' ? undefined : () => setShowRoleSelection(true)}
        />

        {/* User Status Modal */}
        <UserStatusModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onLogout={handleLogout}
          user={{
            email: user?.email as string | undefined,
            address: walletAddress ?? undefined,
            chain: user?.chain as string | undefined,
          }}
          userRole={userRole}
        />

        {/* Role Selection Modal — z-[80] to sit above nav (z-50) */}
        {user && !isRoleLoading && !isSettingRole && (showRoleSelection || userRole === null) && (
          <RoleSelectionModal
            onSelectRole={handleRoleSelection}
            isLoading={isSettingRole}
            userEmail={user?.email}
            walletAddress={user?.address}
            existingRole={userRole}
            existingCompanyName={companyName}
          />
        )}

        {/* Profile Setup Modal — for first-time users to add name/contact.
            Gated on !needsOnboarding so this never renders at the same time as HubOnboardingForm —
            two simultaneous portaled Modals corrupt the shared openModalCount scroll-lock counter,
            leaving body overflow:hidden after the first one unmounts. */}
        {user && walletAddress && !needsOnboarding && (userRole === 'driver' || userRole === 'developer' || userRole === 'candidate') && (
          <ProfileSetupModal
            isOpen={showProfileSetup}
            onClose={() => setShowProfileSetup(false)}
            onComplete={(firstName?: string, lastName?: string) => {
              setShowProfileSetup(false)
              if (firstName && lastName) {
                updateUserProfile({ firstName, lastName })
              }
            }}
            walletAddress={walletAddress}
            userRole={userRole}
            userEmail={user?.email}
          />
        )}

        {/* Stormi Journey Guide — open from hub / nav; no floating launcher (keeps canvas clear) */}
        {user && <StormiJourneyGuide />}

        {/* Journey Modal — guided "what's next" prompts after key actions */}
        <JourneyModal />

        {/* Main content area — employer hub uses a wider cap (two sticky rails + 4K monitors); others stay 7xl */}
        <div
          className={`mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8 mt-8 relative z-0 ${
            userRole === 'employer' ? 'max-w-[min(100%,120rem)]' : 'max-w-7xl'
          }`}
        >

          {/* Role loading overlay */}
          {user && (isRoleLoading || isSettingRole) && !showRoleSelection && (
            <LoadingScreen
              message={isSettingRole ? 'Switching roles...' : 'Loading your dashboard...'}
            />
          )}

          {/* Guest → /sign-in handoff (T1.11c). Covers both the session-check
              window and the moment the redirect fires, so guests never see the
              legacy Alchemy landing flash before reaching the Supabase front door. */}
          {(awaitingGuestRedirect || awaitingSessionHydration) && (
            <LoadingScreen message='Loading…' />
          )}

          {/* ── Employer ── */}
          {user && userRole === 'employer' && !isRoleLoading && (
            <ErrorBoundary section='Employer Hub'>
              <EmployerShell walletAddress={user.address} />
            </ErrorBoundary>
          )}

          {/* ── Developer ── */}
          {user && userRole === 'developer' && !isRoleLoading && (
            <ErrorBoundary section='Developer Hub'>
              <DeveloperShell userAddress={user.address} />
            </ErrorBoundary>
          )}

          {/* ── Candidate (composable hub) ── */}
          {user && userRole === 'candidate' && !isRoleLoading && (
            <ErrorBoundary section='Candidate Hub'>
              <CandidateShell />
            </ErrorBoundary>
          )}

          {/*
           Guest Guided Mode — rendered BEFORE the DriverShell branch so a
           visitor who hits "Browse jobs" goes straight into SimpleModeShell
           with no wallet. SimpleCardPanel detects walletAddress=null and
           renders the sign-in teaser; the rail and job detail work as-is.
          */}
          {!user && showGuidedMode && !isRoleLoading && (
            <ErrorBoundary section='Guided Mode'>
              <SimpleModeShell />
            </ErrorBoundary>
          )}

          {/* ── Driver hub (legacy authenticated drivers) ──
             Only authenticated users reach DriverShell now; unauthenticated
             visitors are redirected to /sign-in above. */}
          {(!showGuidedMode || !!user) &&
            (userRole === 'driver' || (user && !userRole && !showRoleSelection)) &&
            !isRoleLoading && (
              <ErrorBoundary section='Driver Hub'>
                <DriverShell
                  onResumeUploadEvent={handleResumeUploadEvent}
                  onSetLatestResumeIpfsHash={setLatestResumeIpfsHash}
                  onBrowseGuided={enterGuidedMode}
                />
              </ErrorBoundary>
            )}
        </div>
      </div>
    </AssistantBridgeProvider>
  )
}

// Wrapper to ensure client-side provider is ready before rendering
const Home = () => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return <LoadingScreen message='Starting Storm…' fullScreen />
  }

  return <HomeContent />
}

export default Home
