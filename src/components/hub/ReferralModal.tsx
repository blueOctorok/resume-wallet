'use client'

import { useEffect, useState, useCallback } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'

interface ReferralStats {
  totalReferred: number
  signedUp: number
  rewarded: number
}

/**
 * Refer a friend — lives in the nav Options menu (it's account chrome, not
 * career-building work, so it no longer takes space in the Build workspace).
 */
export default function ReferralModal({ onClose }: { onClose: () => void }) {
  const sessionUserId = useAuthStore((s) => s.sessionUserId)

  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchReferral = useCallback(async () => {
    if (!sessionUserId) return
    try {
      const res = await fetch('/api/referrals')
      if (res.ok) {
        const data = await res.json()
        setReferralCode(data.referralCode)
        setStats(data.stats)
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false)
    }
  }, [sessionUserId])

  useEffect(() => {
    fetchReferral()
  }, [fetchReferral])

  const referralUrl = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${referralCode}`
    : ''

  const handleCopy = async () => {
    if (!referralUrl) return
    await navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal onClose={onClose} maxWidth='max-w-md' panelShape='block'>
      <ModalHeader
        variant='block'
        title='Refer a friend'
        subtitle='Share your link — when they join Provven, we track the referral on your account.'
        onClose={onClose}
      />

      <div className='space-y-4 p-4 sm:p-5'>
        {loading ? (
          <div className='flex justify-center py-6'>
            <Loader2 className='h-5 w-5 animate-spin text-slate-400 dark:text-gray-500' />
          </div>
        ) : !referralUrl ? (
          <p className='text-sm text-slate-600 dark:text-gray-400'>
            Your referral link isn&apos;t ready yet — check back shortly.
          </p>
        ) : (
          <>
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2',
                'border-slate-200 bg-slate-50 dark:border-gray-700 dark:bg-white/[0.04]',
              )}
            >
              <span className='min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-gray-300'>
                {referralUrl}
              </span>
              <Button
                type='button'
                variant={copied ? 'primary' : 'secondary'}
                size='sm'
                className='shrink-0'
                onClick={() => void handleCopy()}
              >
                {copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            {stats && stats.totalReferred > 0 && (
              <div className='flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-gray-400'>
                <span>{stats.totalReferred} referred</span>
                <span>{stats.signedUp} signed up</span>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
