'use client'

/**
 * Final CTA — one last brand moment and the same two paths as the hero.
 */

import { ArrowRight, Building2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import ProvvenWordmark from '@/components/ui/ProvvenWordmark'
import { cn } from '@/lib/utils'
import { GOLD_CTA, headingText, mutedText, LandingContainer, SealDivider } from './landing-shared'

interface FinalCtaSectionProps {
  isDark: boolean
  isAuthenticated: boolean
  onGetStarted: () => void
  onForEmployers: () => void
}

export default function FinalCtaSection({
  isDark,
  isAuthenticated,
  onGetStarted,
  onForEmployers,
}: FinalCtaSectionProps) {
  const primaryLabel = isAuthenticated ? 'Go to your hub' : 'Build your Career Card'

  return (
    <section className='py-24 sm:py-32'>
      <LandingContainer className='max-w-3xl text-center'>
        <div data-reveal>
          <SealDivider isDark={isDark} className='reveal-item mx-auto mb-6 max-w-xs' />
          <p className='reveal-item mb-4 text-2xl sm:text-3xl'>
            <ProvvenWordmark tone='auto' isDark={isDark} />
          </p>
          <h2
            className={cn(
              'reveal-item font-display text-4xl font-medium leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl',
              headingText(isDark),
            )}
          >
            Build it once.
            <br />
            Own it for good.
          </h2>
          <p
            className={cn('reveal-item mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg', mutedText(isDark))}
            style={{ transitionDelay: '120ms' }}
          >
            Your Career Card is live from the first block — and every fact you verify makes
            it harder to ignore.
          </p>

          <div
            className='reveal-item mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center'
            style={{ transitionDelay: '220ms' }}
          >
            <Button
              variant='primary'
              size='lg'
              onClick={onGetStarted}
              className={cn('group h-auto rounded-xl px-8 py-4 text-base', GOLD_CTA)}
            >
              {primaryLabel}
              <ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
            </Button>
            <Button variant='secondary' size='lg' onClick={onForEmployers} className='h-auto rounded-xl px-8 py-4 text-base'>
              <Building2 className='h-4 w-4' />
              I&rsquo;m hiring
            </Button>
          </div>

          <p
            className={cn('reveal-item mx-auto mt-10 max-w-lg text-[11px] leading-relaxed', mutedText(isDark), 'opacity-80')}
            style={{ transitionDelay: '320ms' }}
          >
            Provven partners with licensed consumer reporting agencies for screening data and
            acts as the candidate&rsquo;s agent — every share is authorized by the candidate,
            every time.
          </p>
        </div>
      </LandingContainer>
    </section>
  )
}
