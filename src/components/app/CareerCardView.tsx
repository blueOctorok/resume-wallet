'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, RefreshCw, Share2, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import BackToHubButton from '@/components/ui/BackToHubButton'
import ProjectedCareerCard from '@/components/career-card/ProjectedCareerCard'
import Button from '@/components/ui/Button'
import CareerCardShareModal from '@/components/hub/CareerCardShareModal'
import DisclosurePreferencesModal from '@/components/hub/DisclosurePreferencesModal'
import type { ProjectedCareerCard as CardData } from '@/types/career-card'

interface CareerCardViewProps {
  onBack: () => void
}

/**
 * CareerCardView — the SHOWROOM. A read-only projection of exactly what
 * employers see, plus Share. All editing lives in Build (the hub workspace):
 * no edit callbacks are passed, so ProjectedCareerCard renders zero work
 * affordances here.
 */
export default function CareerCardView({ onBack }: CareerCardViewProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)

  const [data, setData] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)

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

  if (loading) {
    return (
      <div className='max-w-2xl mx-auto'>
        <div className='mb-6'>
          <BackToHubButton onClick={onBack} label='Back to Build' />
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
          <BackToHubButton onClick={onBack} label='Back to Build' />
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
          {/* Wrap so the click event isn't passed as fetchCard's `silent` flag */}
          <Button variant='secondary' size='sm' onClick={() => fetchCard()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <div className='flex items-center justify-between gap-3 mb-6'>
        <BackToHubButton onClick={onBack} label='Back to Build' />
        <div className='flex items-center gap-2'>
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
          <Button variant='primary' size='sm' onClick={() => setShareOpen(true)}>
            <Share2 className='w-3.5 h-3.5' />
            Share
          </Button>
        </div>
      </div>

      {/* Showroom framing — the "view as employer" moment */}
      <div className={cn(
        'flex items-start gap-3 rounded-xl border p-4 mb-6',
        isDark ? 'bg-teal-500/10 border-teal-500/20' : 'bg-teal-50 border-teal-100'
      )}>
        <Eye className={cn('w-4 h-4 shrink-0 mt-0.5', isDark ? 'text-teal-300' : 'text-teal-800')} />
        <div>
          <p className={cn('text-sm font-medium', isDark ? 'text-teal-300' : 'text-teal-800')}>
            This is what employers see
          </p>
          <p className={cn('text-xs mt-1', isDark ? 'text-teal-400/70' : 'text-teal-600')}>
            A read-only preview of your card, exactly as it appears in talent search.
            To change anything, head back to Build.
          </p>
        </div>
      </div>

      <ProjectedCareerCard data={data} mode='self' sessionUserId={sessionUserId ?? undefined} />

      {sessionUserId && (
        <>
          <CareerCardShareModal
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            sessionUserId={sessionUserId}
            displayName={data.name?.trim() || undefined}
            onShareUpdated={() => void fetchCard(true)}
            onManagePrivacy={() => setDisclosureOpen(true)}
          />
          <DisclosurePreferencesModal
            isOpen={disclosureOpen}
            onClose={() => setDisclosureOpen(false)}
            zIndex={1200}
          />
        </>
      )}
    </div>
  )
}
