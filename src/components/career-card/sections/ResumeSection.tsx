'use client'

import { FileText, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResumeData } from '@/types/career-card'
import type { CareerCardMode } from '@/types/career-card'

interface ResumeSectionProps {
  data: ResumeData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
}

export default function ResumeSection({ data, mode, isDark, onAction }: ResumeSectionProps) {
  const isVerified = data.verificationStatus === 'verified'

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'
    )}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <FileText className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            Resume
          </h3>
          {isVerified && (
            <span className='flex items-center gap-1 text-xs text-green-500'>
              <CheckCircle className='w-3 h-3' /> Verified
            </span>
          )}
        </div>
        {mode === 'self' && onAction && (
          <button
            onClick={onAction}
            className={cn(
              'text-xs px-3 py-1 rounded-lg transition-colors',
              isDark ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
            )}
          >
            Update
          </button>
        )}
      </div>

      <div className='flex items-center gap-3'>
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          isDark ? 'bg-gray-700' : 'bg-gray-100'
        )}>
          <FileText className={cn('w-5 h-5', isDark ? 'text-gray-400' : 'text-gray-500')} />
        </div>
        <div className='flex-1 min-w-0'>
          <p className={cn('text-sm font-medium truncate', isDark ? 'text-gray-200' : 'text-gray-800')}>
            {data.title || data.filename}
          </p>
          <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
            {isVerified ? 'Blockchain verified' : 'Uploaded'} {' '}
            {new Date(data.createdAt).toLocaleDateString()}
          </p>
        </div>
        {data.ipfsHash && (
          <a
            href={`https://gateway.pinata.cloud/ipfs/${data.ipfsHash}`}
            target='_blank'
            rel='noopener noreferrer'
            className={cn('p-2 rounded-lg', isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}
          >
            <ExternalLink className='w-4 h-4' />
          </a>
        )}
      </div>
    </div>
  )
}
