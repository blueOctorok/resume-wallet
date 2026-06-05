'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useState, useCallback } from 'react'
import { Users, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import Button from '@/components/ui/Button'
import BlockCard from '@/components/ui/BlockCard'
import HubSectionPanel from '@/components/hub/HubSectionPanel'

interface ReferralStats {
  totalReferred: number
  signedUp: number
  rewarded: number
}

export default function ReferralBanner() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
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

  if (loading || !referralCode) return null

  return (
    <HubSectionPanel isDark={isDark} accent='violet'>
      <BlockCard
        variant='embed'
        icon={Users}
        title='Refer a friend'
        description='Share your link — when they join Storm, we track the referral on your account.'
        headerActions={
          <Button
            type='button'
            variant={copied ? 'primary' : 'secondary'}
            size='sm'
            className={cn(
              'shrink-0',
              !copied &&
                isDark &&
                'border-violet-400/35 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25',
              !copied &&
                !isDark &&
                'border-violet-300/80 bg-violet-50 text-violet-900 hover:bg-violet-100',
            )}
            onClick={() => void handleCopy()}
          >
            {copied ? <Check className='w-3.5 h-3.5 shrink-0' /> : <Copy className='w-3.5 h-3.5 shrink-0' />}
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
        }
      >
        {stats && stats.totalReferred > 0 && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-4 text-xs',
              isDark ? 'text-gray-400' : 'text-slate-600',
            )}
          >
            <span>{stats.totalReferred} referred</span>
            <span>{stats.signedUp} signed up</span>
          </div>
        )}
      </BlockCard>
    </HubSectionPanel>
  )
}
