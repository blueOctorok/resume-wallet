'use client'

import { FolderGit2, ExternalLink, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectsData, CareerCardMode } from '@/types/career-card'

interface ProjectsSectionProps {
  data: ProjectsData
  mode: CareerCardMode
  isDark: boolean
}

export default function ProjectsSection({ data, isDark }: ProjectsSectionProps) {
  if (!data.projects.length) return null

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'
    )}>
      <div className='flex items-center gap-2 mb-3'>
        <FolderGit2 className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
        <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
          Projects
        </h3>
      </div>

      <div className='space-y-3'>
        {data.projects.map((project) => (
          <div key={project.id} className={cn(
            'rounded-lg p-3',
            isDark ? 'bg-gray-700/30' : 'bg-gray-50'
          )}>
            <div className='flex items-start justify-between gap-2'>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2'>
                  <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
                    {project.title}
                  </p>
                  {project.isFeatured && (
                    <Star className='w-3 h-3 text-yellow-500 flex-shrink-0' />
                  )}
                </div>
                {project.description && (
                  <p className={cn('text-xs mt-1 line-clamp-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {project.description}
                  </p>
                )}
              </div>
              <div className='flex items-center gap-1 flex-shrink-0'>
                {project.liveUrl && (
                  <a href={project.liveUrl} target='_blank' rel='noopener noreferrer'
                    className={cn('p-1 rounded', isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500')}>
                    <ExternalLink className='w-3.5 h-3.5' />
                  </a>
                )}
              </div>
            </div>
            {project.techStack.length > 0 && (
              <div className='flex flex-wrap gap-1 mt-2'>
                {project.techStack.map((tech) => (
                  <span key={tech} className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded',
                    isDark ? 'bg-gray-600/50 text-gray-300' : 'bg-gray-200 text-gray-600'
                  )}>
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
