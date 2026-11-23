'use client'

/**
 * How it works — fill the application, share that file, verify when asked.
 * No “start with a resume” step.
 */

import { cn } from '@/lib/utils'
import { headingText, mutedText, paperBand, LandingContainer, SectionHeader } from './landing-shared'

const STEPS = [
  {
    n: '01',
    title: 'Fill',
    body: 'Complete your DOT application once — work history, license fields, education, and references. Free. It stays yours.',
  },
  {
    n: '02',
    title: 'Share',
    body: 'When a company invites you or you apply, they open the same file. You do not retype it. Your resume prints from it when you need a PDF.',
  },
  {
    n: '03',
    title: 'Verify',
    body: 'When an employer asks, you sign screening consent. A licensed screener can pull your MVR or PSP. Those facts carry the badge. Your typed answers stay labeled as yours.',
  },
] as const

export default function HowItWorksSection({ isDark }: { isDark: boolean }) {
  return (
    <section className={cn('py-20 sm:py-28', paperBand(isDark))}>
      <LandingContainer>
        <SectionHeader
          eyebrow='How it works'
          title='Three moves. One file.'
          isDark={isDark}
          align='center'
        />

        <div className='mt-14 grid gap-12 sm:grid-cols-3 sm:gap-8' data-reveal>
          {STEPS.map((step, i) => (
            <div key={step.n} className='reveal-item' style={{ transitionDelay: `${i * 140}ms` }}>
              <p
                className={cn(
                  'font-display text-6xl font-light leading-none tracking-tight sm:text-7xl',
                  'text-[#f15a2b]/25',
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
