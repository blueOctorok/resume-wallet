'use client'

/**
 * Verify, then disclose.
 *
 * Lead with what an employer can trust when they ask (MVR, PSP, employment
 * reply). Then the selective-disclosure point: the fact without the full
 * report. Typed answers on the application stay the driver’s.
 */

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import DisclosureCard, { type DisclosureView } from './DisclosureCard'
import { INK, InkBand, LandingContainer, SectionHeader } from './landing-shared'

const TRUST_ROWS = [
  { ok: true, text: 'Motor vehicle record from a licensed screener', tag: 'trusted' },
  { ok: true, text: 'PSP crash and inspection history, when ordered', tag: 'trusted' },
  { ok: true, text: 'Employment reply that passed a mail check', tag: 'trusted' },
  { ok: false, text: 'Answers you typed on the DOT application', tag: 'your entry' },
] as const

const DISCLOSE_ROWS = [
  { ok: true, text: 'License class, endorsements, and a clean-window fact', tag: 'shared' },
  { ok: false, text: 'Date of birth, home address, license number', tag: 'stays back' },
  { ok: false, text: 'The full report those facts came from', tag: 'stays back' },
] as const

function ViewToggle({ view, onChange }: { view: DisclosureView; onChange: (v: DisclosureView) => void }) {
  const options: Array<{ id: DisclosureView; label: string }> = [
    { id: 'shared', label: 'Employer view' },
    { id: 'vault', label: 'Your vault' },
  ]
  return (
    <div
      role='group'
      aria-label='What an employer sees'
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
                ? 'bg-[#f15a2b]/20 text-[#f15a2b] ring-1 ring-[#f15a2b]/45'
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

function ContrastList({
  rows,
}: {
  rows: readonly { ok: boolean; text: string; tag: string }[]
}) {
  return (
    <ul className='space-y-3'>
      {rows.map((row) => (
        <li key={row.text} className='flex items-start gap-3'>
          <span
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1',
              row.ok
                ? 'bg-[#f15a2b]/15 text-[#f15a2b] ring-[#f15a2b]/35'
                : 'bg-white/[0.04] text-ironside ring-white/10',
            )}
          >
            {row.ok ? <Check className='h-3 w-3' /> : <X className='h-3 w-3' />}
          </span>
          <span className={cn('text-sm leading-relaxed sm:text-[15px]', row.ok ? INK.bodyBright : 'text-ironside')}>
            {row.text}
            <span
              className={cn(
                'ml-2 font-mono text-[9px] font-semibold uppercase tracking-wider',
                row.ok ? 'text-[#f15a2b]/80' : 'text-slate-600',
              )}
            >
              {row.tag}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function DisclosureSection() {
  const [view, setView] = useState<DisclosureView>('shared')

  return (
    <InkBand className='border-y border-white/[0.06]' atmosphere={null}>
      <LandingContainer className='py-20 sm:py-28'>
        <div className='grid items-center gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20'>
          <div className='min-w-0' data-reveal>
            <SectionHeader
              eyebrow='When an employer asks'
              title={
                <>
                  Verify what they need.
                  <br />
                  Keep the rest.
                </>
              }
              onInk
              className='reveal-item'
            />
            <p
              className={cn('reveal-item mt-6 text-base leading-relaxed sm:text-lg', INK.body)}
              style={{ transitionDelay: '100ms' }}
            >
              Screening consent, a motor vehicle record, and PSP come in when a company is
              already working with you. A licensed screener issues those facts. Answers you
              typed on the application stay labeled as yours.
            </p>

            <div className='reveal-item mt-8' style={{ transitionDelay: '160ms' }}>
              <ContrastList rows={TRUST_ROWS} />
            </div>

            <p
              className={cn('reveal-item mt-8 text-base leading-relaxed sm:text-lg', INK.body)}
              style={{ transitionDelay: '220ms' }}
            >
              Then you can prove a fact without handing over the whole report. An employer
              can see that your record is clean without your date of birth, your address, or
              fourteen pages of detail.
            </p>

            <div className='reveal-item mt-6' style={{ transitionDelay: '280ms' }}>
              <ContrastList rows={DISCLOSE_ROWS} />
            </div>
          </div>

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
