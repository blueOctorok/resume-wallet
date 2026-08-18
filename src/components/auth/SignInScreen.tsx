'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import LoadingScreen from '@/components/LoadingScreen'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ProvvenWordmark from '@/components/ui/ProvvenWordmark'
import { GOLD_CTA, InkBand, SealDivider } from '@/components/landing/landing-shared'
import { cn } from '@/lib/utils'

/**
 * Only accept a same-origin relative path (starts with a single "/") as the
 * post-sign-in destination. Guards against open-redirect via a crafted
 * ?next=//evil.com or ?next=https://evil.com.
 */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

function authCallbackUrl(next: string): string {
  const base = `${window.location.origin}/auth/callback`
  return next === '/' ? base : `${base}?next=${encodeURIComponent(next)}`
}

const CALLBACK_ERRORS: Record<string, string> = {
  missing_code: 'Sign-in link was invalid or expired. Please try again.',
  auth_callback: 'Could not complete sign-in. Please try again.',
}

/** Ink-plane inputs — cream text on translucent navy, gold focus ring */
const INK_INPUT =
  'bg-white/[0.04] border-white/12 text-[#f4f1ea] placeholder:text-slate-500 ' +
  'focus:border-[#c99700]/55 focus:ring-[#c99700]/35 ' +
  'dark:bg-white/[0.04] dark:border-white/12 dark:text-[#f4f1ea] dark:placeholder:text-slate-500 ' +
  'dark:focus:border-[#c99700]/55 dark:focus:ring-[#c99700]/35'

const INK_LABEL = 'mb-1.5 block text-sm font-medium text-slate-300'

function SignInAtmosphere() {
  return (
    <>
      <div
        aria-hidden
        className='pointer-events-none absolute -left-32 top-[-6rem] h-[28rem] w-[28rem] rounded-full opacity-[0.12] blur-[100px]'
        style={{ background: 'radial-gradient(circle, #c99700 0%, transparent 65%)' }}
      />
      <div
        aria-hidden
        className='pointer-events-none absolute right-[-8rem] bottom-[-4rem] h-[26rem] w-[26rem] rounded-full opacity-[0.12] blur-[110px]'
        style={{ background: 'radial-gradient(circle, #3d5a8f 0%, transparent 65%)' }}
      />
    </>
  )
}

/**
 * Passwordless sign-in: Google + email OTP code only (no passwords).
 * One door for candidates and employers — role routing happens after auth.
 *
 * Visual chrome mirrors the landing hero — fixed ink-navy plane, Provven
 * wordmark, champagne gold CTAs — so the front door matches the brand.
 */
export default function SignInScreen() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const next = safeNext(searchParams.get('next'))
  const prefillEmail = searchParams.get('email') ?? ''
  const [email, setEmail] = useState(prefillEmail)
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
      // Hard navigation (see handleVerifyCode) so home boots fresh with the
      // session and avoids the dual-provider soft-nav race. replace() keeps
      // /sign-in out of history so back doesn't bounce here.
      if (data.user) window.location.replace(next)
      else setCheckingSession(false)
    })
    return () => {
      active = false
    }
    // supabase client is stable for the page lifetime; intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        options: { redirectTo: authCallbackUrl(next) },
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
        // shouldCreateUser: first-time emails get an Auth user (candidate hub by
        // default). Employer accounts are provisioned separately and already exist.
        options: { shouldCreateUser: true, emailRedirectTo: authCallbackUrl(next) },
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
      // Hard navigation (not router.push) so the home page boots fresh with the
      // new session cookie already in place. A soft nav keeps both auth providers
      // (Alchemy SDK + Supabase) alive in the same JS context, and they race over
      // "who's authenticated" — the prod-only login flicker. This matches what the
      // Google OAuth path already does (server redirect from /auth/callback) and
      // what a manual refresh does. Don't reset isVerifying: we're leaving the page.
      window.location.assign(next)
      return
    } catch {
      setError('Could not verify the code. Please try again.')
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
    <InkBand atmosphere={<SignInAtmosphere />} className='min-h-screen'>
      <div className='relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12'>
        <Link href='/' className='mb-2 block text-center transition-opacity hover:opacity-90'>
          <p className='text-5xl sm:text-6xl'>
            <ProvvenWordmark tone='ink' />
          </p>
        </Link>
        <SealDivider onInk className='mb-8 mt-4 w-40' />

        {/* Credential panel — glass on ink, gold hairline (matches landing vault chrome) */}
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.035] p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8',
            'ring-1 ring-[#c99700]/15',
          )}
        >
          <div
            aria-hidden
            className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c99700]/40 to-transparent'
          />

          <div className='mb-6 text-center'>
            <h1 className='font-display text-2xl font-medium tracking-tight text-[#f4f1ea]'>
              Log in
            </h1>
            <p className='mt-2 text-sm leading-relaxed text-slate-400'>
              Candidates and employers use the same door
            </p>
            {prefillEmail ? (
              <p className='mt-3 text-xs text-[#d4b44a]/90'>
                Use the email your invite was sent to, then we&apos;ll email you a code.
              </p>
            ) : null}
          </div>

          {error ? (
            <div
              className='mb-4 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200'
              role='alert'
            >
              {error}
            </div>
          ) : null}

          {info ? (
            <div
              className='mb-4 rounded-xl border border-[#c99700]/30 bg-[#c99700]/10 px-4 py-3 text-sm text-[#e0c56a]'
              role='status'
            >
              {info}
            </div>
          ) : null}

          {codeSent ? (
            <form onSubmit={handleVerifyCode} className='space-y-4'>
              <div>
                <label htmlFor='sign-in-code' className={INK_LABEL}>
                  Code sent to {email.trim()}
                </label>
                <Input
                  id='sign-in-code'
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
                  className={INK_INPUT}
                />
              </div>

              <Button
                type='submit'
                className={cn('w-full rounded-xl', GOLD_CTA)}
                isLoading={isVerifying}
              >
                Verify &amp; sign in
              </Button>

              <div className='flex items-center justify-between text-sm'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={resetToEmailStep}
                  className='text-slate-400 hover:text-[#f4f1ea] dark:text-slate-400 dark:hover:text-[#f4f1ea]'
                >
                  Use a different email
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  isLoading={isSendingCode}
                  onClick={() => handleSendCode({ preventDefault: () => {} } as React.FormEvent)}
                  className='text-[#d4b44a] hover:text-[#e0c56a] dark:text-[#d4b44a] dark:hover:text-[#e0c56a]'
                >
                  Resend code
                </Button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSendCode} className='space-y-4'>
                <div>
                  <label htmlFor='sign-in-email' className={INK_LABEL}>
                    Email
                  </label>
                  <Input
                    id='sign-in-email'
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
                    className={INK_INPUT}
                  />
                </div>

                <Button
                  type='submit'
                  className={cn('w-full rounded-xl', GOLD_CTA)}
                  isLoading={isSendingCode}
                >
                  Email me a sign-in code
                </Button>
              </form>

              <div className='my-6 flex items-center gap-3'>
                <span className='h-px flex-1 bg-gradient-to-r from-transparent to-white/15' />
                <span className='text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500'>
                  or
                </span>
                <span className='h-px flex-1 bg-gradient-to-l from-transparent to-white/15' />
              </div>

              <Button
                type='button'
                variant='secondary'
                className={cn(
                  'w-full rounded-xl border-white/15 bg-white/[0.04] text-[#f4f1ea]',
                  'hover:border-[#c99700]/40 hover:bg-white/[0.08]',
                  'dark:border-white/15 dark:bg-white/[0.04] dark:text-[#f4f1ea]',
                  'dark:hover:border-[#c99700]/40 dark:hover:bg-white/[0.08]',
                )}
                isLoading={isGoogleLoading}
                onClick={handleGoogleSignIn}
              >
                Continue with Google
              </Button>
            </>
          )}
        </div>

        <p className='mt-8 text-center text-sm text-slate-400'>
          <Link
            href='/?guided=1'
            className='font-medium text-[#d4b44a] transition-colors hover:text-[#e0c56a]'
          >
            Just browsing? Explore jobs first
          </Link>
        </p>
      </div>
    </InkBand>
  )
}
