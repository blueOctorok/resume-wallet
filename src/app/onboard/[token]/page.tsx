'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getBlockDefinition } from '@/lib/block-registry'
import LoadingScreen from '@/components/LoadingScreen'
import { AlertCircle, Loader2 } from 'lucide-react'

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
      } catch {
        setFetchError(true)
      } finally {
        setLoading(false)
      }
    }
    
    fetchInvite()
  }, [token])

  // ─── Auth gate + post-authentication setup ──────────────────────────────────
  // Supabase is the only front door now. If there's no session, bounce to
  // /sign-in?next=<this page> so the user returns here once authenticated; the
  // session cookie then authorizes every setup fetch below.
  useEffect(() => {
    if (loading) return
    if (!inviteData?.valid) return
    if (didRedirectRef.current) return
    didRedirectRef.current = true

    async function gateAndSetup() {
      const supabase = createClient()
      const { data: { user: sessionUser } } = await supabase.auth.getUser()

      if (!sessionUser) {
        // Stash the token so we can resume this exact invite even if the
        // ?next= round-trip is lost during auth (e.g. the Supabase magic-link
        // redirect falls back to the Site URL and lands the user on `/`).
        // localStorage (not sessionStorage) so it survives the magic-link
        // opening in a NEW tab. page.tsx reads this and routes back here.
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('stormchain_invite_token', token)
        }
        // Pre-fill the sign-in email with the address the invite was sent to, so
        // the candidate doesn't have to remember which email Pace used. They can
        // still change it on the sign-in page if needed.
        const inviteEmail = inviteData!.invite.candidateEmail
        const emailParam = inviteEmail ? `&email=${encodeURIComponent(inviteEmail)}` : ''
        router.replace(`/sign-in?next=${encodeURIComponent(`/onboard/${token}`)}${emailParam}`)
        return
      }

      setRedirecting(true)

      // We have a session and are committing to setup — consume the resume token
      // so neither flow below loops back here via page.tsx.
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('stormchain_invite_token')
      }

      const targetBlockType = inviteData!.invite.targetBlockType

      try {
        // 1. Create/fetch user profile
        await fetch('/api/user/profile', {
          method: 'POST',
        })

        if (targetBlockType) {
          // ── Block-targeted flow ─────────────────────────────────────────
          // Set role to 'candidate' (universal — no more driver/developer assumption)
          await fetch('/api/user/set-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'candidate' }),
          })

          // Install the target block on the new user's hub
          await fetch('/api/hub/blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ blockType: targetBlockType }),
          })

          // Create minimal onboarding record so the hub doesn't show the onboarding form
          await fetch('/api/hub/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
              occupation: 'Invited via outreach',
              seekingReason: `Completing ${getBlockDefinition(targetBlockType)?.label ?? 'block'}`,
            }),
          })

          // Mark invite as in_progress
          await fetch(`/api/invite/${token}`, {
            method: 'POST',
          }).catch(() => {})

          // Redirect to the block's page via the onboard query param. We ALSO stash
          // the target route in sessionStorage so it survives the auth round-trip and
          // the guest-redirect hop on `/` that would otherwise strip the query string —
          // the bug where invited candidates landed on the hub instead of their block.
          // Key must stay in sync with src/app/page.tsx.
          const blockDef = getBlockDefinition(targetBlockType)
          const pageRoute = blockDef?.pageRoute
          if (pageRoute && typeof window !== 'undefined') {
            window.sessionStorage.setItem('storm_onboard_target', pageRoute)
          }
          const destination = pageRoute
            ? `/?onboard=${pageRoute}&invite=${token}`
            : `/?invite=${token}`
          
          router.push(destination)
        } else {
          // ── General flow ────────────────────────────────────────────────
          // Mark invite as in_progress
          await fetch(`/api/invite/${token}`, {
            method: 'POST',
          }).catch(() => {})

          // Land on role selection → empty hub → onboarding form (existing flow)
          router.push('/')
        }
      } catch (err) {
        console.error('Onboard setup error:', err)
        router.push('/')
      }
    }

    gateAndSetup()
  }, [loading, inviteData, token, router])

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

  // Valid invite, session check in flight: the gate effect is resolving the
  // Supabase session and will either bounce to /sign-in or run setup. Show a
  // neutral loading screen until it navigates.
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin mx-auto mb-4" />
        <p className="text-white font-medium">Checking your sign-in…</p>
      </div>
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
          Go to ZKnight
        </button>
      </div>
    </div>
  )
}
