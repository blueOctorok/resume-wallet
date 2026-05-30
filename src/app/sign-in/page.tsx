'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import StormBackground from '@/components/StormBackground'
import LoadingScreen from '@/components/LoadingScreen'
import { Button, Card, Input, StormChainWordmark } from '@/components/ui'

function authCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`
}

const CALLBACK_ERRORS: Record<string, string> = {
  missing_code: 'Sign-in link was invalid or expired. Please try again.',
  auth_callback: 'Could not complete sign-in. Please try again.',
}

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false)
  const [isResetLoading, setIsResetLoading] = useState(false)
  // Self-correcting guard: if an already-authenticated user lands here (e.g. the
  // page.tsx guest redirect fired during a slow session restore), bounce them
  // back to the hub instead of showing a sign-in form they don't need.
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      if (data.user) router.replace('/')
      else setCheckingSession(false)
    })
    return () => {
      active = false
    }
    // supabase client is stable for the page lifetime; intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) {
      setError(CALLBACK_ERRORS[urlError] ?? 'Sign-in failed. Please try again.')
    }
  }, [searchParams])

  const clearMessages = useCallback(() => {
    setError(null)
    setSuccess(null)
  }, [])

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()

    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    setIsSigningIn(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setError(signInError.message)
        return
      }
      router.push('/')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleGoogleSignIn = async () => {
    clearMessages()
    setIsGoogleLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: authCallbackUrl() },
      })
      if (oauthError) {
        setError(oauthError.message)
        setIsGoogleLoading(false)
      }
      // OAuth redirects away — keep loading state if redirect succeeds.
    } catch {
      setError('Could not start Google sign-in. Please try again.')
      setIsGoogleLoading(false)
    }
  }

  const handleMagicLink = async () => {
    clearMessages()

    if (!email.trim()) {
      setError('Enter your email to receive a sign-in link.')
      return
    }

    setIsMagicLinkLoading(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: authCallbackUrl() },
      })
      if (otpError) {
        setError(otpError.message)
        return
      }
      setSuccess('Check your email for a sign-in link.')
    } catch {
      setError('Could not send magic link. Please try again.')
    } finally {
      setIsMagicLinkLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    clearMessages()

    if (!email.trim()) {
      setError('Enter your email first, then click Forgot password.')
      return
    }

    setIsResetLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: authCallbackUrl() },
      )
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSuccess('Check your email for a password reset link.')
    } catch {
      setError('Could not send reset email. Please try again.')
    } finally {
      setIsResetLoading(false)
    }
  }

  if (checkingSession) {
    return <LoadingScreen message='Loading…' fullScreen />
  }

  return (
    <div className='relative min-h-screen overflow-x-hidden'>
      <StormBackground />

      <div className='relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12'>
        <div className='mb-8'>
          <StormChainWordmark size='hero' vaultChrome={false} />
        </div>

        <Card variant='elevated' className='w-full p-6 sm:p-8'>
          <div className='mb-6 text-center'>
            <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
              Sign in to Storm
            </h1>
            <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
              Build your verified career card
            </p>
          </div>

          {error ? (
            <div
              className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300'
              role='alert'
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div
              className='mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800 dark:border-teal-800/50 dark:bg-teal-950/30 dark:text-teal-200'
              role='status'
            >
              {success}
            </div>
          ) : null}

          <form onSubmit={handlePasswordSignIn} className='space-y-4'>
            <Input
              label='Email'
              type='email'
              autoComplete='email'
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error || success) clearMessages()
              }}
              placeholder='you@example.com'
              required
            />

            <Input
              label='Password'
              type='password'
              autoComplete='current-password'
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) clearMessages()
              }}
              placeholder='••••••••'
              required
            />

            <div className='flex justify-end'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                isLoading={isResetLoading}
                onClick={handleForgotPassword}
                className='text-teal-700 hover:text-teal-600 dark:text-teal-300 dark:hover:text-teal-200'
              >
                Forgot password?
              </Button>
            </div>

            <Button type='submit' className='w-full' isLoading={isSigningIn}>
              Sign in
            </Button>
          </form>

          <div className='my-6 flex items-center gap-3'>
            <div className='h-px flex-1 bg-gray-200 dark:bg-gray-700' />
            <span className='text-xs text-gray-500 dark:text-gray-400'>or</span>
            <div className='h-px flex-1 bg-gray-200 dark:bg-gray-700' />
          </div>

          <div className='space-y-3'>
            <Button
              type='button'
              variant='secondary'
              className='w-full'
              isLoading={isGoogleLoading}
              onClick={handleGoogleSignIn}
            >
              Continue with Google
            </Button>

            <Button
              type='button'
              variant='ghost'
              className='w-full'
              isLoading={isMagicLinkLoading}
              onClick={handleMagicLink}
            >
              Email me a sign-in link
            </Button>
          </div>

          <p className='mt-6 text-center text-sm text-gray-600 dark:text-gray-400'>
            Need an account?{' '}
            <Link
              href='/sign-up'
              className='font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-300 dark:hover:text-teal-200'
            >
              Sign up
            </Link>
          </p>
        </Card>

        <p className='mt-6 text-center text-sm text-gray-600 dark:text-gray-400'>
          <Link
            href='/?guided=1'
            className='font-medium text-teal-700 hover:text-teal-600 dark:text-teal-300 dark:hover:text-teal-200'
          >
            Just browsing? Explore jobs first
          </Link>
        </p>

        {/* Escape hatch for existing users still on the previous (Alchemy) login.
            Removed at the T1.12 cutover once everyone is on Supabase. */}
        <p className='mt-4 text-center text-xs text-gray-500 dark:text-gray-400'>
          <Link
            href='/?wallet=1'
            className='underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300'
          >
            Returning Storm user? Use the previous sign-in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingScreen message='Loading sign in…' fullScreen />}>
      <SignInForm />
    </Suspense>
  )
}
