'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { paperPrimaryButtonClass, paperSecondaryButtonClass } from '@/components/hub/ResumePaperCard'
import { useDriverHubStore } from '@/stores'
import { cn } from '@/lib/utils'

const SHARE_API = '/api/career-card/share'

/**
 * Findable / hidden and Share, on the card itself.
 * The guide explains why a carrier can find the card. This row is only the switch.
 */
export default function CardVisibility({ onShare }: { onShare: () => void }) {
  const [discoverable, setDiscoverable] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const stats = useDriverHubStore((s) => s.stats)
  const statsLoading = useDriverHubStore((s) => s.isLoading)
  const companies = stats?.distinctCompaniesThisWeek ?? 0

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(SHARE_API)
        if (!res.ok) return
        const data = (await res.json()) as { discoverableToEmployers?: boolean }
        if (!cancelled) setDiscoverable(data.discoverableToEmployers === true)
      } catch {
        if (!cancelled) setDiscoverable(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setFindable = useCallback(async (next: boolean) => {
    setSaving(true)
    const previous = discoverable
    setDiscoverable(next)
    try {
      const res = await fetch(SHARE_API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoverableToEmployers: next }),
      })
      if (!res.ok) setDiscoverable(previous)
    } catch {
      setDiscoverable(previous)
    } finally {
      setSaving(false)
    }
  }, [discoverable])

  return (
    <div className='mb-5 flex flex-col gap-3 rounded-xl border border-[#173150]/10 bg-white/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between'>
      <div className='min-w-0'>
        <p className='text-[11px] font-bold uppercase tracking-[0.16em] text-[#f15a2b]'>Who can see this</p>
        <p className='mt-0.5 text-xs leading-snug text-[#173150]'>
          {discoverable === false
            ? 'Hidden. A company sees you after you apply.'
            : 'Carriers on Provven can find this card.'}
        </p>
        {!statsLoading && companies > 0 ? (
          <p className='mt-0.5 text-[11px] text-stone-500'>
            {companies} carrier{companies === 1 ? '' : 's'} viewed it this week
          </p>
        ) : null}
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          size='sm'
          variant={discoverable !== false ? 'primary' : 'secondary'}
          isLoading={saving && discoverable === true}
          disabled={saving || discoverable === null}
          onClick={() => void setFindable(true)}
          className={cn(discoverable !== false ? paperPrimaryButtonClass : paperSecondaryButtonClass)}
        >
          Findable
        </Button>
        <Button
          type='button'
          size='sm'
          variant={discoverable === false ? 'primary' : 'secondary'}
          disabled={saving || discoverable === null}
          onClick={() => void setFindable(false)}
          className={cn(discoverable === false ? paperPrimaryButtonClass : paperSecondaryButtonClass)}
        >
          Hide me
        </Button>
        <Button
          type='button'
          size='sm'
          variant='secondary'
          onClick={onShare}
          className={paperSecondaryButtonClass}
        >
          Share
        </Button>
      </div>
    </div>
  )
}
