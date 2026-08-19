'use client'

/**
 * How it works — three steps with oversized numerals.
 * No card chrome: numeral, rule, title, copy.
 */

import { cn } from '@/lib/utils'
import { headingText, mutedText, paperBand, LandingContainer, SectionHeader } from './landing-shared'

const STEPS = [
  {
    n: '01',
    title: 'Build',
    body: 'Start with one block — a resume, a CDL, a DOT application. Your Career Card is live from the first block, and an AI coach helps you strengthen it over time.',
  },
  {
    n: '02',
    title: 'Verify',
    body: 'Third-party facts — MVR, screening data, employment — are verified through licensed partners and sealed to your card. Self-reported entries stay clearly labeled as yours.',
  },
  {
    n: '03',
    title: 'Share',
    body: 'Apply to a job or answer an employer\u2019s request by sharing exactly the blocks it needs. Every share is explicit, scoped, and yours to make — every time.',
  },
] as const

export default function HowItWorksSection({ isDark }: { isDark: boolean }) {
  return (
    <section className={cn('py-20 sm:py-28', paperBand(isDark))}>
      <LandingContainer>
        <SectionHeader
          eyebrow='How it works'
          title='Three moves. One card.'
          isDark={isDark}
          align='center'
        />

        <div className='mt-14 grid gap-12 sm:grid-cols-3 sm:gap-8' data-reveal>
          {STEPS.map((step, i) => (
            <div key={step.n} className='reveal-item' style={{ transitionDelay: `${i * 140}ms` }}>
              <p
                className={cn(
                  'font-display text-6xl font-light leading-none tracking-tight sm:text-7xl',
                  isDark ? 'text-[#f15a2b]/25' : 'text-[#f15a2b]/25',
                )}
                aria-hidden
              >
                {step.n}
              </p>
              <div className={cn('mt-4 h-px w-12', isDark ? 'bg-[#f15a2b]/45' : 'bg-[#f15a2b]/40')} />
              <h3 className={cn('mt-4 font-display text-2xl font-medium tracking-tight', headingText(isDark))}>
                {step.title}
              </h3>
              <p className={cn('mt-3 text-sm leading-relaxed sm:text-[15px]', mutedText(isDark))}>{step.body}</p>
            </div>
          ))}
        </div>
      </LandingContainer>
    </section>
  )
}
