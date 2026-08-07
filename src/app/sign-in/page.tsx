'use client'

import { Suspense } from 'react'
import LoadingScreen from '@/components/LoadingScreen'
import SignInScreen from '@/components/auth/SignInScreen'

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingScreen message='Loading sign in…' fullScreen />}>
      <SignInScreen />
    </Suspense>
  )
}
