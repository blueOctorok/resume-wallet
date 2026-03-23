'use client'

/**
 * Short, plain-language orientation above the step list — works for any age or career.
 * Three icons show the model (add → finish → outcome) without a wall of text.
 */

import { ChevronDown, LayoutGrid, ListChecks, IdCard, Building2, Briefcase, Users } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

export interface PathGuidanceProps {
  audience: 'candidate' | 'employer'
  /** Candidate: first name from profile */
  firstName?: string | null
  /** Employer: company display name */
  companyName?: string | null
  /** For highlighting the 3-step strip */
  installedBlockCount?: number
  overallProgress?: number
  companyProfileComplete?: boolean
  hasPostedJob?: boolean
}

export default function PathGuidance({
  audience,
  firstName,
  companyName,
  installedBlockCount = 0,
  overallProgress = 0,
  companyProfileComplete = false,
  hasPostedJob = false,
}: PathGuidanceProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const who =
    audience === 'candidate'
      ? firstName?.trim()
        ? firstName.trim()
        : 'there'
      : companyName?.trim()
        ? companyName.trim()
        : 'your company'

  const title = audience === 'candidate' ? 'Your career path' : 'Your job path'
  const headline =
    audience === 'candidate'
      ? 'Build a career card that shows employers who you are.'
      : 'Post roles and move people through a simple hiring flow.'

  const sub =
    audience === 'candidate'
      ? 'Pick blocks for your field → finish them → your card fills in.'
      : 'Company ready → post a job → review applicants and hire.'

  let activeStep = 0
  if (audience === 'candidate') {
    if (installedBlockCount === 0) activeStep = 0
    else if (overallProgress < 80) activeStep = 1
    else activeStep = 2
  } else {
    if (!companyProfileComplete) activeStep = 0
    else if (!hasPostedJob) activeStep = 1
    else activeStep = 2
  }

  const stepsCandidate = [
    { Icon: LayoutGrid, label: 'Add blocks', caption: 'Block store' },
    { Icon: ListChecks, label: 'Finish them', caption: 'Your data' },
    { Icon: IdCard, label: 'Career card', caption: 'Share' },
  ] as const

  const stepsEmployer = [
    { Icon: Building2, label: 'Company', caption: 'Profile' },
    { Icon: Briefcase, label: 'Post jobs', caption: 'Open roles' },
    { Icon: Users, label: 'Hire', caption: 'Pipeline' },
  ] as const

  const steps = audience === 'candidate' ? stepsCandidate : stepsEmployer

  return (
    <div className='space-y-3'>
      <p className='text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
        {title}
      </p>
      <p className={cn('text-sm font-semibold leading-snug', isDark ? 'text-white' : 'text-slate-900')}>
        Hey {who},{' '}
        <span className={cn('font-bold', isDark ? 'text-brand-mint' : 'text-teal-700')}>{headline}</span>
      </p>
      <p className='text-xs text-gray-600 dark:text-gray-400 leading-relaxed'>{sub}</p>

      <div className='flex items-stretch gap-1 pt-1'>
        {steps.map(({ Icon, label, caption }, i) => {
          const active = i === activeStep
          return (
            <div
              key={label}
              className={cn(
                'flex-1 rounded-lg border px-1.5 py-2 text-center transition-colors',
                active
                  ? isDark
                    ? 'border-brand-mint/50 bg-brand-mint/15 ring-1 ring-brand-mint/30'
                    : 'border-teal-300 bg-teal-50/90 ring-1 ring-teal-200'
                  : isDark
                    ? 'border-gray-700 bg-gray-800/40'
                    : 'border-slate-200 bg-slate-50/80',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 mx-auto mb-1',
                  active ? 'text-brand-mint dark:text-brand-mint' : 'text-gray-400 dark:text-gray-500',
                )}
              />
              <p className='text-[10px] font-semibold text-gray-800 dark:text-gray-200 leading-tight'>{label}</p>
              <p className='text-[9px] text-gray-500 dark:text-gray-500 mt-0.5'>{caption}</p>
            </div>
          )
        })}
      </div>

      <details className='group text-xs'>
        <summary
          className={cn(
            'flex items-center gap-1 cursor-pointer list-none font-medium select-none',
            isDark ? 'text-gray-400 hover:text-gray-300' : 'text-slate-600 hover:text-slate-800',
          )}
        >
          <ChevronDown className='w-3.5 h-3.5 transition-transform group-open:rotate-180' />
          How this works
        </summary>
        <ul
          className={cn(
            'mt-2 space-y-1.5 pl-1 border-l-2 border-gray-200 dark:border-gray-600 ml-1.5',
            isDark ? 'text-gray-400' : 'text-slate-600',
          )}
        >
          {audience === 'candidate' ? (
            <>
              <li>Open the block store and add pieces that match your work (driver, developer, etc.).</li>
              <li>Each block asks for a slice of your story; completing blocks fills your career card.</li>
              <li>Share your card when you apply or network.</li>
            </>
          ) : (
            <>
              <li>Complete your company profile so candidates know who you are.</li>
              <li>Post jobs to collect applications in one place.</li>
              <li>Use the pipeline to review, contact, and archive candidates.</li>
            </>
          )}
        </ul>
      </details>
    </div>
  )
}
