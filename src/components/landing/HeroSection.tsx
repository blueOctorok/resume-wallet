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

export default function HeroSection({
  isAuthenticated,
  onLogIn,
  onForEmployers,
  onBrowseJobs,
}: HeroSectionProps) {
  const primaryLabel = isAuthenticated ? 'Go to your hub' : 'Log in'

  return (
    <InkBand className='border-b border-white/[0.06]'>
      <LandingContainer className='pb-20 pt-14 sm:pb-28 sm:pt-20 lg:pt-24'>
        {/*
          Side-by-side only at xl (1280+). `lg` is 1024 — iPad Pro portrait —
          and the lockup is viewport-sized (`11vw`) so it overflowed under the card.
        */}
        <div className='grid items-center gap-14 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-16'>
          <div className='min-w-0 text-center xl:text-left'>
            <div className='lp-rise' style={{ animationDelay: '0ms' }}>
              <p className='max-w-full overflow-hidden text-[clamp(2.15rem,11vw,5.5rem)] leading-none [text-shadow:0_2px_24px_rgba(0,0,0,0.5)] xl:text-[clamp(2.5rem,4vw,3.75rem)]'>
                <ProvvenWordmark tone='ink' className='max-w-full tracking-[0.04em] sm:tracking-[0.08em]' />
              </p>
              <div className='mx-auto mt-3 flex max-w-xs items-center gap-3 xl:mx-0'>
                <span className='h-px flex-1 bg-gradient-to-r from-transparent via-[#f15a2b]/55 to-[#f15a2b]/55 xl:from-[#f15a2b]/55' />
                <p className='shrink-0 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#f78a5c]'>
                  The career card you own
                </p>
                <span className='h-px flex-1 bg-gradient-to-l from-transparent via-[#f15a2b]/55 to-[#f15a2b]/55' />
              </div>
            </div>

            <h1
              className='lp-rise mt-10 text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-[#f4f1ea] sm:text-5xl xl:text-[3.4rem]'
              style={{ animationDelay: '120ms' }}
            >
              Proof,{' '}
              <em className='font-semibold not-italic text-[#f78a5c]'>not paperwork.</em>
            </h1>

            <p
              className='lp-rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg xl:mx-0'
              style={{ animationDelay: '220ms' }}
            >
              Build a Career Card once and own it for good. Facts verified by licensed
              screeners, shared with employers on your terms &mdash; prove a clean MVR
              without handing over the whole report.
            </p>

            <div
              className='lp-rise mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center xl:justify-start'
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
                  className='text-sm text-ironside underline decoration-ironside/50 underline-offset-4 transition-colors hover:text-[#f78a5c] hover:decoration-[#f15a2b]/50'
                >
                  or browse jobs without an account
                </button>
              )}
              <p className='mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ironside'>
                free for candidates · no wallets, no tokens · built on Midnight
              </p>
            </div>
          </div>

          <div className='lp-rise relative flex min-w-0 justify-center xl:justify-end' style={{ animationDelay: '260ms' }}>
            <DisclosureCard view='shared' className='relative' />
          </div>
        </div>
      </LandingContainer>
    </InkBand>
  )
}
