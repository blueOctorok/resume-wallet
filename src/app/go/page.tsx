'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isSafeInternalPath, stashResumePath } from '@/lib/invite-resume'

/**
 * Email CTA hop. Stashes the destination before sign-in so a magic link that
 * drops ?next= still lands the carrier on the right page (localStorage, new tab).
 */
export default function GoPage() {
  const router = useRouter()

  useEffect(() => {
    const to = new URLSearchParams(window.location.search).get('to')
    if (isSafeInternalPath(to)) stashResumePath(to)
    router.replace('/')
  }, [router])

  return null
}
