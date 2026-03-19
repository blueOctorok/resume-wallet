'use client'

import { Globe, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PortfolioData, CareerCardMode } from '@/types/career-card'

const isSafePreviewUrl = (url: string) => /^https?:\/\//i.test(url.trim())

interface PortfolioSectionProps {
  data: PortfolioData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
}

export default function PortfolioSection({ data, mode, isDark, onAction }: PortfolioSectionProps) {
  if (!data.portfolioUrl) {
    if (mode !== 'self') return null
    return (
      <div className={cn(
        'rounded-xl border border-dashed p-4',
        isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-white/40 border-gray-400/50'
      )}>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Globe className={cn('w-4 h-4', isDark ? 'text-gray-500' : 'text-gray-400')} />
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
              No portfolio URL set
            </p>
          </div>
          {onAction && (
            <button
              onClick={onAction}
              className={cn(
                'text-xs px-3 py-1 rounded-lg transition-colors',
                isDark ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
              )}
            >
              Add
            </button>
          )}
        </div>
      </div>
    )
  }

  const url = data.portfolioUrl.trim()
  const showPreview = isSafePreviewUrl(url)

  return (
    <div className={cn(
      'rounded-xl p-4',
      isDark ? 'bg-gray-700/50' : 'bg-white/60'
    )}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <Globe className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            Portfolio
          </h3>
        </div>
        <a
          href={url}
          target='_blank'
          rel='noopener noreferrer'
          className={cn('p-1.5 rounded-lg', isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500')}
        >
          <ExternalLink className='w-4 h-4' />
        </a>
      </div>
      <p className={cn('text-xs truncate', isDark ? 'text-gray-400' : 'text-gray-600')}>
        {url}
      </p>
      {showPreview && (
        <div className='mt-3 rounded-lg border overflow-hidden bg-white'>
          <iframe
            src={url}
            title='Portfolio preview'
            className='w-full h-[320px] border-0'
            sandbox='allow-scripts allow-same-origin allow-forms'
          />
        </div>
      )}
    </div>
  )
}
