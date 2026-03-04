'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSignerStatus, useUser, useAccount, AuthCard } from '@account-kit/react'
import LoadingScreen from '@/components/LoadingScreen'
import {
  Shield,
  Car,
  Code,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type InviteType = 'driver_dot' | 'developer_card' | 'general'

interface InviteData {
  valid: boolean
  invite: {
    id: string
    status: string
    type: InviteType
    candidateEmail: string | null
    candidateName: string | null
    welcomeMessage: string | null
    expiresAt: string | null
  }
  company: { id: string; name: string } | null
  job: { id: string; title: string; description: string | null; location: string | null } | null
  invalidReason: 'expired' | 'completed' | 'cancelled' | null
}

// ─── Per-type config ─────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  driver_dot: {
    accent: 'from-teal-600 to-teal-700',
    icon: <Car className="w-6 h-6" />,
    label: 'DOT Application',
    roleHint: 'driver',
    postAuthPage: 'dot-application', // Maps to 'dotapp' PageType in main app
    description: "Complete your DOT driver application with blockchain-verified credentials.",
  },
  developer_card: {
    accent: 'from-indigo-600 to-violet-700',
    icon: <Code className="w-6 h-6" />,
    label: 'Career Card',
    roleHint: 'developer',
    postAuthPage: 'developer-profile', // Maps to 'resume' PageType in main app
    description: "Set up your verified developer career card to showcase your skills.",
  },
  general: {
    accent: 'from-slate-700 to-slate-800',
    icon: <Users className="w-6 h-6" />,
    label: 'Join StormChain',
    roleHint: null, // User picks their role after login
    postAuthPage: null,
    description: "Create your StormChain account and choose your professional path.",
  },
} as const

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OnboardPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  // Invite data state
  const [loading, setLoading] = useState(true)
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [fetchError, setFetchError] = useState(false)

  // Auth state from Alchemy
  const { isConnected, isInitializing } = useSignerStatus()
  const user = useUser()
  const account = useAccount({ type: 'LightAccount' })

  // Track if we've already triggered post-auth flow
  const didRedirectRef = useRef(false)
  const [redirecting, setRedirecting] = useState(false)

  // ─── Fetch invite on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    
    async function fetchInvite() {
      try {
        setLoading(true)
        const res = await fetch(`/api/invite/${token}`)
        if (!res.ok) {
          setFetchError(true)
          return
        }
        const data = await res.json()
        setInviteData(data)

        // Store token in session for the main app to pick up
        sessionStorage.setItem('stormchain_invite_token', token)
      } catch {
        setFetchError(true)
      } finally {
        setLoading(false)
      }
    }
    
    fetchInvite()
  }, [token])

  // ─── Handle post-authentication redirect ────────────────────────────────────
  useEffect(() => {
    // Wait until we have invite data and auth is ready
    if (loading || isInitializing) return
    if (!inviteData?.valid) return
    if (!isConnected || !user || !account?.address) return
    if (didRedirectRef.current) return

    // User is authenticated — set up their role and redirect
    didRedirectRef.current = true
    setRedirecting(true)

    async function setupAndRedirect() {
      const type = inviteData!.invite.type || 'driver_dot'
      const cfg = TYPE_CONFIG[type]
      const walletAddress = account!.address

      try {
        // 1. Create/fetch user profile
        await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        })

        // 2. If we have a role hint (driver/developer), set it
        if (cfg.roleHint) {
          await fetch('/api/user/set-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: cfg.roleHint,
              walletAddress,
            }),
          })
        }

        // 3. Mark invite as in_progress
        await fetch(`/api/invite/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch(() => {})

        // 4. Redirect to the appropriate page
        // Use a query param so the main app knows to show the right view
        const destination = cfg.postAuthPage
          ? `/?onboard=${cfg.postAuthPage}&invite=${token}`
          : '/'
        
        router.push(destination)
      } catch (err) {
        console.error('Onboard setup error:', err)
        // Fallback: just go home
        router.push('/')
      }
    }

    setupAndRedirect()
  }, [loading, isInitializing, isConnected, user, account, inviteData, token, router])

  // ─── Loading states ─────────────────────────────────────────────────────────

  if (loading) {
    return <LoadingScreen message="Loading your invite..." />
  }

  if (fetchError || !inviteData) {
    return (
      <ErrorScreen
        title="Invite Not Found"
        message="This link is not valid or has been removed."
        onGoHome={() => router.push('/')}
      />
    )
  }

  if (!inviteData.valid) {
    const reasons = {
      expired: { title: 'Invite Expired', msg: 'This invite has expired. Contact the company for a new link.' },
      completed: { title: 'Already Completed', msg: 'You have already completed this invitation.' },
      cancelled: { title: 'Invite Cancelled', msg: 'This invite has been cancelled by the company.' },
    }
    const r = inviteData.invalidReason || 'expired'
    return (
      <ErrorScreen
        title={reasons[r]?.title || 'Invalid Invite'}
        message={reasons[r]?.msg || 'This invite is no longer valid.'}
        companyName={inviteData.company?.name}
        onGoHome={() => router.push('/')}
      />
    )
  }

  // ─── Redirecting state ──────────────────────────────────────────────────────

  if (redirecting) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-teal-400 animate-spin mx-auto mb-4" />
          <p className="text-white font-medium">Setting up your account...</p>
          <p className="text-gray-500 text-sm mt-1">This will only take a moment</p>
        </div>
      </div>
    )
  }

  // ─── Main render: invite info + auth card ───────────────────────────────────

  const type = inviteData.invite.type || 'driver_dot'
  const cfg = TYPE_CONFIG[type]
  const company = inviteData.company

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-white tracking-tight">StormChain</span>
          </div>
          <span className="text-xs text-gray-500">Secure Login</span>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-10">
        {/* Context card */}
        <div className={`rounded-2xl overflow-hidden border border-gray-800 shadow-xl mb-6`}>
          <div className={`bg-gradient-to-br ${cfg.accent} px-6 py-5`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-white">
                {cfg.icon}
              </div>
              <div>
                <p className="text-white/60 text-xs font-medium uppercase tracking-wide">
                  {company?.name || 'Company'}
                </p>
                <p className="text-white font-semibold">{cfg.label}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 px-6 py-4">
            <p className="text-gray-300 text-sm">{cfg.description}</p>
          </div>
        </div>

        {/* Auth section */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            Sign in to continue
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter your email to create your secure account. No password needed — we&apos;ll send you a verification code.
          </p>

          {/* Show loading state while Alchemy initializes */}
          {isInitializing ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Preparing secure login...</p>
            </div>
          ) : (
            <div className="[&_*]:!font-sans">
              <AuthCard />
            </div>
          )}

          {/* Trust indicators */}
          <div className="mt-6 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-teal-500" />
                No password required
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-500" />
                Blockchain secured
              </div>
            </div>
          </div>
        </div>

        {/* Already have an account? */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{' '}
          <button
            onClick={() => router.push('/')}
            className="text-teal-400 hover:text-teal-300 underline"
          >
            Go to StormChain
          </button>
        </p>
      </main>
    </div>
  )
}

// ─── Error screen component ──────────────────────────────────────────────────

function ErrorScreen({
  title,
  message,
  companyName,
  onGoHome,
}: {
  title: string
  message: string
  companyName?: string
  onGoHome: () => void
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 text-center">
        <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
        <p className="text-gray-400 mb-1">{message}</p>
        {companyName && (
          <p className="text-gray-500 text-sm mt-2">Company: {companyName}</p>
        )}
        <button
          onClick={onGoHome}
          className="mt-6 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-colors"
        >
          Go to StormChain
        </button>
      </div>
    </div>
  )
}
