'use client'

/**
 * Hero — one composition: brand, headline, one supporting line, CTA group,
 * and the DisclosureCard as the dominant visual on a full-bleed ink plane.
 *
 * Entrance animation is pure CSS (`lp-rise` classes defined in LandingPage)
 * with staggered delays; `motion-reduce` disables it entirely.
 */

import { ArrowRight, Building2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import ProvvenWordmark from '@/components/ui/ProvvenWordmark'
import { cn } from '@/lib/utils'
import DisclosureCard from './DisclosureCard'
import { GOLD_CTA, InkBand, LandingContainer } from './landing-shared'

interface HeroSectionProps {
  isAuthenticated: boolean
  /** One front door — role routes to candidate or employer hub after auth */
  onLogIn: () => void
  onForEmployers: () => void
  onBrowseJobs?: () => void
}

function HeroAtmosphere() {
  return (
    <>
      <div
        aria-hidden
        className='pointer-events-none absolute -left-40 top-[-8rem] h-[34rem] w-[34rem] rounded-full opacity-[0.12] blur-[100px]'
        style={{ background: 'radial-gradient(circle, #c9a86a 0%, transparent 65%)' }}
      />
      <div
        aria-hidden
        className='pointer-events-none absolute right-[-10rem] top-1/3 h-[30rem] w-[30rem] rounded-full opacity-[0.14] blur-[110px]'
        style={{ background: 'radial-gradient(circle, #3d5a8f 0%, transparent 65%)' }}
      />
      <div aria-hidden className='pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-black/40' />
    </>
  )
}

export default function HeroSection({
  isAuthenticated,
  onLogIn,
  onForEmployers,
  onBrowseJobs,
}: HeroSectionProps) {
  const primaryLabel = isAuthenticated ? 'Go to your hub' : 'Log in'

  return (
    <InkBand atmosphere={<HeroAtmosphere />} className='border-b border-white/[0.06]'>
      <LandingContainer className='pb-20 pt-14 sm:pb-28 sm:pt-20 lg:pt-24'>
        <div className='grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16'>
          <div className='min-w-0 text-center lg:text-left'>
            <div className='lp-rise' style={{ animationDelay: '0ms' }}>
              <p className='text-6xl sm:text-7xl lg:text-[5.5rem] [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]'>
                <ProvvenWordmark tone='ink' />
              </p>
              <div className='mx-auto mt-3 flex max-w-xs items-center gap-3 lg:mx-0'>
                <span className='h-px flex-1 bg-gradient-to-r from-transparent via-[#c9a86a]/55 to-[#c9a86a]/55 lg:from-[#c9a86a]/55' />
                <p className='shrink-0 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#d4be93]'>
                  The career card you own
                </p>
                <span className='h-px flex-1 bg-gradient-to-l from-transparent via-[#c9a86a]/55 to-[#c9a86a]/55' />
              </div>
            </div>

            <h1
              className='lp-rise mt-10 font-display text-4xl font-medium leading-[1.06] tracking-tight text-[#f4f1ea] sm:text-5xl lg:text-[3.4rem]'
              style={{ animationDelay: '120ms' }}
            >
              Proof,{' '}
              <em className='font-medium not-italic text-[#d4be93]'>not paperwork.</em>
            </h1>

            <p
              className='lp-rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg lg:mx-0'
              style={{ animationDelay: '220ms' }}
            >
              Build a Career Card once and own it for good. Facts verified by licensed
              screeners, shared with employers on your terms &mdash; prove a clean MVR
              without handing over the whole report.
            </p>

            <div
              className='lp-rise mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start'
              style={{ animationDelay: '320ms' }}
            >
              <Button
                variant='primary'
                size='lg'
                onClick={onLogIn}
                className={cn('group h-auto rounded-xl px-8 py-4 text-base', GOLD_CTA)}
              >
                {primaryLabel}
                <ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
              </Button>
              <Button
                variant='secondary'
                size='lg'
                onClick={onForEmployers}
                className={cn(
                  'h-auto rounded-xl px-8 py-4 text-base',
                  'border-white/15 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12] dark:border-white/15 dark:bg-white/[0.06] dark:hover:bg-white/[0.12]',
                )}
              >
                <Building2 className='h-4 w-4' />
                I&rsquo;m hiring
              </Button>
            </div>

            <div className='lp-rise mt-6' style={{ animationDelay: '420ms' }}>
              {onBrowseJobs && (
                <button
                  type='button'
                  onClick={onBrowseJobs}
                  className='text-sm text-slate-500 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-[#d4be93] hover:decoration-[#c9a86a]/50'
                >
                  or browse jobs without an account
                </button>
              )}
              <p className='mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600'>
                free for candidates · no wallets, no tokens · built on Midnight
              </p>
            </div>
          </div>

          <div className='lp-rise relative flex min-w-0 justify-center lg:justify-end' style={{ animationDelay: '260ms' }}>
            <div
              aria-hidden
              className='pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 opacity-25 blur-3xl'
              style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(205,168,104,0.4) 0%, rgba(95,122,158,0.2) 45%, transparent 70%)' }}
            />
            <DisclosureCard view='shared' className='relative' />
          </div>
        </div>
      </LandingContainer>
    </InkBand>
  )
}
