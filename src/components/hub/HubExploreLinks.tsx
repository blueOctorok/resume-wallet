'use client'

/**
 * Quick navigation from the hub sidebar — jobs, applications, Build (DQ file).
 */

import { Briefcase, ClipboardList, LayoutGrid, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores'

export interface HubExploreLinksProps {
  onCloseDrawer?: () => void
  className?: string
}

export default function HubExploreLinks({ onCloseDrawer, className }: HubExploreLinksProps) {
  const { setCurrentPage } = useUIStore()

  const openBuild = () => {
    onCloseDrawer?.()
    setCurrentPage('build')
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className='text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
        Explore
      </p>
      <div className='flex flex-col gap-1.5'>
        <button
          type='button'
          onClick={() => {
            setCurrentPage('jobs')
            onCloseDrawer?.()
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm font-medium transition-colors',
            'bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800',
            'text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600/80',
          )}
        >
          <Briefcase className='w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0' />
          Browse jobs
        </button>
        <button
          type='button'
          onClick={() => {
            setCurrentPage('hunt-desk')
            onCloseDrawer?.()
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm font-medium transition-colors',
            'bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800',
            'text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600/80',
          )}
        >
          <LayoutGrid className='w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0' />
          Hunt Desk
        </button>
        <button
          type='button'
          onClick={() => {
            setCurrentPage('applications')
            onCloseDrawer?.()
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm font-medium transition-colors',
            'bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800',
            'text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600/80',
          )}
        >
          <ClipboardList className='w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0' />
          My applications
        </button>
        <button
          type='button'
          onClick={openBuild}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm font-medium transition-colors',
            'bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800',
            'text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600/80',
          )}
        >
          <Sparkles className='w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0' />
          File — your DQ file
        </button>
      </div>
    </div>
  )
}
