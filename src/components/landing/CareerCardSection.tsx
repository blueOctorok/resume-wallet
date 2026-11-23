'use client'

/**
 * Fill it once — what goes into the file, in the order a driver meets it.
 *
 * Every row here is something the driver enters, so every row carries the
 * same "on the file" label. The verified badge belongs to screener facts and
 * first appears in DisclosureSection.
 */

import { Camera, ClipboardList, IdCard, Truck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { headingText, mutedText, paperBand, LandingContainer, SectionHeader } from './landing-shared'

const FILE_PIECES: Array<{ icon: LucideIcon; label: string; note: string }> = [
  {
    icon: ClipboardList,
    label: 'DOT application',
    note: 'The federal driver application, Forms 1 through 3. You type it one time.',
  },
  {
    icon: IdCard,
    label: 'License scan',
    note: 'Scan the barcode on your license and the license fields fill in.',
  },
  {
    icon: Truck,
    label: 'Employment history',
    note: 'Your jobs, schools, and references live inside the application.',
  },
  {
    icon: Camera,
    label: 'Other papers',
    note: 'Photos and PDFs of anything else an employer you work with needs to open.',
  },
]

export default function CareerCardSection({ isDark }: { isDark: boolean }) {
  return (
    <section className={cn('py-20 sm:py-28', paperBand(isDark, true))}>
      <LandingContainer>
        <div className='grid items-center gap-12 lg:grid-cols-2 lg:gap-20'>
          <div data-reveal>
            <SectionHeader
              eyebrow='Fill it once'
              title={
                <>
                  Type it one time.
                  <br />
                  It stays filled.
                </>
              }
              isDark={isDark}
              className='reveal-item'
            />
            <div className='reveal-item mt-6 space-y-4' style={{ transitionDelay: '120ms' }}>
              <p className={cn('text-base leading-relaxed sm:text-lg', mutedText(isDark))}>
                Every carrier has to collect a DOT application before you drive for them. On
                Provven you fill that application once and it stays yours. When the next
                company asks, your answers are already there.
              </p>
              <p className={cn('text-base leading-relaxed sm:text-lg', mutedText(isDark))}>
                Update a job or an address in one place and every employer you share with
                sees the current file. Filling it out and sharing it is free.
              </p>
            </div>
          </div>

          <div data-reveal>
            <ol className='space-y-2.5'>
              {FILE_PIECES.map((piece, i) => {
                const Icon = piece.icon
                return (
                  <li
                    key={piece.label}
                    className={cn(
                      'reveal-item flex items-start gap-3.5 rounded-xl border px-4 py-3.5',
                      isDark ? 'border-white/10 bg-white/[0.04]' : 'border-stone-200 bg-white shadow-sm',
                    )}
                    style={{ transitionDelay: `${i * 90}ms` }}
                  >
                    <Icon className='mt-0.5 h-4 w-4 shrink-0 text-[#f15a2b]' aria-hidden />
                    <div className='min-w-0 flex-1'>
                      <p className={cn('text-sm font-semibold', headingText(isDark))}>{piece.label}</p>
                      <p className={cn('mt-0.5 text-sm leading-relaxed', mutedText(isDark))}>{piece.note}</p>
                    </div>
                    <span className='mt-0.5 shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider text-ironside'>
                      on the file
                    </span>
                  </li>
                )
              })}
            </ol>
            <p className={cn('reveal-item mt-4 text-center text-xs', mutedText(isDark))} style={{ transitionDelay: '420ms' }}>
              These are your own entries, labeled as on the file. Verified facts come from a
              licensed screener.
            </p>
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
