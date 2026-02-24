'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
import { useAvaAssistant } from '@/hooks/useAvaAssistant'
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

// Dynamic imports — global components only
const TAssistant = dynamic(
  () => import('@/components/TAssistant').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading AvA Assistant...' fullScreen={false} /> }
)

const TLoadingModal = dynamic(
  () => import('@/components/TLoadingModal').then((mod) => mod.default),
  { ssr: false }
)

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

// ============================================================
// Inner component that uses Alchemy hooks (must be inside provider)
// ============================================================
const HomeContent = () => {
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
  } = uiStore

  // AvA Assistant
  const {
    isAvaCollapsed, setIsAvaCollapsed, toggleAvaCollapse,
    avaHasUnread, setAvaHasUnread,
    avaIsWorking, avaWorkingMessage, setAvaWorking,
    helpRequest, handleHelpRequest,
    primerSeen, primerRequest, setPrimerSeen,
    triggerPrimer, handlePrimerAction, isPrimerTriggered,
    resetAvaState,
  } = useAvaAssistant({ userAddress: walletAddress ?? undefined })

  const [latestResumeIpfsHash, setLatestResumeIpfsHash] = useState<string | null>(null)
  const [resumeUploadEvent, setResumeUploadEvent] = useState<ResumeUploadEvent | null>(null)

  // Tracks whether the user explicitly signed out. Prevents the session-sync
  // effect from immediately re-logging them in while Alchemy's async cleanup runs.
  const didExplicitLogoutRef = useRef(false)

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
            if (data.profile.company) setCompanyName(data.profile.company.company_name)
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

  // Primer trigger when wallet connected
  useEffect(() => {
    if (!primerSeen && driverJourneyState.wallet.status === 'complete' && !isPrimerTriggered()) {
      triggerPrimer()
    }
  }, [driverJourneyState.wallet.status, primerSeen])

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

  const handleLogout = useCallback(() => {
    // Set flag FIRST so the sync effect doesn't re-login during Alchemy's async cleanup
    didExplicitLogoutRef.current = true
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('stormchain-admin-wallet')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__alchemyLogout) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__alchemyLogout()
    } else {
      setUser(null)
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

  const handleResumeUploadEvent = useCallback((event: ResumeUploadEvent) => {
    setResumeUploadEvent(event)
    if (event.type === 'analysis_ready' && event.data?.ipfsHash) {
      setLatestResumeIpfsHash(event.data.ipfsHash)
    }
    setTimeout(() => setResumeUploadEvent(null), 100)
  }, [])

  /**
   * T Assistant action handler - all actions dispatch to Zustand stores.
   * No callbacks into child components needed; they react to store changes.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleTAssistantAction = useCallback((action: string, data?: any) => {
    const store = useDotApplicationStore.getState()
    const ui = useUIStore.getState()

    switch (action) {
      case 'signin':
        ui.setCurrentPage('signin')
        break
      case 'resume':
      case 'resume:help':
        ui.setCurrentPage('resume')
        break
      case 'forms':
      case 'resume:prefill':
        ui.setCurrentPage('dotapp')
        store.setShowPrefillUpload(false)
        ui.setShowEmploymentVerification(false)
        break
      case 'resume:prefill:confirm':
        ui.setCurrentPage('dotapp')
        store.setShowPrefillUpload(false)
        ui.setShowEmploymentVerification(false)
        if (data) {
          if (data.form1Data) store.setForm1Data(data.form1Data)
          if (data.form2Data) store.setForm2Data(data.form2Data)
          if (data.form3Data) store.setForm3Data(data.form3Data)
          store.setHasPrefilled(true)
          store.setCurrentForm(1)
          store.incrementFormResetKey()
          // Fire-and-forget profile sync
          if (walletAddress) {
            import('@/lib/dot-form-mapper').then(({ form1ToProfile, form2ToProfile, form3ToProfile }) => {
              const profileData = {
                ...(data.form1Data ? form1ToProfile(data.form1Data) : {}),
                ...(data.form2Data ? form2ToProfile(data.form2Data) : {}),
                ...(data.form3Data ? form3ToProfile(data.form3Data) : {}),
              }
              fetch('/api/driver/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
                body: JSON.stringify({ profileData, source: 'dot_prefill' }),
              }).catch(() => {})
            })
          }
          setTimeout(() => {
            handleResumeUploadEvent({
              type: 'analysis_ready',
              step: 'prefill',
              message: "✅ Forms prefilled! I've extracted and filled in your information. Please review the forms and complete any missing fields.",
            })
          }, 500)
        }
        break
      case 'job':
      case 'jobs':
        ui.setCurrentPage('jobs')
        break
      case 'applications':
        ui.setCurrentPage('applications')
        break
      case 'dotapp':
        // Reset DOT app and navigate
        store.resetApplication()
        if (typeof window !== 'undefined') window.localStorage.removeItem('dot-application')
        ui.setCurrentPage('dotapp')
        break
      case 'hub':
      case 'home':
        ui.setCurrentPage(null)
        break
      case 'navigation':
        if (data?.page) ui.setCurrentPage(data.page as PageType)
        break
      case 'dashboard':
        ui.setCurrentPage('dotapp')
        store.setShowPrefillUpload(false)
        ui.setShowEmploymentVerification(false)
        break
      case 'primer:learn_more':
      case 'primer:skip':
        handlePrimerAction(action as 'primer:learn_more' | 'primer:skip')
        break
      default:
        break
    }
  }, [walletAddress, handleResumeUploadEvent, handlePrimerAction])

  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])

  // Compute current step for TAssistant from store state
  const getCurrentStep = useCallback(():
    | 'welcome' | 'wallet' | 'resume' | 'forms' | 'submission' | 'complete' => {
    if (dotApp.isApplicationCompleted) return 'submission'
    if (currentPage === 'dotapp' && !dotApp.showPrefillUpload) return 'forms'
    if (currentPage === 'resume' || dotApp.hasPrefilled || hubStore.hasResume) return 'resume'
    if (user) return 'wallet'
    return 'welcome'
  }, [user, currentPage, dotApp.isApplicationCompleted, dotApp.showPrefillUpload, dotApp.hasPrefilled, hubStore.hasResume])

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <AssistantBridgeProvider
      journey={driverJourneyState}
      requestHelp={handleHelpRequest}
      primerSeen={primerSeen}
      setPrimerSeen={setPrimerSeen}
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
          tHasUnread={avaHasUnread}
          onTClick={() => setIsAvaCollapsed(false)}
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
          />
        )}

        {/* T Assistant — global sidebar (logged-in only) */}
        {user && (
          <>
            <TAssistant
              currentStep={getCurrentStep()}
              onAction={handleTAssistantAction}
              userAddress={user?.address}
              userRole={userRole}
              hasResume={hubStore.hasResume}
              hasForms={dotApp.form1Data !== null || dotApp.form2Data !== null || dotApp.form3Data !== null}
              form1Data={dotApp.form1Data}
              form2Data={dotApp.form2Data}
              form3Data={dotApp.form3Data}
              journeyState={driverJourneyState}
              helpRequest={helpRequest}
              primerRequest={primerRequest}
              resumeUploadEvent={resumeUploadEvent}
              mode='sidebar'
              isCollapsed={isAvaCollapsed}
              onToggleCollapse={toggleAvaCollapse}
              onUnreadChange={setAvaHasUnread}
              onLoadingChange={(isLoading, message) => setAvaWorking(isLoading, message)}
            />
            <TLoadingModal isVisible={avaIsWorking} message={avaWorkingMessage} />
          </>
        )}

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
                  onResetAvaState={resetAvaState}
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
      <div className='min-h-screen bg-gradient-to-br from-brand-sage to-brand-mint flex items-center justify-center'>
        <div className='text-white text-xl'>Loading...</div>
      </div>
    )
  }

  return <HomeContent />
}

export default Home
