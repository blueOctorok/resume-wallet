'use client'

/**
 * SimpleJobDetailPanel — rendered on the left (wide/desktop) as the selected
 * job's full description. On mobile it's the "job full-screen" body and the
 * sliver bar sits below it.
 *
 * Intentionally read-only for copy: no stats, no filters — just the info a
 * user needs to decide "is this me?" plus an Apply affordance. Fit scoring
 * uses LLM-extracted requirements (Adzuna) or heuristics (StormChain).
 */

import { Briefcase, Building2, MapPin, ExternalLink, DollarSign, Star, ChevronDown } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import { useInstalledBlocks } from '@/stores/hub-blocks-store'
import { computeJobFit } from '@/lib/job-fit'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Button from '@/components/ui/Button'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import { useSimpleModeStore } from '@/stores/simple-mode-store'
import { useSavedJobsStore } from '@/stores/saved-jobs-store'
import { useExtractedRequirements } from '@/hooks/use-extracted-requirements'
import type { SelectedJobSnapshot } from '@/stores/simple-mode-store'

const ApplyWithStormChainModal = dynamic(
  () => import('@/components/ApplyWithStormChainModal'),
  { ssr: false },
)

/** Requirements coverage needed before the primary Apply affordance reads "ready" (tunable). */
const APPLY_COVERAGE_THRESHOLD = 50

interface SimpleJobDetailPanelProps {
  userAddress: string | null
  /** Open the mobile card sheet from inline CTAs. Desktop ignores this. */
  onOpenCardSheet?: () => void
}

function stripHtml(html: string): string {
  if (typeof window === 'undefined') return html
  const tmp = document.createElement('DIV')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || html
}

function toApplyModalJob(snap: SelectedJobSnapshot) {
  return {
    id: snap.id,
    title: snap.title,
    company: snap.company,
    location: snap.location,
    salary: snap.salary ?? undefined,
    description: snap.description ?? undefined,
    redirect_url: snap.redirectUrl ?? undefined,
    salary_min: snap.salaryMin ?? undefined,
    salary_max: snap.salaryMax ?? undefined,
    is_external: !snap.isStormChain,
  }
}

export default function SimpleJobDetailPanel({
  userAddress,
  onOpenCardSheet,
}: SimpleJobDetailPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const snap = useSimpleModeStore((s) => s.selectedJobSnapshot)

  const toggleSaved = useSavedJobsStore((s) => s.toggleSaved)
  const isSaved = useSavedJobsStore((s) => s.isSaved)

  const [applyOpen, setApplyOpen] = useState(false)
  const [scoreOpen, setScoreOpen] = useState(false)
  const installedBlocks = useInstalledBlocks()
  const installedBlockTypes = useMemo(
    () => installedBlocks.map((b) => b.blockType),
    [installedBlocks],
  )
  const externalReqs = useExtractedRequirements(snap, userAddress)

  const handleSave = useCallback(() => {
    if (!snap) return
    toggleSaved({
      id: snap.id,
      title: snap.title,
      company: snap.company,
      location: snap.location,
      description: snap.description,
      salary: snap.salary,
      redirectUrl: snap.redirectUrl,
      isStormChain: snap.isStormChain,
    })
  }, [snap, toggleSaved])

  // Fit MUST be computed before any conditional return — otherwise flipping
  // from `!snap` to a selected job changes the hook count between renders
  // and React throws "Rendered more hooks than during the previous render".
  const fit = useMemo(
    () =>
      snap
        ? computeJobFit({
            job: snap,
            installedBlockTypes,
            card: null,
            externalRequirements: externalReqs,
          })
        : null,
    [snap, installedBlockTypes, externalReqs],
  )

  if (!snap || !fit) {
    return (
      <HubSectionPanel
        isDark={isDark}
        accent='sky'
        className='h-full'
        contentClassName='flex h-full items-center justify-center !p-6 text-center sm:!p-8'
      >
        <div className='max-w-[18rem]'>
          <Briefcase
            className={cn('mx-auto mb-2 size-7', isDark ? 'text-gray-600' : 'text-slate-300')}
          />
          <p
            className={cn(
              'mb-0.5 text-sm font-semibold',
              isDark ? 'text-gray-300' : 'text-slate-700',
            )}
          >
            Pick a job
          </p>
          <p className={cn('text-xs leading-relaxed', isDark ? 'text-gray-500' : 'text-slate-500')}>
            Choose one from the list — it opens here while your career card updates on the right.
          </p>
        </div>
      </HubSectionPanel>
    )
  }

  const saved = isSaved(snap.id)
  const applyReady = fit.score >= APPLY_COVERAGE_THRESHOLD

  return (
    <HubSectionPanel
      isDark={isDark}
      accent='sky'
      className='h-full'
      contentClassName='flex h-full min-h-0 flex-col !p-4 sm:!p-5'
    >
      {/* Header — high contrast for quick scanning */}
      <div
        className={cn(
          'mb-2 border-b pb-3',
          isDark ? 'border-gray-700/60' : 'border-slate-200',
        )}
      >
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0 flex-1'>
            <h2
              className={cn(
                'text-xl font-bold leading-snug tracking-tight sm:text-2xl lg:text-[1.65rem] lg:leading-tight',
                isDark ? 'text-white' : 'text-slate-900',
              )}
            >
              {snap.title}
            </h2>
            <div
              className={cn(
                'mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-[0.9375rem]',
                isDark ? 'text-gray-300' : 'text-slate-600',
              )}
            >
              <span className='inline-flex items-center gap-1'>
                <Building2 className='w-3.5 h-3.5' />
                {snap.company}
              </span>
              <span className='inline-flex items-center gap-1'>
                <MapPin className='w-3.5 h-3.5' />
                {snap.location}
              </span>
              {snap.salary && (
                <span className='inline-flex items-center gap-1 font-semibold'>
                  <DollarSign className='w-3.5 h-3.5' />
                  {snap.salary}
                </span>
              )}
            </div>
          </div>
          <button
            type='button'
            onClick={handleSave}
            title={saved ? 'Remove from saved' : 'Save job'}
            className={cn(
              'shrink-0 p-2 rounded-lg border cursor-pointer transition-colors',
              saved
                ? isDark
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                  : 'bg-amber-50 border-amber-300 text-amber-700'
                : isDark
                  ? 'border-gray-700 text-gray-400 hover:text-gray-200'
                  : 'border-slate-200 text-slate-500 hover:text-slate-700',
            )}
          >
            <Star className={cn('w-4 h-4', saved && 'fill-current')} />
          </button>
        </div>

        {/* Requirements coverage — transparent checklist beats a black-box % */}
        <div className='mt-3 space-y-2'>
          {fit.score >= 40 ? (
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                isDark ? 'border-teal-500/40 bg-teal-500/10 text-teal-100' : 'border-teal-300 bg-teal-50 text-teal-800',
              )}
              title='Deterministic checklist vs your installed blocks — not hire probability'
            >
              {fit.score}% requirements coverage
            </div>
          ) : (
            <p className={cn('text-xs', isDark ? 'text-amber-200/90' : 'text-amber-800')}>
              This one&apos;s a stretch for your card right now — try picking a role closer to what you&apos;ve built.
            </p>
          )}
          <button
            type='button'
            onClick={() => setScoreOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1 text-[11px] font-semibold cursor-pointer',
              isDark ? 'text-gray-400 hover:text-gray-200' : 'text-slate-500 hover:text-slate-800',
            )}
            aria-expanded={scoreOpen}
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', scoreOpen && 'rotate-180')} />
            Why this score?
          </button>
          {scoreOpen && (
            <div
              className={cn(
                'rounded-lg border text-[11px] p-3 space-y-2',
                isDark ? 'border-gray-700 bg-gray-950/60' : 'border-slate-200 bg-slate-50',
              )}
            >
              {fit.matchedRequirements.length > 0 && (
                <div>
                  <p className={cn('font-semibold mb-1', isDark ? 'text-emerald-300' : 'text-emerald-700')}>
                    Covered
                  </p>
                  <ul className='space-y-0.5'>
                    {fit.matchedRequirements.map((r) => (
                      <li key={r.id}>✅ {r.label}</li>
                    ))}
                  </ul>
                </div>
              )}
              {fit.missingRequirements.length > 0 && (
                <div>
                  <p className={cn('font-semibold mb-1', isDark ? 'text-rose-300' : 'text-rose-700')}>
                    Missing for this posting
                  </p>
                  <ul className='space-y-0.5'>
                    {fit.missingRequirements.map((r) => (
                      <li key={r.id}>❌ {r.label}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description — comfortable measure for long postings */}
      <div className='scrollbar-none min-h-0 flex-1 overflow-y-auto pt-1'>
        <div className='max-w-[72ch]'>
          <p
            className={cn(
              'whitespace-pre-wrap text-[0.9375rem] leading-[1.65] sm:text-base sm:leading-[1.7]',
              isDark ? 'text-gray-200' : 'text-slate-800',
            )}
          >
            {snap.description ? stripHtml(snap.description) : 'No description provided.'}
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div
        className={cn(
          'mt-2 flex items-center gap-2 border-t pt-3',
          isDark ? 'border-gray-700/60' : 'border-slate-200',
        )}
      >
        {onOpenCardSheet && (
          <Button
            variant='secondary'
            size='sm'
            onClick={onOpenCardSheet}
            className='md:hidden flex-1'
          >
            Open my card
          </Button>
        )}
        {snap.isStormChain ? (
          <div className='flex flex-col gap-1 flex-1 min-w-0'>
            <Button
              variant='primary'
              size='sm'
              className={cn(
                'w-full transition-all',
                applyReady
                  ? 'shadow-[0_0_20px_-4px_rgba(20,184,166,0.55)]'
                  : 'opacity-60',
              )}
              disabled={!userAddress || !applyReady}
              onClick={() => setApplyOpen(true)}
            >
              Apply with career card
            </Button>
            {!applyReady && fit.missingRequirements[0] && (
              <p className={cn('text-[10px] text-center', isDark ? 'text-gray-500' : 'text-slate-500')}>
                Add {fit.missingRequirements[0].label.toLowerCase()} to cross {APPLY_COVERAGE_THRESHOLD}%
                coverage
              </p>
            )}
          </div>
        ) : (
          <Button
            variant='primary'
            size='sm'
            className={cn(
              'flex-1 transition-all',
              applyReady && 'shadow-[0_0_20px_-4px_rgba(20,184,166,0.45)]',
            )}
            onClick={() => snap.redirectUrl && window.open(snap.redirectUrl, '_blank', 'noopener,noreferrer')}
            disabled={!snap.redirectUrl}
          >
            <ExternalLink className='w-3.5 h-3.5 mr-1' />
            Apply on employer site
          </Button>
        )}
      </div>

      {snap.isStormChain && (
        <ApplyWithStormChainModal
          isOpen={applyOpen}
          onClose={() => setApplyOpen(false)}
          job={toApplyModalJob(snap)}
          userAddress={userAddress}
        />
      )}
    </HubSectionPanel>
  )
}
