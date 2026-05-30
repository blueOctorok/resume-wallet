'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoadingScreen from '@/components/LoadingScreen'

/**
 * Storm is passwordless (Google + email OTP), so there is no separate sign-up:
 * entering a new email on /sign-in creates the account automatically. This page
 * exists only to redirect any stale /sign-up links to the single front door.
 */
export default function SignUpPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/sign-in')
  }, [router])

  return <LoadingScreen message='Redirecting…' fullScreen />
}
