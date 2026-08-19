'use client'

/**
 * Selective disclosure — the money shot.
 *
 * The one interactive moment on the page: flip the same Career Card between
 * "employer view" (proof only) and "your vault" (everything, owner-only).
 * Local useState is fine here — pure UI toggle, nothing shares it.
 */

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import DisclosureCard, { type DisclosureView } from './DisclosureCard'
import { INK, InkBand, LandingContainer, SectionHeader } from './landing-shared'

const CONTRAST_ROWS = [
  { shared: true, text: 'Clean MVR for 36 months — as a verifiable fact' },
  { shared: true, text: 'CDL class and endorsements, issuer-backed' },
  { shared: false, text: 'Date of birth, home address, license number' },
  { shared: false, text: 'The 14-page report those facts came from' },
] as const

function ViewToggle({ view, onChange }: { view: DisclosureView; onChange: (v: DisclosureView) => void }) {
  const options: Array<{ id: DisclosureView; label: string }> = [
    { id: 'shared', label: 'Employer view' },
    { id: 'vault', label: 'Your vault' },
  ]
  return (
    <div
      role='group'
      aria-label='Career card view'
      className='inline-flex rounded-full border border-white/12 bg-white/[0.04] p-1'
    >
      {options.map((opt) => {
        const active = view === opt.id
        return (
          <button
            key={opt.id}
            type='button'
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300',
              active
                ? 'bg-[#f15a2b]/20 text-[#ffb08a] ring-1 ring-[#f15a2b]/45'
                : 'text-ironside hover:text-[#b8babc]',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default function DisclosureSection() {
  const [view, setView] = useState<DisclosureView>('shared')

  return (
    <InkBand
      className='border-y border-white/[0.06]'
      atmosphere={
        <div
          aria-hidden
          className='pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 opacity-[0.12]'
          style={{ background: 'radial-gradient(ellipse, #f15a2b 0%, #3d5a8f 55%, transparent 75%)' }}
        />
      }
    >
      <LandingContainer className='py-20 sm:py-28'>
        <div className='grid items-center gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20'>
          <div className='min-w-0' data-reveal>
            <SectionHeader
              eyebrow='Selective disclosure'
              title={
                <>
                  Prove the fact.
                  <br />
                  Keep the file.
                </>
              }
              onInk
              className='reveal-item'
            />
            <p className={cn('reveal-item mt-6 text-base leading-relaxed sm:text-lg', INK.body)} style={{ transitionDelay: '100ms' }}>
              This is the part no job board can do. An employer needs to know your record is
              clean &mdash; they don&rsquo;t need your date of birth, your address, or the
              full report to know it. Provven separates the <em className='not-italic text-[#f78a5c]'>fact</em> from
              the <em className='not-italic text-[#f78a5c]'>file</em>, so you can share one without surrendering the other.
            </p>

            <ul className='reveal-item mt-8 space-y-3' style={{ transitionDelay: '200ms' }}>
              {CONTRAST_ROWS.map((row) => (
                <li key={row.text} className='flex items-start gap-3'>
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1',
                      row.shared
                        ? 'bg-[#f15a2b]/15 text-[#f78a5c] ring-[#f15a2b]/35'
                        : 'bg-white/[0.04] text-ironside ring-white/10',
                    )}
                  >
                    {row.shared ? <Check className='h-3 w-3' /> : <X className='h-3 w-3' />}
                  </span>
                  <span className={cn('text-sm leading-relaxed sm:text-[15px]', row.shared ? INK.bodyBright : 'text-ironside')}>
                    {row.text}
                    <span className='ml-2 font-mono text-[9px] font-semibold uppercase tracking-wider'>
                      {row.shared ? (
                        <span className='text-[#f78a5c]/80'>shared</span>
                      ) : (
                        <span className='text-slate-600'>never leaves</span>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Interactive card */}
          <div className='flex min-w-0 flex-col items-center gap-5' data-reveal>
            <div className='reveal-item'>
              <ViewToggle view={view} onChange={setView} />
            </div>
            <div className='reveal-item w-full max-w-md' style={{ transitionDelay: '120ms' }}>
              <DisclosureCard view={view} />
            </div>
          </div>
        </div>
      </LandingContainer>
    </InkBand>
  )
}
