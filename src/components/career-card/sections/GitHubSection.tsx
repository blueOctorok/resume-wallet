'use client'

import { Github, ExternalLink, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GitHubData, CareerCardMode } from '@/types/career-card'

interface GitHubSectionProps {
  data: GitHubData
  mode: CareerCardMode
  isDark: boolean
}

export default function GitHubSection({ data, isDark }: GitHubSectionProps) {
  if (!data.username) return null

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'
    )}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <Github className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            GitHub
          </h3>
        </div>
        <a
          href={`https://github.com/${data.username}`}
          target='_blank'
          rel='noopener noreferrer'
          className={cn('p-1.5 rounded-lg', isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}
        >
          <ExternalLink className='w-4 h-4' />
        </a>
      </div>

      <div className='flex items-center gap-3 mb-3'>
        {data.avatarUrl && (
          <img src={data.avatarUrl} alt={data.username} className='w-8 h-8 rounded-full' />
        )}
        <div>
          <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
            @{data.username}
          </p>
          {data.publicRepos > 0 && (
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {data.publicRepos} repos &middot; {data.followers} followers
            </p>
          )}
        </div>
      </div>

      {data.topRepos.length > 0 && (
        <div className='space-y-2'>
          {data.topRepos.slice(0, 3).map((repo) => (
            <a
              key={repo.name}
              href={repo.url}
              target='_blank'
              rel='noopener noreferrer'
              className={cn(
                'block rounded-lg p-2 transition-colors',
                isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
              )}
            >
              <div className='flex items-center justify-between'>
                <p className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  {repo.name}
                </p>
                {repo.stars > 0 && (
                  <span className='flex items-center gap-0.5 text-xs text-yellow-500'>
                    <Star className='w-3 h-3' /> {repo.stars}
                  </span>
                )}
              </div>
              {repo.language && (
                <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  {repo.language}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
