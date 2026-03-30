'use client'

/**
 * Hunt Desk — full-page shortlist workspace (app-within-app feel).
 * Three draggable lanes (not employer kanban semantics): radar → motion → ready to apply.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  ExternalLink,
  GripVertical,
  LayoutGrid,
  MapPin,
  Sparkles,
  StarOff,
  Zap,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import BackToHubButton from '@/components/ui/BackToHubButton'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useSavedJobsStore, type SavedJobEntry, type ShortlistLane } from '@/stores/saved-jobs-store'
import { useUIStore } from '@/stores'
import { cn } from '@/lib/utils'

const LANES: {
  id: ShortlistLane
  label: string
  hint: string
  barLight: string
  barDark: string
  badgeLight: string
  badgeDark: string
  dropLight: string
  dropDark: string
}[] = [
  {
    id: 'watching',
    label: 'On the radar',
    hint: 'Saved — still feeling it out',
    barLight: 'bg-violet-500',
    barDark: 'bg-violet-400',
    badgeLight: 'bg-violet-100 text-violet-900',
    badgeDark: 'bg-violet-500/20 text-violet-200',
    dropLight: 'bg-violet-50/90 border-violet-200',
    dropDark: 'bg-violet-500/5 border-violet-500/35',
  },
  {
    id: 'pursuing',
    label: 'In motion',
    hint: 'Serious contenders — research & prep',
    barLight: 'bg-teal-500',
    barDark: 'bg-teal-400',
    badgeLight: 'bg-teal-100 text-teal-900',
    badgeDark: 'bg-teal-500/20 text-teal-200',
    dropLight: 'bg-teal-50/90 border-teal-200',
    dropDark: 'bg-teal-500/5 border-teal-500/35',
  },
  {
    id: 'ready',
    label: 'Ready to apply',
    hint: 'Green light — ship the card',
    barLight: 'bg-amber-500',
    barDark: 'bg-amber-400',
    badgeLight: 'bg-amber-100 text-amber-950',
    badgeDark: 'bg-amber-500/20 text-amber-200',
    dropLight: 'bg-amber-50/90 border-amber-200',
    dropDark: 'bg-amber-500/5 border-amber-500/30',
  },
]

function laneOf(job: SavedJobEntry): ShortlistLane {
  return job.lane ?? 'watching'
}

interface CandidateHuntDeskProps {
  onBack: () => void
  userAddress: string | null
}

export default function CandidateHuntDesk({ onBack, userAddress }: CandidateHuntDeskProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  const jobs = useSavedJobsStore((s) => s.jobs)
  const moveJobToLane = useSavedJobsStore((s) => s.moveJobToLane)
  const removeSaved = useSavedJobsStore((s) => s.removeSaved)

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverLane, setDragOverLane] = useState<ShortlistLane | null>(null)
  const [applicationCount, setApplicationCount] = useState<number | null>(null)

  useEffect(() => {
    if (!userAddress) {
      setApplicationCount(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/applications/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: userAddress }),
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const n = Array.isArray(data.applications) ? data.applications.length : 0
        if (!cancelled) setApplicationCount(n)
      } catch {
        if (!cancelled) setApplicationCount(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userAddress])

  const columns = useMemo(
    () =>
      LANES.map((lane) => ({
        ...lane,
        jobs: jobs.filter((j) => laneOf(j) === lane.id),
      })),
    [jobs],
  )

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDragOverLane(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, lane: ShortlistLane) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverLane(lane)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, lane: ShortlistLane) => {
      e.preventDefault()
      const id = e.dataTransfer.getData('text/plain')
      const job = jobs.find((j) => j.id === id)
      if (job && laneOf(job) !== lane) moveJobToLane(id, lane)
      setDraggedId(null)
      setDragOverLane(null)
    },
    [jobs, moveJobToLane],
  )

  const cardBase = isDark
    ? 'bg-gray-800/90 border-gray-600/80 hover:border-teal-500/35'
    : 'bg-white border-gray-200 hover:border-teal-300/80 hover:shadow-md'

  const shellChrome = isDark
    ? 'border border-gray-600/50 bg-gray-900/40'
    : 'border border-gray-200/90 bg-white/70'

  return (
    <div className='max-w-[1600px] mx-auto px-3 sm:px-4 pb-12 relative z-0'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6'>
        <div className='flex items-center gap-3 min-w-0'>
          <BackToHubButton onClick={onBack} />
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button type='button' variant='secondary' size='sm' onClick={() => setCurrentPage('jobs')}>
            <Briefcase className='w-4 h-4' />
            Browse jobs
          </Button>
          <Button type='button' variant='secondary' size='sm' onClick={() => setCurrentPage('applications')}>
            Applications
            {applicationCount != null ? ` (${applicationCount})` : ''}
          </Button>
        </div>
      </div>

      <Card variant='elevated' className='overflow-hidden p-0'>
        {/* Mini-app header — distinct from generic page chrome */}
        <div
          className={cn(
            'px-5 sm:px-8 py-6 sm:py-8 border-b',
            isDark ? 'border-gray-700/80 bg-gradient-to-br from-gray-900 via-gray-900 to-violet-950/25' : 'border-gray-200/80 bg-gradient-to-br from-white via-teal-50/30 to-violet-50/40',
          )}
        >
          <div className='flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6'>
            <div className='flex items-start gap-4 min-w-0'>
              <div
                className={cn(
                  'shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg',
                  isDark ? 'bg-gray-800 text-teal-300 ring-1 ring-teal-400/20' : 'bg-white text-teal-700 ring-1 ring-teal-200/60 shadow-teal-500/10',
                )}
              >
                <LayoutGrid className='w-7 h-7' aria-hidden />
              </div>
              <div className='min-w-0'>
                <p className='text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-1'>
                  Candidate workspace
                </p>
                <h1
                  className={cn(
                    'text-2xl sm:text-3xl font-bold tracking-tight',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  Hunt Desk
                </h1>
                <p className={cn('text-sm sm:text-base mt-2 max-w-xl', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Stage starred roles like a command center — drag cards between zones. Same shortlist as job search; this
                  view is built for focus and motion, not another spreadsheet.
                </p>
              </div>
            </div>
            <div className={cn('flex flex-wrap gap-2 lg:justify-end', shellChrome, 'rounded-xl p-2 self-start')}>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold',
                  isDark ? 'bg-gray-800/80 text-gray-300' : 'bg-gray-100 text-gray-700',
                )}
              >
                <Sparkles className='w-3.5 h-3.5 text-violet-500 dark:text-violet-400' />
                {jobs.length} starred
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium opacity-80',
                  isDark ? 'text-gray-500' : 'text-gray-500',
                )}
              >
                Stormi compare & research — premium, coming soon
              </span>
            </div>
          </div>
        </div>

        <div className='p-4 sm:p-6 lg:p-8'>
          {!userAddress ? (
            <p className={cn('text-center py-16 text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Connect your wallet to star jobs — they will show up here on any device once sync ships; today this list
              lives in your browser.
            </p>
          ) : jobs.length === 0 ? (
            <div className='text-center py-16 max-w-md mx-auto space-y-4'>
              <StarOff className={cn('w-12 h-12 mx-auto opacity-40', isDark ? 'text-gray-500' : 'text-gray-400')} />
              <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                No starred jobs yet. Open{' '}
                <button
                  type='button'
                  onClick={() => setCurrentPage('jobs')}
                  className='font-semibold text-teal-600 dark:text-teal-400 underline-offset-2 hover:underline'
                >
                  Browse jobs
                </button>{' '}
                and tap the star on roles you want on your radar.
              </p>
              <Button type='button' variant='primary' size='md' onClick={() => setCurrentPage('jobs')}>
                Open job search
              </Button>
            </div>
          ) : (
            <div className='flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory lg:overflow-visible lg:pb-0'>
              {columns.map((col) => {
                const isDropTarget = dragOverLane === col.id && draggedId !== null
                return (
                  <div
                    key={col.id}
                    className='flex-shrink-0 w-[min(100%,20rem)] lg:flex-1 lg:min-w-0 snap-center'
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={() => setDragOverLane(null)}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                    <div
                      className={cn(
                        'rounded-xl mb-2 overflow-hidden border',
                        isDark ? 'border-gray-700' : 'border-gray-200',
                      )}
                    >
                      <div className={cn('h-1.5', isDark ? col.barDark : col.barLight)} />
                      <div
                        className={cn(
                          'px-3 py-2.5',
                          isDark ? 'bg-gray-800/90' : 'bg-white',
                        )}
                      >
                        <div className='flex items-center justify-between gap-2'>
                          <span
                            className={cn(
                              'text-sm font-bold',
                              isDark ? 'text-white' : 'text-gray-900',
                            )}
                          >
                            {col.label}
                          </span>
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-semibold',
                              isDark ? col.badgeDark : col.badgeLight,
                            )}
                          >
                            {col.jobs.length}
                          </span>
                        </div>
                        <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-500' : 'text-gray-500')}>{col.hint}</p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'min-h-[min(420px,55vh)] lg:min-h-[520px] rounded-xl border-2 p-2 space-y-2 transition-all duration-150',
                        isDropTarget
                          ? cn('border-dashed', isDark ? col.dropDark : col.dropLight)
                          : isDark
                            ? 'border-gray-800 bg-gray-950/30'
                            : 'border-gray-100 bg-gray-50/50',
                      )}
                    >
                      {col.jobs.length === 0 ? (
                        <div
                          className={cn(
                            'flex flex-col items-center justify-center h-36 text-center gap-2 px-2',
                            isDark ? 'text-gray-600' : 'text-gray-400',
                          )}
                        >
                          {isDropTarget ? (
                            <p className={cn('text-sm font-semibold', isDark ? 'text-teal-300' : 'text-teal-700')}>
                              Drop here
                            </p>
                          ) : (
                            <p className='text-xs'>Drag a role here</p>
                          )}
                        </div>
                      ) : (
                        col.jobs.map((job) => {
                          const dragging = draggedId === job.id
                          return (
                            <div
                              key={job.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, job.id)}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                'rounded-xl border p-3 cursor-grab active:cursor-grabbing transition-all group',
                                cardBase,
                                dragging ? 'opacity-50 scale-[0.98] shadow-xl ring-2 ring-teal-500/30' : '',
                              )}
                            >
                              <div className='flex items-start gap-2'>
                                <GripVertical
                                  className={cn(
                                    'w-4 h-4 shrink-0 mt-0.5 opacity-40 group-hover:opacity-70',
                                    isDark ? 'text-gray-500' : 'text-gray-400',
                                  )}
                                  aria-hidden
                                />
                                <div className='flex-1 min-w-0'>
                                  <div className='flex items-center gap-1.5 mb-1 flex-wrap'>
                                    {job.isStormChain && (
                                      <span className='inline-flex items-center gap-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-600 dark:text-teal-400'>
                                        <Zap className='w-3 h-3' /> StormChain
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    className={cn(
                                      'text-sm font-semibold leading-snug',
                                      isDark ? 'text-white' : 'text-gray-900',
                                    )}
                                  >
                                    {job.title}
                                  </p>
                                  <p className={cn('text-xs truncate mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>
                                    {job.company}
                                  </p>
                                  <p
                                    className={cn(
                                      'text-xs flex items-center gap-1 mt-1',
                                      isDark ? 'text-gray-500' : 'text-gray-500',
                                    )}
                                  >
                                    <MapPin className='w-3 h-3 shrink-0' />
                                    {job.location}
                                  </p>
                                  {job.salary && (
                                    <p className={cn('text-xs mt-1 font-medium', isDark ? 'text-teal-300' : 'text-teal-700')}>
                                      {job.salary}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className='flex flex-wrap gap-2 mt-3 pt-2 border-t border-gray-200/80 dark:border-gray-600/60'>
                                {job.redirectUrl && (
                                  <a
                                    href={job.redirectUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className={cn(
                                      'inline-flex items-center gap-1 text-xs font-semibold',
                                      isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-700 hover:text-teal-800',
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className='w-3.5 h-3.5' />
                                    Listing
                                  </a>
                                )}
                                <button
                                  type='button'
                                  onClick={() => removeSaved(job.id)}
                                  className={cn(
                                    'inline-flex items-center gap-1 text-xs font-medium',
                                    isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-500 hover:text-red-600',
                                  )}
                                >
                                  <StarOff className='w-3.5 h-3.5' />
                                  Unstar
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
