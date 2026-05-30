'use client'

import { Suspense, useEffect, useState } from 'react'
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

/**
 * Passwordless sign-in: Google + email OTP code only (no passwords).
 *
 * This mirrors the previous Alchemy experience (Google or an emailed code) so
 * existing users feel at home, and it keeps Storm out of the password-reset
 * helpdesk business. The same flow handles sign-up and sign-in — entering an
 * email that has no account yet creates one (`shouldCreateUser: true`).
 */
function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
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

  const handleGoogleSignIn = async () => {
    setError(null)
    setInfo(null)
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
      // OAuth redirects away — keep the loading state if the redirect succeeds.
    } catch {
      setError('Could not start Google sign-in. Please try again.')
      setIsGoogleLoading(false)
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!email.trim()) {
      setError('Enter your email to get a sign-in code.')
      return
    }

    setIsSendingCode(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        // shouldCreateUser makes this double as sign-up for new emails.
        // emailRedirectTo covers users who click the link instead of typing the code.
        options: { shouldCreateUser: true, emailRedirectTo: authCallbackUrl() },
      })
      if (otpError) {
        setError(otpError.message)
        return
      }
      setCodeSent(true)
      setInfo('We emailed you a 6-digit code. Enter it below to sign in.')
    } catch {
      setError('Could not send a code. Please try again.')
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const token = code.trim()
    if (token.length < 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }

    setIsVerifying(true)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'email',
      })
      if (verifyError) {
        setError(verifyError.message)
        return
      }
      router.push('/')
    } catch {
      setError('Could not verify the code. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const resetToEmailStep = () => {
    setCodeSent(false)
    setCode('')
    setError(null)
    setInfo(null)
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

          {info ? (
            <div
              className='mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800 dark:border-teal-800/50 dark:bg-teal-950/30 dark:text-teal-200'
              role='status'
            >
              {info}
            </div>
          ) : null}

          {codeSent ? (
            <form onSubmit={handleVerifyCode} className='space-y-4'>
              <Input
                label={`Code sent to ${email.trim()}`}
                type='text'
                inputMode='numeric'
                autoComplete='one-time-code'
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''))
                  if (error) setError(null)
                }}
                placeholder='123456'
                autoFocus
                required
              />

              <Button type='submit' className='w-full' isLoading={isVerifying}>
                Verify &amp; sign in
              </Button>

              <div className='flex items-center justify-between text-sm'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={resetToEmailStep}
                >
                  Use a different email
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  isLoading={isSendingCode}
                  onClick={() => handleSendCode({ preventDefault: () => {} } as React.FormEvent)}
                >
                  Resend code
                </Button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSendCode} className='space-y-4'>
                <Input
                  label='Email'
                  type='email'
                  autoComplete='email'
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error || info) {
                      setError(null)
                      setInfo(null)
                    }
                  }}
                  placeholder='you@example.com'
                  autoFocus
                  required
                />

                <Button type='submit' className='w-full' isLoading={isSendingCode}>
                  Email me a sign-in code
                </Button>
              </form>

              <div className='my-6 flex items-center gap-3'>
                <div className='h-px flex-1 bg-gray-200 dark:bg-gray-700' />
                <span className='text-xs text-gray-500 dark:text-gray-400'>or</span>
                <div className='h-px flex-1 bg-gray-200 dark:bg-gray-700' />
              </div>

              <Button
                type='button'
                variant='secondary'
                className='w-full'
                isLoading={isGoogleLoading}
                onClick={handleGoogleSignIn}
              >
                Continue with Google
              </Button>
            </>
          )}
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
