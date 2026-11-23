'use client'

/**
 * Why the file exists — every carrier hands you the same application, you
 * retype it, and the last copy is thrown away. Resume-inbox noise stays as
 * contrast, not the lead.
 */

import { ClipboardList, Inbox, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { headingText, mutedText, paperBand, LandingContainer, SectionHeader } from './landing-shared'

const PROBLEMS = [
  {
    icon: ClipboardList,
    title: 'The same form, every carrier',
    body: 'Every trucking company collects a DOT application before you drive. The questions are the same. You still fill a new packet for each one.',
  },
  {
    icon: RotateCcw,
    title: 'Retype, then throw away',
    body: 'Work history, license fields, and references get typed again and again. The last copy sits in someone else’s inbox and never comes with you.',
  },
  {
    icon: Inbox,
    title: 'Resumes that say nothing',
    body: 'Employer inboxes are full of AI-written resumes nobody can check. A finished federal application is the signal. A keyword soup is not.',
  },
] as const

export default function ProblemSection({ isDark }: { isDark: boolean }) {
  return (
    <section className={cn('py-20 sm:py-28', paperBand(isDark))}>
      <LandingContainer>
        <SectionHeader
          eyebrow='Why this exists'
          title='Stop retyping the same application.'
          lede='Carriers need a driver qualification file. Drivers should not rebuild it from scratch for every job.'
          isDark={isDark}
        />

        <div
          className={cn(
            'mt-14 grid gap-10 border-t pt-10 sm:grid-cols-3 sm:gap-8',
            isDark ? 'border-gray-800' : 'border-stone-200',
          )}
          data-reveal
        >
          {PROBLEMS.map((item, i) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className={cn(
                  'reveal-item sm:px-6 sm:first:pl-0 sm:last:pr-0',
                  i > 0 && (isDark ? 'sm:border-l sm:border-gray-800' : 'sm:border-l sm:border-stone-200'),
                )}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <Icon className={cn('h-5 w-5', isDark ? 'text-[#f15a2b]/80' : 'text-[#f15a2b]')} />
                <h3 className={cn('mt-4 font-display text-xl font-medium tracking-tight', headingText(isDark))}>
                  {item.title}
                </h3>
                <p className={cn('mt-3 text-sm leading-relaxed sm:text-[15px]', mutedText(isDark))}>{item.body}</p>
              </div>
            )
          })}
        </div>
      </LandingContainer>
    </section>
  )
}
