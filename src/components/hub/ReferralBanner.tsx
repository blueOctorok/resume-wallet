'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'

interface ReferralStats {
  totalReferred: number
  signedUp: number
  rewarded: number
}

export default function ReferralBanner() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)

  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchReferral = useCallback(async () => {
    if (!walletAddress) return
    try {
      const res = await fetch('/api/referrals', {
        headers: { 'x-wallet-address': walletAddress },
      })
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
  }, [walletAddress])

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

  const stormEarned = (stats?.rewarded ?? 0) * 2.5

  return (
    <div className={cn(
      'rounded-2xl border p-5 space-y-3',
      isDark
        ? 'bg-gradient-to-r from-purple-500/10 via-gray-800/50 to-gray-800/50 border-purple-500/20'
        : 'bg-gradient-to-r from-purple-50 via-white/70 to-white/70 border-purple-200/60',
    )}>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
            isDark ? 'bg-purple-500/20' : 'bg-purple-100'
          )}>
            <Users className={cn('w-5 h-5', isDark ? 'text-purple-400' : 'text-purple-600')} />
          </div>
          <div>
            <p className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Refer &amp; Earn STORM
            </p>
            <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
              You both earn 2.5 STORM when they complete their first paid action
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors sm:flex-shrink-0',
            copied
              ? 'bg-green-500 text-white'
              : isDark
                ? 'bg-purple-500 text-white hover:bg-purple-400'
                : 'bg-purple-600 text-white hover:bg-purple-500',
          )}
        >
          {copied ? <Check className='w-3.5 h-3.5' /> : <Copy className='w-3.5 h-3.5' />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Stats row */}
      {stats && stats.totalReferred > 0 && (
        <div className={cn(
          'flex items-center gap-4 text-xs pt-1',
          isDark ? 'text-gray-400' : 'text-gray-500'
        )}>
          <span>{stats.totalReferred} referred</span>
          <span>{stats.rewarded} rewarded</span>
          {stormEarned > 0 && (
            <span className={cn('font-semibold', isDark ? 'text-purple-400' : 'text-purple-600')}>
              +{stormEarned} STORM earned
            </span>
          )}
        </div>
      )}
    </div>
  )
}
