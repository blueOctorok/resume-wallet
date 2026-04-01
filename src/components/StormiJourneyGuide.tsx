'use client'

import { useEffect, useRef } from 'react'
import { X, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJourneyStore, useJourneyProgress, useAuthStore } from '@/stores'
import { useUIStore } from '@/stores'
import type { PageType } from '@/stores/types'
import HubSidebar from '@/components/hub/HubSidebar'
import EmployerPathSidebar from '@/components/hub/EmployerPathSidebar'

/**
 * Slide-over panel: same career/job path rail as desktop.
 * Cmd+/ toggles; used on mobile / when “Open Journey” opens the drawer.
 */
export default function StormiJourneyGuide() {
  const { isGuideOpen, closeGuide, toggleGuide } = useJourneyStore()
  const progress = useJourneyProgress()
  const userRole = useAuthStore((s) => s.userRole)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        toggleGuide()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleGuide])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isGuideOpen) closeGuide()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isGuideOpen, closeGuide])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeGuide()
      }
    }
    if (isGuideOpen) {
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isGuideOpen, closeGuide])

  if (!isGuideOpen) return null

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40',
          'bg-black/20 dark:bg-black/40',
          'backdrop-blur-sm',
          'transition-opacity duration-300',
        )}
        aria-hidden='true'
      />

      <div
        ref={panelRef}
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50',
          // min-w-0 + overflow-x-hidden: iOS/WebKit won’t let vault drop-shadows / wide flex children widen the page
          'flex min-w-0 max-w-full flex-col overflow-x-hidden',
          'w-full max-w-md',
          'bg-white dark:bg-gray-900',
          'border-l border-gray-200 dark:border-gray-700',
          'shadow-2xl',
          'transform transition-transform duration-300 ease-out',
          isGuideOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role='dialog'
        aria-modal='true'
        aria-label='Stormi Journey Guide'
      >
        <div className='min-w-0 flex-shrink-0 border-b border-gray-200 bg-gradient-to-r from-teal-500/12 to-transparent p-6 dark:border-gray-700 dark:from-teal-400/10'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex min-w-0 items-center gap-3'>
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full',
                  'bg-gradient-to-br from-teal-600 to-cyan-600',
                  'shadow-lg shadow-teal-600/30 dark:shadow-teal-400/20',
                )}
              >
                <Bot className='w-6 h-6 text-white' />
              </div>
              <div className='min-w-0'>
                <h2 className='text-lg font-bold text-gray-900 dark:text-white'>
                  {userRole === 'employer' ? 'Your job path' : 'Your apply-ready path'}
                </h2>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  {userRole === 'employer' ? 'Simple steps to hire' : 'Blocks employers actually see'}
                </p>
              </div>
            </div>
            <button
              type='button'
              onClick={closeGuide}
              className={cn(
                'p-2 rounded-lg',
                'text-gray-400 hover:text-gray-600',
                'dark:text-gray-500 dark:hover:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'transition-colors',
              )}
              aria-label='Close guide'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          <p className='mt-4 break-words text-sm text-gray-600 dark:text-gray-300'>{progress.greeting}</p>
        </div>

        <div className='min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-6'>
          {userRole === 'employer' ? (
            <EmployerPathSidebar
              variant='drawer'
              onCloseDrawer={closeGuide}
              onNavigate={(view) => setCurrentPage(view as PageType)}
            />
          ) : (
            <HubSidebar variant='drawer' onCloseDrawer={closeGuide} />
          )}
        </div>
      </div>
    </>
  )
}
