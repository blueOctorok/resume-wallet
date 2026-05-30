'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import StormBackground from '@/components/StormBackground'
import { Button, Card, Input, StormChainWordmark } from '@/components/ui'

function authCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`
}

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSigningUp, setIsSigningUp] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSigningUp(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: authCallbackUrl() },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // If email confirmation is off, Supabase returns a session immediately.
      if (data.session) {
        router.push('/')
        return
      }

      setSuccess('Check your email to confirm your account, then sign in.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSigningUp(false)
    }
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
              Create your Storm account
            </h1>
            <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
              Own your career data — verified and portable
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

          <form onSubmit={handleSignUp} className='space-y-4'>
            <Input
              label='Email'
              type='email'
              autoComplete='email'
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error || success) {
                  setError(null)
                  setSuccess(null)
                }
              }}
              placeholder='you@example.com'
              required
            />

            <Input
              label='Password'
              type='password'
              autoComplete='new-password'
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              placeholder='At least 8 characters'
              required
              minLength={8}
            />

            <Input
              label='Confirm password'
              type='password'
              autoComplete='new-password'
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (error) setError(null)
              }}
              placeholder='Repeat your password'
              required
              minLength={8}
            />

            <Button type='submit' className='w-full' isLoading={isSigningUp}>
              Sign up
            </Button>
          </form>

          <p className='mt-6 text-center text-sm text-gray-600 dark:text-gray-400'>
            Already have an account?{' '}
            <Link
              href='/sign-in'
              className='font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-300 dark:hover:text-teal-200'
            >
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
