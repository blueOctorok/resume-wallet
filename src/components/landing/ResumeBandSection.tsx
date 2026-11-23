'use client'

/**
 * Resume, second — a short band after the fill-once section.
 *
 * One job: you do not write a second document. The resume prints from the
 * application you already filled. Resume search phrases live here and in
 * SITE_SEO, after the DOT application has already been named.
 */

import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { headingText, mutedText, paperBand, LandingContainer, SectionHeader } from './landing-shared'

export default function ResumeBandSection({ isDark }: { isDark: boolean }) {
  return (
    <section className={cn('py-16 sm:py-20', paperBand(isDark))}>
      <LandingContainer className='max-w-3xl'>
        <div data-reveal className='text-center'>
          <SectionHeader
            eyebrow='Then the resume'
            title='You do not write a second document.'
            isDark={isDark}
            align='center'
            className='reveal-item'
          />
          <p
            className={cn(
              'reveal-item mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg',
              mutedText(isDark),
            )}
            style={{ transitionDelay: '100ms' }}
          >
            Your truck driver resume prints from the DOT application you already
            filled. Download the PDF when you need it. Update a job once and the
            next print picks it up.
          </p>
          <div
            className={cn(
              'reveal-item mx-auto mt-8 flex max-w-md items-center gap-3 rounded-xl border px-4 py-3.5 text-left',
              isDark ? 'border-white/10 bg-white/[0.04]' : 'border-stone-200 bg-white shadow-sm',
            )}
            style={{ transitionDelay: '180ms' }}
          >
            <FileText className='h-5 w-5 shrink-0 text-[#f15a2b]' aria-hidden />
            <div className='min-w-0'>
              <p className={cn('text-sm font-semibold', headingText(isDark))}>View resume</p>
              <p className={cn('mt-0.5 text-xs leading-relaxed', mutedText(isDark))}>
                Same file · PDF download · generated from your application
              </p>
            </div>
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
