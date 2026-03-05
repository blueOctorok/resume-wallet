'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import StormBackground from '@/components/StormBackground'
import UserStatusModal from '@/components/UserStatusModal'
import LoadingScreen from '@/components/LoadingScreen'
import {
  useSendUserOperation,
  useSmartAccountClient,
  useUser,
  useAccount,
  useSignerStatus,
} from '@account-kit/react'
import { AssistantBridgeProvider } from '@/contexts/AssistantBridgeContext'
import type { ResumeUploadEvent } from '@/types/assistant'
import {
  useAuthStore,
  useDotApplicationStore,
  useDriverHubStore,
  useUIStore,
} from '@/stores'
import type { PageType } from '@/stores'

// Shell components — each role gets its own shell
import DriverShell from '@/components/app/DriverShell'
import EmployerShell from '@/components/app/EmployerShell'
import DeveloperShell from '@/components/app/DeveloperShell'
import ErrorBoundary from '@/components/app/ErrorBoundary'
import { JourneyModal, AvaFloatingButton } from '@/components/ui'
import AvaJourneyGuide from '@/components/AvaJourneyGuide'

const WalletInfo = dynamic(
  () => import('@/components/WalletInfo').then((mod) => mod.default),
  { ssr: false }
)

const WalletCard = dynamic(
  () => import('@/components/WalletCard').then((mod) => mod.default),
  { ssr: false }
)

const RoleSelectionModal = dynamic(
  () => import('@/components/RoleSelectionModal').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading...' fullScreen={false} /> }
)

const ProfileSetupModal = dynamic(
  () => import('@/components/ProfileSetupModal').then((mod) => mod.default),
  { ssr: false }
)

// ============================================================
// Inner component that uses Alchemy hooks (must be inside provider)
// ============================================================
const HomeContent = () => {
  // Next.js hooks
  const searchParams = useSearchParams()
  const router = useRouter()

  // Alchemy SDK hooks
  const { client } = useSmartAccountClient({ type: 'LightAccount' })
  const { sendUserOperationAsync, isSendingUserOperation } =
    // @ts-ignore - Type instantiation too deep (Alchemy SDK type complexity)
    useSendUserOperation({ client })
  const { isConnected, isInitializing } = useSignerStatus()
  const alchemyUser = useUser()
  const account = useAccount({ type: 'LightAccount' })

  // -------------------------------------------------------
  // Zustand Stores
  // -------------------------------------------------------
  const authStore = useAuthStore()
  const {
    user, setUser,
    walletAddress,
    userRole, setUserRole,
    isRoleLoading, setIsRoleLoading,
    showRoleSelection, setShowRoleSelection,
    isSettingRole, setIsSettingRole,
    companyName,
    setCompanyName,
    isCheckingSession, setIsCheckingSession,
  } = authStore

  const dotApp = useDotApplicationStore()
  const hubStore = useDriverHubStore()
  const uiStore = useUIStore()
  const {
    currentPage, setCurrentPage,
    isModalOpen, setIsModalOpen,
    driverJourneyState,
    updateJourneyStep,
    latestResumeIpfsHash,
    setLatestResumeIpfsHash,
    handleResumeUploadEvent,
  } = uiStore

  // Tracks whether the user explicitly signed out. Prevents the session-sync
  // effect from immediately re-logging them in while Alchemy's async cleanup runs.
  const didExplicitLogoutRef = useRef(false)

  // Profile setup modal state
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const didCheckProfileRef = useRef(false)

  // -------------------------------------------------------
  // Sync Alchemy session to Auth store (existing sessions + OAuth redirects)
  //
  // WHY we use account.address and NOT alchemyUser.address:
  //   - useUser() returns the signer/EOA address (the underlying key)
  //   - useAccount({ type: 'LightAccount' }) returns the SMART CONTRACT wallet address
  //   - All data in our DB is indexed by the smart contract address
  //   - Using alchemyUser.address would produce a completely different address
  //
  // WHY didExplicitLogoutRef exists:
  //   - Alchemy's logout is async — isConnected/alchemyUser/account don't clear instantly
  //   - Without this guard, the effect re-runs during cleanup, sees !user, and re-logs the user
  // -------------------------------------------------------
  useEffect(() => {
    if (didExplicitLogoutRef.current) return
    if (isConnected && !isInitializing && alchemyUser && account?.address && !user) {
      setUser({
        address: account.address,
        email: alchemyUser.email,
        userId: alchemyUser.userId,
        method: 'alchemy-smart-wallet',
        isConnected: true,
        chain: 'Base Sepolia',
        chainId: 84532,
      })
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('stormchain-admin-wallet', account.address)
      }
    }
  }, [isConnected, isInitializing, alchemyUser, account])

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
              role === 'driver' || role === 'employer' || role === 'developer'
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
              if (!currentPage || currentPage === 'signin') setCurrentPage(null)
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
  // Handle onboard redirect (from /onboard/[token] flow)
  // When user logs in via invite, they land here with ?onboard=dot-application
  // We wait for role to be set, then navigate to the appropriate page
  // -------------------------------------------------------
  const didHandleOnboardRef = useRef(false)
  useEffect(() => {
    const onboardAction = searchParams.get('onboard')
    if (!onboardAction) return
    if (didHandleOnboardRef.current) return
    if (isRoleLoading || !userRole) return

    didHandleOnboardRef.current = true

    // Map onboard action to page type
    const pageMap: Record<string, PageType> = {
      'dot-application': 'dotapp',
      'developer-profile': 'resume', // Developer resume/profile builder
    }
    const targetPage = pageMap[onboardAction]
    if (targetPage) {
      setCurrentPage(targetPage)
    }

    // Clean up URL (remove query params)
    router.replace('/', { scroll: false })
  }, [searchParams, userRole, isRoleLoading, setCurrentPage, router])

  // -------------------------------------------------------
  // Check if user needs to set up profile (first-time users)
  // Shows modal when user has a role but no profile name
  // -------------------------------------------------------
  useEffect(() => {
    // Skip if already checked, or still loading, or no wallet
    if (didCheckProfileRef.current) return
    if (isRoleLoading || !userRole || !walletAddress) return
    if (userRole === 'employer') return // Employers use company profile

    didCheckProfileRef.current = true

    async function checkProfile() {
      try {
        const endpoint = userRole === 'driver'
          ? '/api/driver/profile'
          : '/api/developer/profile'

        const res = await fetch(endpoint, {
          headers: { 'x-wallet-address': walletAddress! },
        })

        if (!res.ok) {
          // Profile doesn't exist yet - show setup modal
          setShowProfileSetup(true)
          return
        }

        const data = await res.json()
        const profile = data.profile

        // Check if profile has a name set
        const hasName = userRole === 'driver'
          ? profile?.firstName || profile?.first_name
          : profile?.firstName

        if (!hasName) {
          setShowProfileSetup(true)
        }
      } catch (err) {
        console.error('Profile check error:', err)
      }
    }

    checkProfile()
  }, [userRole, isRoleLoading, walletAddress])

  // -------------------------------------------------------
  // Session timeout (1.5s for Alchemy to detect existing session)
  // -------------------------------------------------------
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!user) setIsCheckingSession(false)
    }, 1500)
    return () => clearTimeout(timeout)
  }, [user])

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------
  const handleAuthSuccess = useCallback((userData: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = userData as any
    // Clear the logout flag so the session-sync effect can work again if needed
    didExplicitLogoutRef.current = false
    setUser(u)
    setIsCheckingSession(false)
    setCurrentPage(null)
    if (u?.address && typeof window !== 'undefined') {
      window.localStorage.setItem('stormchain-admin-wallet', u.address)
    }
  }, [])

  const handleLogout = useCallback(async () => {
    // Set flag FIRST so the sync effect doesn't re-login during Alchemy's async cleanup
    didExplicitLogoutRef.current = true
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('stormchain-admin-wallet')
    }
    // Clear user immediately for responsive UI
    setUser(null)
    // Then perform Alchemy logout (which clears SDK session)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__alchemyLogout) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (window as any).__alchemyLogout()
      } catch (err) {
        console.error('Alchemy logout error:', err)
      }
    }
  }, [])

  const handleRoleSelection = useCallback(
    async (role: 'driver' | 'developer' | 'employer', companyName?: string, dotNumber?: string) => {
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
          }),
        })
        if (res.ok) {
          setUserRole(role)
          setShowRoleSelection(false)
          setCurrentPage(null)
        } else {
          const err = await res.json().catch(() => ({}))
          alert(`Failed to set role: ${err.error || res.statusText}. Please try again.`)
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

        {/* Wallet info — top-left corner (desktop only) */}
        {walletAddress && user && (
          <div className='fixed top-4 left-4 z-[60] pointer-events-none'>
            <div className='pointer-events-auto'>
              <WalletInfo walletAddress={user.address} onClick={openModal} />
            </div>
          </div>
        )}

        {/* Global Navigation */}
        <Navigation
          isAuthenticated={!!user}
          userRole={userRole}
          onStatusClick={openModal}
          onNavigate={(page) => {
            const validPages: PageType[] = ['signin', 'resume', 'dotapp', 'jobs', 'applications', 'mvr', 'stormchain']
            const mapped = page === 'home' || page === 'hub' ? null : page as PageType
            if (page === 'home' || page === 'hub' || validPages.includes(page as PageType)) {
              setCurrentPage(mapped)
            }
          }}
          mvrWalletAddress={user?.address || null}
          stormTokens={0}
          onSwitchRole={() => setShowRoleSelection(true)}
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

        {/* Profile Setup Modal — for first-time users to add name/contact */}
        {user && walletAddress && (userRole === 'driver' || userRole === 'developer') && (
          <ProfileSetupModal
            isOpen={showProfileSetup}
            onClose={() => setShowProfileSetup(false)}
            onComplete={() => {
              setShowProfileSetup(false)
              // Reset the check flag so hub sees updated profile
              didCheckProfileRef.current = false
            }}
            walletAddress={walletAddress}
            userRole={userRole}
            userEmail={user?.email}
          />
        )}

        {/* AvA Journey Guide — global progress tracker (logged-in only) */}
        {user && (
          <>
            <AvaFloatingButton />
            <AvaJourneyGuide />
          </>
        )}

        {/* Journey Modal — guided "what's next" prompts after key actions */}
        <JourneyModal />

        {/* Main content area */}
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 mt-8 relative z-0'>

          {/* Role loading overlay */}
          {user && (isRoleLoading || isSettingRole) && !showRoleSelection && (
            <LoadingScreen
              message={isSettingRole ? 'Switching roles...' : 'Loading your dashboard...'}
            />
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

          {/* ── Driver (or unauthenticated landing) ── */}
          {(!user || userRole === 'driver' || (user && !userRole && !showRoleSelection)) &&
            !isRoleLoading && (
              <ErrorBoundary section='Driver Hub'>
                <DriverShell
                  onAuthSuccess={handleAuthSuccess}
                  onResumeUploadEvent={handleResumeUploadEvent}
                  onSetLatestResumeIpfsHash={setLatestResumeIpfsHash}
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
    return (
      <div className='min-h-screen bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center'>
        <div className='text-white text-xl'>Loading...</div>
      </div>
    )
  }

  return <HomeContent />
}

export default Home
