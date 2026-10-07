'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'

const SHARE_API = '/api/career-card/share'

/**
 * One-time notice. New sign-ups are findable (migration 115). This strip
 * tells them that and lets them hide. Either answer marks the prompt seen.
 */
export default function DiscoverabilityPrompt({ isDark }: { isDark: boolean }) {
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(SHARE_API)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.discoverablePromptSeen !== true) setVisible(true)
      } catch {
        /* hub still works without the prompt */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const answer = useCallback(async (findable: boolean) => {
    setSaving(true)
    try {
      const res = await fetch(SHARE_API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoverableToEmployers: findable }),
      })
      if (res.ok) setVisible(false)
    } catch {
      /* leave the strip up so they can retry */
    } finally {
      setSaving(false)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        isDark ? 'border-teal-400/25 bg-teal-500/10' : 'border-teal-200 bg-teal-50/80',
      )}
    >
      <p className={cn('text-sm font-medium', isDark ? 'text-gray-100' : 'text-slate-900')}>
        Carriers on Provven can find your card. You can hide it if you would rather they only see you after you apply.
      </p>
      <div className='flex flex-wrap gap-2'>
        <Button type='button' variant='primary' size='sm' isLoading={saving} onClick={() => void answer(true)}>
          Stay findable
        </Button>
        <Button type='button' variant='secondary' size='sm' disabled={saving} onClick={() => void answer(false)}>
          Hide me
        </Button>
      </div>
    </div>
  )
}
