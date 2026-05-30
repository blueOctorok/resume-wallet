'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { createClient } from '@/utils/supabase/client'
import {
  Building2,
  Shield,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  UserCheck,
} from 'lucide-react'
import { getDisplayRole } from '@/lib/employer-roles'

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
 * Accept-invite actions. Auth is the Supabase session: if the visitor isn't
 * signed in we bounce them to /sign-in?next=/invite/<token> and they return
 * here. The accept-invite route resolves identity from the session cookie
 * (getStormUserIdFromRequest), so no wallet header is needed.
 */
function InviteActions({ invite, token, onAccepted, onError }: InviteActionsProps) {
  const { theme } = useTheme()
  const router = useRouter()

  const [sessionChecked, setSessionChecked] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')

  // Auth gate: no session → front door (and back here afterward).
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`)
        return
      }
      setSessionEmail(data.user.email ?? null)
      setSessionChecked(true)
    })
  }, [router, token])

  const emailMismatch = !!(sessionEmail && invite.email &&
    sessionEmail.toLowerCase() !== invite.email.toLowerCase())

  const handleAccept = async () => {
    if (!displayName.trim()) {
      setLocalError('Please enter your name')
      return
    }
    setAccepting(true)
    setLocalError(null)

    try {
      const res = await fetch('/api/employer/team/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken: token, displayName: displayName.trim() }),
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

  // Resolving the session (or redirecting to /sign-in).
  if (!sessionChecked) {
    return (
      <div className='flex items-center justify-center py-8'>
        <Loader2 className='w-6 h-6 animate-spin text-indigo-400' />
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
            <p className={`font-medium text-sm ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
              Wrong account
            </p>
            <p className={`text-sm mt-1 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
              This invite was sent to <strong>{invite.email}</strong> but you&apos;re signed in as{' '}
              <strong>{sessionEmail}</strong>. Sign out and use the invited email to continue.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Correct email — show name input and accept button
  return (
    <div className='space-y-4'>
      <div className={`flex items-center gap-2 p-3 rounded-xl ${
        isDarkTheme(theme)
          ? 'bg-green-500/10 border border-green-500/30'
          : 'bg-green-50 border border-green-200'
      }`}>
        <CheckCircle className='w-4 h-4 text-green-500 flex-shrink-0' />
        <p className='text-sm text-green-500 font-medium'>
          Signed in as {sessionEmail || 'your account'}
        </p>
      </div>

      {/* Name input for new team member */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Your Name
        </label>
        <input
          type='text'
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder='Enter your full name'
          className={`w-full px-4 py-3 rounded-xl border transition-colors ${
            isDarkTheme(theme)
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
          } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
        />
        <p className={`text-xs mt-1.5 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
          This is how you&apos;ll appear to other team members
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
        disabled={accepting || !displayName.trim()}
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
    isDarkTheme(theme) ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-200'
  }`
  const bg = isDarkTheme(theme) ? 'bg-gray-900' : 'bg-gray-50'

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <Loader2 className='w-12 h-12 animate-spin mx-auto text-teal-600 dark:text-teal-400' />
          <p className={`mt-4 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
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
          <h1 className={`text-2xl font-bold mt-4 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            Invalid Invitation
          </h1>
          <p className={`mt-2 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
        </div>
      </div>
    )
  }

  if (invite?.isExpired) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
        <div className={`${cardClass} p-8 text-center max-w-md w-full`}>
          <Clock className='w-16 h-16 text-yellow-500 mx-auto' />
          <h1 className={`text-2xl font-bold mt-4 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            Invitation Expired
          </h1>
          <p className={`mt-2 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
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
          <h1 className={`text-2xl font-bold mt-4 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            Welcome to the Team!
          </h1>
          <p className={`mt-2 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
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
            isDarkTheme(theme) ? 'bg-indigo-500/20' : 'bg-indigo-100'
          }`}>
            {invite?.company.logoUrl ? (
              <img src={invite.company.logoUrl} alt={invite.company.name} className='w-16 h-16 rounded-xl object-cover' />
            ) : (
              <Building2 className='w-10 h-10 text-indigo-400' />
            )}
          </div>
          <h1 className={`text-2xl font-bold mt-4 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
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
          isDarkTheme(theme) ? 'bg-gray-700/50' : 'bg-gray-100'
        }`}>
          <div className='flex justify-between'>
            <span className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}>Role</span>
            <span className={`font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
              {getDisplayRole(invite?.role ?? null)}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}>Invited Email</span>
            <span className={`font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
              {invite?.email}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}>Expires</span>
            <span className={`font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
              {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : '-'}
            </span>
          </div>
        </div>

        {/* Auth/accept actions — gated on the Supabase session */}
        {invite && (
          <InviteActions
            invite={invite}
            token={token}
            onAccepted={() => setAccepted(true)}
            onError={setError}
          />
        )}

        <p className={`text-center text-xs mt-6 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
          By accepting, you agree to join this company and access their employer dashboard.
        </p>
      </div>
    </div>
  )
}
