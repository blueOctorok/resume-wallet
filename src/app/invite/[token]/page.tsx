'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { useAccount, useUser } from '@account-kit/react'
import {
  Building2,
  Shield,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  UserCheck,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { getDisplayRole } from '@/lib/employer-roles'

const AlchemyAuth = dynamic(
  () => import('@/components/AlchemyAuth').then((mod) => mod.default),
  { ssr: false }
)

interface InviteData {
  role: string
  email: string
  expiresAt: string
  isExpired: boolean
  company: {
    name: string
    logoUrl: string | null
    verified: boolean
  }
}

interface InviteActionsProps {
  invite: InviteData
  token: string
  onAccepted: () => void
  onError: (msg: string) => void
}

/**
 * Separate component so Alchemy hooks only run inside the mounted provider.
 * This is dynamically imported with ssr:false below to avoid the
 * "must be used within AlchemyAccountProvider" error during SSR / pre-mount.
 */
function InviteActions({ invite, token, onAccepted, onError }: InviteActionsProps) {
  const { theme } = useTheme()
  const account = useAccount({ type: 'LightAccount' })
  const alchemyUser = useUser()
  const router = useRouter()

  const connectedWallet = account?.address ?? null
  const connectedEmail = alchemyUser?.email ?? null

  const [accepting, setAccepting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const emailMismatch = !!(connectedEmail && invite.email &&
    connectedEmail.toLowerCase() !== invite.email.toLowerCase())

  const handleAccept = async () => {
    if (!connectedWallet) return
    setAccepting(true)
    setLocalError(null)

    try {
      const res = await fetch('/api/employer/team/accept-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': connectedWallet,
        },
        body: JSON.stringify({ inviteToken: token }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to accept invitation')

      onAccepted()
      setTimeout(() => router.push('/'), 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation'
      setLocalError(msg)
      onError(msg)
    } finally {
      setAccepting(false)
    }
  }

  // Not signed in — show Alchemy auth UI with a prompt
  if (!connectedWallet) {
    return (
      <div>
        <p className={`text-center text-sm mb-4 font-medium ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Sign in with the email this invite was sent to:
          <span className='block mt-1 text-indigo-400 font-semibold'>{invite.email}</span>
        </p>
        <AlchemyAuth />
      </div>
    )
  }

  // Signed in with the wrong email
  if (emailMismatch) {
    return (
      <div className='p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30'>
        <div className='flex items-start gap-3'>
          <AlertCircle className='w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5' />
          <div>
            <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Wrong account
            </p>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              This invite was sent to <strong>{invite.email}</strong> but you&apos;re signed in as{' '}
              <strong>{connectedEmail}</strong>. Sign out and use the invited email to continue.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Correct email — show accept button
  return (
    <div className='space-y-4'>
      <div className={`flex items-center gap-2 p-3 rounded-xl ${
        theme === 'dark'
          ? 'bg-green-500/10 border border-green-500/30'
          : 'bg-green-50 border border-green-200'
      }`}>
        <CheckCircle className='w-4 h-4 text-green-500 flex-shrink-0' />
        <p className='text-sm text-green-500 font-medium'>
          Signed in as {connectedEmail || `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`}
        </p>
      </div>

      {localError && (
        <div className='p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm'>
          {localError}
        </div>
      )}

      <button
        type='button'
        onClick={handleAccept}
        disabled={accepting}
        className='w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
      >
        {accepting ? (
          <>
            <Loader2 className='w-5 h-5 animate-spin' />
            Accepting...
          </>
        ) : (
          <>
            <UserCheck className='w-5 h-5' />
            Accept &amp; Join {invite.company.name}
          </>
        )}
      </button>
    </div>
  )
}

// Dynamically import so Alchemy hooks only run after AlchemyProvider mounts
const InviteActionsClient = dynamic(
  () => Promise.resolve(InviteActions),
  { ssr: false, loading: () => (
    <div className='flex items-center justify-center py-8'>
      <Loader2 className='w-6 h-6 animate-spin text-indigo-400' />
    </div>
  )}
)

export default function InvitePage() {
  const params = useParams()
  const token = params.token as string
  const { theme } = useTheme()

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  const fetchInvite = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/employer/team/accept-invite?token=${token}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load invitation')
      setInvite(data.invite)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) fetchInvite()
  }, [token, fetchInvite])

  const cardClass = `rounded-2xl border shadow-xl ${
    theme === 'dark' ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-200'
  }`
  const bg = theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <Loader2 className='w-12 h-12 animate-spin mx-auto text-brand-mint' />
          <p className={`mt-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading invitation...
          </p>
        </div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <AlertCircle className='w-16 h-16 text-red-500 mx-auto' />
          <h1 className={`text-2xl font-bold mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Invalid Invitation
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
        </div>
      </div>
    )
  }

  if (invite?.isExpired) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <Clock className='w-16 h-16 text-yellow-500 mx-auto' />
          <h1 className={`text-2xl font-bold mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Invitation Expired
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Please ask your company admin to send a new invitation.
          </p>
        </div>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <CheckCircle className='w-16 h-16 text-green-500 mx-auto' />
          <h1 className={`text-2xl font-bold mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Welcome to the Team!
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            You have joined {invite?.company.name} as {getDisplayRole(invite?.role ?? null)}. Redirecting...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
      <div className={`${cardClass} p-8 max-w-md w-full`}>

        {/* Company header */}
        <div className='text-center mb-6'>
          <div className={`w-20 h-20 rounded-2xl mx-auto flex items-center justify-center ${
            theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100'
          }`}>
            {invite?.company.logoUrl ? (
              <img src={invite.company.logoUrl} alt={invite.company.name} className='w-16 h-16 rounded-xl object-cover' />
            ) : (
              <Building2 className='w-10 h-10 text-indigo-400' />
            )}
          </div>
          <h1 className={`text-2xl font-bold mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Join {invite?.company.name}
          </h1>
          {invite?.company.verified && (
            <div className='flex items-center justify-center gap-1 mt-1'>
              <Shield className='w-4 h-4 text-green-500' />
              <span className='text-sm text-green-500'>Verified Company</span>
            </div>
          )}
        </div>

        {/* Invite details */}
        <div className={`rounded-xl p-4 mb-6 space-y-2 ${
          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
        }`}>
          <div className='flex justify-between'>
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Role</span>
            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {getDisplayRole(invite?.role ?? null)}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Invited Email</span>
            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {invite?.email}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Expires</span>
            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : '-'}
            </span>
          </div>
        </div>

        {/* Auth/accept actions — client-only so Alchemy hooks are safe */}
        {invite && (
          <InviteActionsClient
            invite={invite}
            token={token}
            onAccepted={() => setAccepted(true)}
            onError={setError}
          />
        )}

        <p className={`text-center text-xs mt-6 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          By accepting, you agree to join this company and access their employer dashboard.
        </p>
      </div>
    </div>
  )
}
