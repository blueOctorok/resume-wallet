'use client'

/**
 * The problem — three editorial columns, hairline-separated, no card chrome.
 * One job: make the oversharing status quo feel absurd before the fix appears.
 */

import { FileWarning, Inbox, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { headingText, mutedText, LandingContainer, SectionHeader } from './landing-shared'

const PROBLEMS = [
  {
    icon: FileWarning,
    title: 'The whole report, every time',
    body: 'Ask one question — is this driving record clean? — and the carrier receives everything: date of birth, home address, every violation, all fourteen pages.',
  },
  {
    icon: Inbox,
    title: 'Noise instead of signal',
    body: 'Employer inboxes are flooded with AI-generated resumes nobody can verify. Real qualifications drown in keyword soup, and everyone loses time.',
  },
  {
    icon: RotateCcw,
    title: 'Re-screened at every hop',
    body: 'Drivers rebuild the same DQ file — MVR, PSP, employment checks — from scratch for every application. Paid for once, then thrown away.',
  },
] as const

export default function ProblemSection({ isDark }: { isDark: boolean }) {
  return (
    <section className='py-20 sm:py-28'>
      <LandingContainer>
        <SectionHeader
          eyebrow='The problem'
          title='Hiring runs on oversharing.'
          lede='Between candidates and employers sits a pile of unverified documents — and the only way to prove anything is to hand over everything.'
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
                <Icon className={cn('h-5 w-5', isDark ? 'text-[#d4b44a]/80' : 'text-[#8a6700]')} />
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
