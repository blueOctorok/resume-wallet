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

// AlchemyAuth renders the sign-in UI (email OTP, social, etc.)
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

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const { theme } = useTheme()

  // Use Alchemy hooks directly — auth store is only populated via page.tsx flow
  const account = useAccount({ type: 'LightAccount' })
  const alchemyUser = useUser()

  // The connected wallet address from Alchemy (null if not signed in)
  const connectedWallet = account?.address ?? null
  const connectedEmail = alchemyUser?.email ?? null

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
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

  const handleAccept = async () => {
    if (!connectedWallet) return

    setAccepting(true)
    setError(null)

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

      setAccepted(true)
      setTimeout(() => router.push('/'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  const cardClass = `rounded-2xl border shadow-xl ${
    theme === 'dark'
      ? 'bg-gray-800/90 border-gray-700'
      : 'bg-white/90 border-gray-200'
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
          <button
            onClick={() => router.push('/')}
            className='mt-6 px-6 py-2.5 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700'
          >
            Go to Home
          </button>
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
            This invitation has expired. Please ask your company admin to send a new one.
          </p>
          <button
            onClick={() => router.push('/')}
            className='mt-6 px-6 py-2.5 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700'
          >
            Go to Home
          </button>
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

  // Email mismatch: the connected email doesn't match the invite email
  const emailMismatch = connectedEmail && invite?.email &&
    connectedEmail.toLowerCase() !== invite.email.toLowerCase()

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
        <div className={`rounded-xl p-4 mb-6 space-y-2 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
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

        {/* Error message */}
        {error && (
          <div className='mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm'>
            {error}
          </div>
        )}

        {/* State: not signed in → show auth UI */}
        {!connectedWallet && (
          <div>
            <p className={`text-center text-sm mb-4 font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Sign in with the email address this invite was sent to:
              <span className='block mt-1 text-indigo-400 font-semibold'>{invite?.email}</span>
            </p>
            <AlchemyAuth />
          </div>
        )}

        {/* State: signed in with wrong email → show warning */}
        {connectedWallet && emailMismatch && (
          <div className='p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 mb-4'>
            <div className='flex items-start gap-3'>
              <AlertCircle className='w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5' />
              <div>
                <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Wrong account signed in
                </p>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  This invite was sent to <strong>{invite?.email}</strong> but you&apos;re signed in as <strong>{connectedEmail}</strong>.
                  Sign out and use the invited email to continue.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* State: signed in with correct email → show Accept button */}
        {connectedWallet && !emailMismatch && (
          <div>
            <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${
              theme === 'dark' ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'
            }`}>
              <CheckCircle className='w-4 h-4 text-green-500 flex-shrink-0' />
              <p className='text-sm text-green-500 font-medium'>
                Signed in as {connectedEmail || connectedWallet.slice(0, 6) + '...' + connectedWallet.slice(-4)}
              </p>
            </div>
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
                  Accept &amp; Join {invite?.company.name}
                </>
              )}
            </button>
          </div>
        )}

        <p className={`text-center text-xs mt-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          By accepting, you agree to join this company and access their employer dashboard.
        </p>
      </div>
    </div>
  )
}
