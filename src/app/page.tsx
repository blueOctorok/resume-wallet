'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
// NOTE: useState is only used for `mounted` (hydration guard) and nothing else.
// All application state lives in Zustand stores.
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import StormBackground from '@/components/StormBackground'
import LoadingScreen from '@/components/LoadingScreen'
import { AssistantBridgeProvider } from '@/contexts/AssistantBridgeContext'
import type { ResumeUploadEvent } from '@/types/assistant'
import {
  useAuthStore,
  useUIStore,
} from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useCandidateShellHistory } from '@/hooks/use-candidate-shell-history'
import { createClient as createSupabaseBrowserClient } from '@/utils/supabase/client'
import type { PageType } from '@/stores'

// Shell components — employer vs candidate only.
// DriverShell / DeveloperShell are frozen leftovers and must not be mounted from `/`.
import EmployerShell from '@/components/app/EmployerShell'
import CandidateShell from '@/components/app/CandidateShell'
// Guests browsing jobs land in this shell (Indeed-style lazy auth).
import SimpleModeShell from '@/components/simple/SimpleModeShell'
import ErrorBoundary from '@/components/app/ErrorBoundary'
import { JourneyModal } from '@/components/ui'
import StormiJourneyGuide from '@/components/StormiJourneyGuide'

// Invite deep-link target stashed by /onboard/[token] before it redirects to `/`.
// sessionStorage survives the sign-in round-trip that can strip ?onboard=.
// Key must stay in sync with src/app/onboard/[token]/page.tsx.
const ONBOARD_TARGET_KEY = 'storm_onboard_target'

const LandingPage = dynamic(
  () => import('@/components/landing/LandingPage').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading…' fullScreen={false} /> }
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
    sessionUserId,
    supabaseSessionChecked,
    userRole, setUserRole,
    isRoleLoading, setIsRoleLoading,
    companyName,
    setCompanyName,
    referralCode, setReferralCode,
  } = authStore

  const uiStore = useUIStore()
  const {
    currentPage, setCurrentPage,
    driverJourneyState,
    setLatestResumeIpfsHash,
    handleResumeUploadEvent,
  } = uiStore

  const isCandidateSurface =
    userRole === 'candidate' || userRole === 'driver' || userRole === 'developer'

  useCandidateShellHistory(
    !!user && isCandidateSurface && !isRoleLoading,
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

  // Indeed-style lazy auth: ?guided=1 drops a guest straight into Guided Mode
  // (skip the marketing landing). Runs early so session-settle doesn't flash
  // the landing page first.
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
    if (!sessionUserId) {
      setUserRole(null)
      setIsRoleLoading(false)
      return
    }

    // Don't clear userRole here — /api/auth/sync may already have set it.
    // Nulling first raced sync and briefly (or stuck) mounted the legacy DriverShell
    // via the old `!userRole` fallthrough.
    setIsRoleLoading(true)

    const fetchRole = async () => {
      try {
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.profile) {
            const role = data.profile.role
            const validRole =
              role === 'driver' || role === 'employer' || role === 'developer' || role === 'candidate'
                ? role
                : null
            if (validRole) setUserRole(validRole)
            // Keep the nav company name in sync with backend; clear when not employer
            // so a stale "My Company" doesn't show.
            if (validRole === 'employer' && data.profile.company) {
              setCompanyName((data.profile.company as { company_name?: string }).company_name ?? null)
            } else {
              setCompanyName(null)
            }
            if (validRole) {
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
          }
        }
      } catch {
        // Keep whatever role sync already set
      } finally {
        setIsRoleLoading(false)
      }
    }

    fetchRole()
  }, [sessionUserId])

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
    // Full page reload should land on the hub — not re-run stale ?onboard= deep links
    // (notification URLs like /?onboard=screening-consent otherwise fire every F5).
    if (typeof window !== 'undefined' && performance.getEntriesByType('navigation')[0]) {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (nav.type === 'reload') {
        window.sessionStorage.removeItem(ONBOARD_TARGET_KEY)
        if (searchParams.get('onboard')) {
          router.replace('/', { scroll: false })
        }
        return
      }
    }

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
    if (!isRoleLoading && userRole && sessionUserId) {
      checkAndShowProfileSetup(sessionUserId, userRole)
    }
  }, [userRole, isRoleLoading, sessionUserId])

  // -------------------------------------------------------
  // Guest front door = marketing LandingPage on `/`.
  // Sign-in is opt-in via CTA / nav (router.push('/sign-in')), not an auto-redirect.
  // ?guided=1 / Browse jobs still drops guests into Guided Mode without auth.
  //
  // Wait for Supabase getUser() before showing the landing page so a returning
  // session doesn't flash marketing before the hub hydrates.
  // -------------------------------------------------------
  const sessionSettled = supabaseSessionChecked
  const isGuest = !user && !sessionUserId && !showGuidedMode
  const awaitingSessionCheck = isGuest && !sessionSettled

  // Supabase session resolved but the wallet-shaped `user` hasn't hydrated yet
  // (the /api/auth/sync round-trip). Cover the gap so we don't flash a blank
  // hub or the wrong shell during that brief window.
  const awaitingSessionHydration = !user && !!sessionUserId

  // Nav / Guided Mode "sign in" used to set currentPage='signin' while the
  // guest-redirect effect handled the hop. With the landing page as front
  // door, push the real /sign-in route instead.
  useEffect(() => {
    if (currentPage === 'signin' && !user) {
      setCurrentPage(null)
      router.push('/sign-in')
    }
  }, [currentPage, user, setCurrentPage, router])

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
      {/* overflow-x-clip (not -hidden): hidden creates a scroll container on the
          ancestor, which silently breaks the nav's position:sticky. clip just
          crops paint without changing scroll behavior. */}
      <div className='min-h-screen overflow-x-clip relative'>
        {/* Guest landing paints its own navy/paper bands. The app canvas
            (white specular + ember bloom) sat behind the hero and read as
            a light leaking through the blue. */}
        {!isGuest && <StormBackground />}

        {/* Global Navigation — hidden on the guest marketing landing so the
            hero can own the first viewport (brand-first, no app chrome).
            Still shown for Guided Mode guests and all signed-in shells. */}
        {!isGuest && (
          <Navigation
            isAuthenticated={!!user}
            userRole={userRole}
            onLogout={handleLogout}
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
            mvrWalletAddress={sessionUserId || null}
            sessionUserId={sessionUserId ?? null}
          />
        )}

        {/* Profile Setup Modal — name/contact for first-time users */}
        {user && sessionUserId && (userRole === 'driver' || userRole === 'developer' || userRole === 'candidate') && (
          <ProfileSetupModal
            isOpen={showProfileSetup}
            onClose={() => setShowProfileSetup(false)}
            onComplete={(saved) => {
              setShowProfileSetup(false)
              // Patch the full identity into the hub store so the Build Profile
              // tile flips to Done immediately (no waiting on a refetch).
              updateUserProfile({
                firstName: saved.firstName,
                lastName: saved.lastName,
                email: saved.email,
                phone: saved.phone,
                city: saved.city,
                state: saved.state,
              })
            }}
            sessionUserId={sessionUserId}
            userRole={userRole}
            userEmail={user?.email}
          />
        )}

        {/* Stormi Journey Guide — open from hub / nav; no floating launcher (keeps canvas clear) */}
        {user && <StormiJourneyGuide />}

        {/* Journey Modal — guided "what's next" prompts after key actions */}
        <JourneyModal />

        {/* Session gate — don't flash marketing over a returning session. */}
        {(awaitingSessionCheck || awaitingSessionHydration) && (
          <LoadingScreen message='Loading…' />
        )}

        {/* Guest marketing landing — full-bleed, outside the app content shell
            (no nav offset / max-w-7xl padding) so the ink hero can own the viewport. */}
        {sessionSettled && isGuest && (
          <ErrorBoundary section='Landing'>
            <LandingPage
              isAuthenticated={false}
              onLogIn={() => router.push('/sign-in')}
              onBrowseJobs={enterGuidedMode}
            />
          </ErrorBoundary>
        )}

        {/* Main content area — employer hub uses a wider cap (two sticky rails + 4K monitors); others stay 7xl.
            Skipped for the guest landing (rendered above, full-bleed). */}
        {!isGuest && (
          <div
            className={`mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8 mt-8 relative z-0 ${
              userRole === 'employer' ? 'max-w-[min(100%,120rem)]' : 'max-w-7xl'
            }`}
          >

            {/* Role loading overlay */}
            {user && isRoleLoading && <LoadingScreen message='Loading your dashboard...' />}

            {/* ── Employer ── */}
            {user && userRole === 'employer' && !isRoleLoading && (
              <ErrorBoundary section='Employer Hub'>
                <EmployerShell sessionUserId={sessionUserId} />
              </ErrorBoundary>
            )}

            {/* ── Candidate hub ──
                `driver` / `developer` are legacy role labels only — both use
                CandidateShell. DriverShell and DeveloperShell are not mounted. */}
            {user && isCandidateSurface && !isRoleLoading && (
              <ErrorBoundary section='Candidate Hub'>
                <CandidateShell />
              </ErrorBoundary>
            )}

            {/* Role still unknown after fetch — wait, don't guess a shell */}
            {user && !userRole && !isRoleLoading && (
              <LoadingScreen message='Finishing sign-in…' />
            )}

            {/*
             Guest Guided Mode — visitor who hits "Browse jobs" goes straight
             into SimpleModeShell with no session. SimpleCardPanel detects
             sessionUserId=null and renders the sign-in teaser.
            */}
            {!user && showGuidedMode && !isRoleLoading && (
              <ErrorBoundary section='Guided Mode'>
                <SimpleModeShell />
              </ErrorBoundary>
            )}
          </div>
        )}
      </div>
    </AssistantBridgeProvider>
  )
}

// Wrapper to ensure client-side provider is ready before rendering
const Home = () => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return <LoadingScreen message='Starting Provven…' fullScreen />
  }

  return <HomeContent />
}

export default Home
