'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import {
  Building2,
  Shield,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  UserCheck,
  LogIn,
} from 'lucide-react'
import dynamic from 'next/dynamic'

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
  const { walletAddress, user } = useAuthStore()

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

  // Fetch invite details
  const fetchInvite = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/employer/team/accept-invite?token=${token}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load invitation')
      }

      setInvite(data.invite)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchInvite()
    }
  }, [token, fetchInvite])

  // Once wallet is available after sign-in, close the sign-in view so "Accept Invitation" shows
  // (Auth store updates async, so we close when walletAddress appears instead of in the callback)
  useEffect(() => {
    if (showSignIn && walletAddress) {
      setShowSignIn(false)
    }
  }, [showSignIn, walletAddress])

  // Accept invitation
  const handleAccept = async () => {
    if (!walletAddress) {
      setShowSignIn(true)
      return
    }

    setAccepting(true)
    setError(null)

    try {
      const res = await fetch('/api/employer/team/accept-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ inviteToken: token }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept invitation')
      }

      setAccepted(true)

      // Redirect to employer hub after a short delay
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  // Handle successful sign in - store updates async; useEffect above closes modal when walletAddress appears
  const handleSignInSuccess = () => {
    // No-op here; closing sign-in view is done in useEffect when walletAddress is set
  }

  const cardClass = `rounded-2xl border shadow-xl ${
    theme === 'dark'
      ? 'bg-gray-800/90 border-gray-700'
      : 'bg-white/90 border-gray-200'
  }`

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <Loader2 className={`w-12 h-12 animate-spin mx-auto ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`} />
          <p className={`mt-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading invitation...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !invite) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <AlertCircle className='w-16 h-16 text-red-500 mx-auto' />
          <h1 className={`text-2xl font-bold mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Invalid Invitation
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            {error}
          </p>
          <button
            onClick={() => router.push('/')}
            className='mt-6 px-6 py-2.5 rounded-lg font-medium bg-brand-mint text-white hover:bg-brand-mint/90'
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // Expired invite
  if (invite?.isExpired) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <Clock className='w-16 h-16 text-yellow-500 mx-auto' />
          <h1 className={`text-2xl font-bold mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Invitation Expired
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            This invitation has expired. Please ask your team admin to send a new one.
          </p>
          <button
            onClick={() => router.push('/')}
            className='mt-6 px-6 py-2.5 rounded-lg font-medium bg-brand-mint text-white hover:bg-brand-mint/90'
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // Accepted state
  if (accepted) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <CheckCircle className='w-16 h-16 text-green-500 mx-auto' />
          <h1 className={`text-2xl font-bold mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Welcome to the Team!
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            You have joined {invite?.company.name} as {invite?.role}. Redirecting...
          </p>
        </div>
      </div>
    )
  }

  // Sign in modal - high z-index so it appears above any Account Kit UI
  if (showSignIn) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 relative z-[100] ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`${cardClass} p-8 max-w-md w-full relative z-[100]`}>
          <h1 className={`text-2xl font-bold text-center mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Sign In to Accept Invite
          </h1>
          <p className={`text-center mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Connect your wallet to join {invite?.company.name}
          </p>
          <AlchemyAuth
            onAuthSuccess={handleSignInSuccess}
          />
          {/* When already connected, show primary action to accept invite (don't rely on modal auto-close) */}
          {walletAddress && (
            <div className='mt-6 pt-6 border-t border-gray-600/50'>
              <p className={`text-center text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                You&apos;re connected. Accept the invitation to join {invite?.company.name}.
              </p>
              <button
                type='button'
                onClick={handleAccept}
                disabled={accepting}
                className='w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {accepting ? (
                  <>
                    <Loader2 className='w-5 h-5 animate-spin' />
                    Accepting...
                  </>
                ) : (
                  <>
                    <UserCheck className='w-5 h-5' />
                    Accept Invitation
                  </>
                )}
              </button>
            </div>
          )}
          <button
            onClick={() => setShowSignIn(false)}
            className={`w-full mt-4 px-4 py-2 rounded-lg font-medium ${
              theme === 'dark'
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Main invite view - high z-index so card and button sit above Account Kit / provider overlays
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative z-[100] ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className={`${cardClass} p-8 max-w-md w-full relative z-[100]`}>
        {/* Company info */}
        <div className='text-center mb-6'>
          <div className={`w-20 h-20 rounded-2xl mx-auto flex items-center justify-center ${
            theme === 'dark' ? 'bg-brand-mint/20' : 'bg-brand-sage/20'
          }`}>
            {invite?.company.logoUrl ? (
              <img
                src={invite.company.logoUrl}
                alt={invite.company.name}
                className='w-16 h-16 rounded-xl object-cover'
              />
            ) : (
              <Building2 className={`w-10 h-10 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`} />
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
        <div className={`rounded-xl p-4 mb-6 ${
          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
        }`}>
          <div className='space-y-3'>
            <div className='flex justify-between'>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Role
              </span>
              <span className={`font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {invite?.role}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Invited Email
              </span>
              <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {invite?.email}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Expires
              </span>
              <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className='mb-4 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm'>
            {error}
          </div>
        )}

        {/* Email mismatch warning */}
        {walletAddress && user?.email && invite?.email && 
          user.email.toLowerCase() !== invite.email.toLowerCase() && (
          <div className='mb-4 p-3 rounded-lg bg-yellow-500/20 text-yellow-400 text-sm'>
            <AlertCircle className='w-4 h-4 inline mr-2' />
            This invite was sent to {invite.email}. You are logged in with {user.email}.
            Please log in with the correct account.
          </div>
        )}

        {/* Action button */}
        {walletAddress ? (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className='w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-brand-mint text-white hover:bg-brand-mint/90 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {accepting ? (
              <>
                <Loader2 className='w-5 h-5 animate-spin' />
                Accepting...
              </>
            ) : (
              <>
                <UserCheck className='w-5 h-5' />
                Accept Invitation
              </>
            )}
          </button>
        ) : (
          <button
            type='button'
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowSignIn(true) }}
            className='w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-brand-mint text-white hover:bg-brand-mint/90 cursor-pointer min-h-[48px] relative z-[110] touch-manipulation select-none'
            aria-label='Connect wallet to accept invitation'
          >
            <LogIn className='w-5 h-5' />
            Connect Wallet to Accept
          </button>
        )}

        <p className={`text-center text-xs mt-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          By accepting, you agree to join this company and access their employer dashboard.
        </p>
      </div>
    </div>
  )
}
