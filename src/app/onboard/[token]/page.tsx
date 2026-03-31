'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSignerStatus, useUser, useAccount, AuthCard } from '@account-kit/react'
import { getBlockDefinition } from '@/lib/block-registry'
import LoadingScreen from '@/components/LoadingScreen'
import {
  Shield,
  Users,
  Package,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface InviteData {
  valid: boolean
  invite: {
    id: string
    status: string
    type: string
    targetBlockType: string | null
    candidateEmail: string | null
    candidateName: string | null
    welcomeMessage: string | null
    expiresAt: string | null
  }
  company: { id: string; name: string } | null
  job: { id: string; title: string; description: string | null; location: string | null } | null
  invalidReason: 'expired' | 'completed' | 'cancelled' | null
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OnboardPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [fetchError, setFetchError] = useState(false)

  const { isConnected, isInitializing } = useSignerStatus()
  const user = useUser()
  const account = useAccount({ type: 'LightAccount' })

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
    if (loading || isInitializing) return
    if (!inviteData?.valid) return
    if (!isConnected || !user || !account?.address) return
    if (didRedirectRef.current) return

    didRedirectRef.current = true
    setRedirecting(true)

    async function setupAndRedirect() {
      const targetBlockType = inviteData!.invite.targetBlockType
      const walletAddress = account!.address

      try {
        // 1. Create/fetch user profile
        await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        })

        if (targetBlockType) {
          // ── Block-targeted flow ─────────────────────────────────────────
          // Set role to 'candidate' (universal — no more driver/developer assumption)
          await fetch('/api/user/set-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'candidate', walletAddress }),
          })

          // Install the target block on the new user's hub
          await fetch('/api/hub/blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
            body: JSON.stringify({ blockType: targetBlockType }),
          })

          // Create minimal onboarding record so the hub doesn't show the onboarding form
          await fetch('/api/hub/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
            body: JSON.stringify({
              occupation: 'Invited via outreach',
              seekingReason: `Completing ${getBlockDefinition(targetBlockType)?.label ?? 'block'}`,
            }),
          })

          // Mark invite as in_progress
          await fetch(`/api/invite/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress }),
          }).catch(() => {})

          // Redirect to the block's page via the onboard query param
          const blockDef = getBlockDefinition(targetBlockType)
          const pageRoute = blockDef?.pageRoute
          const destination = pageRoute
            ? `/?onboard=${pageRoute}&invite=${token}`
            : `/?invite=${token}`
          
          router.push(destination)
        } else {
          // ── General flow ────────────────────────────────────────────────
          // Mark invite as in_progress
          await fetch(`/api/invite/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress }),
          }).catch(() => {})

          // Land on role selection → empty hub → onboarding form (existing flow)
          router.push('/')
        }
      } catch (err) {
        console.error('Onboard setup error:', err)
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

  const targetBlockType = inviteData.invite.targetBlockType
  const blockDef = targetBlockType ? getBlockDefinition(targetBlockType) : null
  const company = inviteData.company

  const accentGradient = blockDef ? 'from-teal-600 to-teal-700' : 'from-slate-700 to-slate-800'
  const icon = blockDef
    ? <Package className="w-6 h-6" />
    : <Users className="w-6 h-6" />
  const label = blockDef?.label ?? 'Join Storm'
  const description = blockDef
    ? `Complete your ${blockDef.label} with blockchain-verified credentials.`
    : 'Create your Storm account and set up your professional profile.'

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-white tracking-tight">Storm</span>
          </div>
          <span className="text-xs text-gray-500">Secure Login</span>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-10">
        {/* Context card */}
        <div className="rounded-2xl overflow-hidden border border-gray-800 shadow-xl mb-6">
          <div className={`bg-gradient-to-br ${accentGradient} px-6 py-5`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-white">
                {icon}
              </div>
              <div>
                <p className="text-white/60 text-xs font-medium uppercase tracking-wide">
                  {company?.name || 'Company'}
                </p>
                <p className="text-white font-semibold">{label}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 px-6 py-4">
            <p className="text-gray-300 text-sm">{description}</p>
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

        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{' '}
          <button
            onClick={() => router.push('/')}
            className="text-teal-400 hover:text-teal-300 underline"
          >
            Go to Storm
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
          Go to Storm
        </button>
      </div>
    </div>
  )
}
