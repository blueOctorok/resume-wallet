'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * StormiCreditModal — placeholder until Stripe credit packs ship (D3 removed USDC).
 */

import { X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import type { StormiUsageInfo } from '@/lib/ava-chat'
import Button from '@/components/ui/Button'

interface StormiCreditModalProps {
  sessionUserId: string | null
  onClose: () => void
  onSuccess: (usage: StormiUsageInfo) => void
}

export default function StormiCreditModal({ onClose }: StormiCreditModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  return (
    <div className='fixed inset-0 z-[10000] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' onClick={onClose} />

      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl border shadow-2xl p-6',
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200',
        )}
      >
        <button
          onClick={onClose}
          className={cn(
            'absolute top-4 right-4 p-1.5 rounded-lg transition-colors',
            isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100',
          )}
          aria-label='Close'
        >
          <X className='w-4 h-4' />
        </button>

        <div className='flex items-center gap-3 mb-4'>
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              isDark ? 'bg-amber-500/15' : 'bg-amber-50',
            )}
          >
            <Sparkles className={cn('w-5 h-5', isDark ? 'text-amber-400' : 'text-amber-500')} />
          </div>
          <div>
            <h3 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>Stormi credits</h3>
            <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Extra chat messages beyond your daily free pool
            </p>
          </div>
        </div>

        <p className={cn('text-sm mb-6', isDark ? 'text-gray-300' : 'text-gray-600')}>
          Paid credit packs are coming soon with Stripe checkout. For now, Stormi uses your daily free message pool.
        </p>

        <Button variant='secondary' className='w-full' onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  )
}
