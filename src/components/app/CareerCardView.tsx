'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { getBlockDefinition } from '@/lib/block-registry'
import BackToHubButton from '@/components/ui/BackToHubButton'
import ProjectedCareerCard from '@/components/career-card/ProjectedCareerCard'
import Button from '@/components/ui/Button'
import type { ProjectedCareerCard as CardData } from '@/types/career-card'
import type { PageType } from '@/stores/types'

interface CareerCardViewProps {
  onBack: () => void
}

/**
 * CareerCardView — self-view wrapper that fetches the projected career card
 * and passes it to the ProjectedCareerCard renderer.
 *
 * Replaces the old DriverCareerCardSection. Uses the new /api/career-card
 * endpoint which builds sections from hub blocks.
 */
export default function CareerCardView({ onBack }: CareerCardViewProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const openPicker = useHubBlocksStore((s) => s.openPicker)

  const [data, setData] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCard = useCallback(async (silent = false) => {
    if (!sessionUserId) return
    // `silent` keeps existing data visible while re-fetching (used by manual refresh)
    if (silent) setIsRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/career-card')
      if (!res.ok) throw new Error('Failed to load career card')
      const json = await res.json()
      setData(json.card)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [sessionUserId])

  useEffect(() => {
    fetchCard()
  }, [fetchCard])

  // Refetch when tab regains focus (silent — don't flash spinner)
  useEffect(() => {
    const handleFocus = () => fetchCard(true)
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchCard])

  const handleNavigateToBlock = useCallback((blockType: string) => {
    const def = getBlockDefinition(blockType)
    if (def?.pageRoute) {
      setCurrentPage(def.pageRoute as PageType)
    }
  }, [setCurrentPage])

  if (loading) {
    return (
      <div className='max-w-2xl mx-auto'>
        <div className='mb-6'>
          <BackToHubButton onClick={onBack} />
        </div>
        <div className='flex items-center justify-center py-20'>
          <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-gray-400' : 'text-gray-500')} />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='max-w-2xl mx-auto'>
        <div className='mb-6'>
          <BackToHubButton onClick={onBack} />
        </div>
        <div className={cn(
          'rounded-xl border p-6 text-center',
          isDark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'
        )}>
          <AlertCircle className='w-8 h-8 text-red-500 mx-auto mb-3' />
          <p className={cn('text-sm font-medium mb-1', isDark ? 'text-white' : 'text-gray-900')}>
            Failed to load your career card
          </p>
          <p className={cn('text-xs mb-4', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {error}
          </p>
          <Button variant='secondary' size='sm' onClick={fetchCard}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <BackToHubButton onClick={onBack} />
        <button
          onClick={() => fetchCard(true)}
          disabled={isRefreshing}
          title='Refresh career card'
          className={cn(
            'p-1.5 rounded-lg transition-all',
            isRefreshing ? 'opacity-50 cursor-not-allowed' : '',
            isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
          )}
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Explanation banner */}
      <div className={cn(
        'rounded-xl border p-4 mb-6',
        isDark ? 'bg-teal-500/10 border-teal-500/20' : 'bg-teal-50 border-teal-100'
      )}>
        <p className={cn('text-sm font-medium', isDark ? 'text-teal-300' : 'text-teal-800')}>
          This is your Career Card
        </p>
        <p className={cn('text-xs mt-1', isDark ? 'text-teal-400/70' : 'text-teal-600')}>
          Employers see this when searching for candidates. It reflects the features on your career card.
        </p>
      </div>

      <ProjectedCareerCard
        data={data}
        mode='self'
        onNavigateToBlock={handleNavigateToBlock}
        onAddBlock={openPicker}
        sessionUserId={sessionUserId ?? undefined}
        onAvatarUploadSuccess={() => void fetchCard(true)}
      />
    </div>
  )
}
