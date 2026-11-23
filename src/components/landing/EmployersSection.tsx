'use client'

/**
 * For employers & agencies — the file they receive and the ask they send.
 * Resume-format comparison sits behind that.
 */

import { useState } from 'react'
import { ArrowRight, BadgeCheck, ClipboardList, FileSignature, Gauge, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GOLD_CTA, headingText, mutedText, paperBand, LandingContainer, SectionHeader } from './landing-shared'
import EmployerAccessModal from '@/components/employer/EmployerAccessModal'

const POINTS = [
  {
    title: 'Open the DQ file they already finished',
    body: 'Ask for the driver qualification file. The DOT application, license fields, and history are one packet — not fourteen resume layouts.',
  },
  {
    title: 'Ask for the next step, not a pile of PDFs',
    body: 'Request screening consent, then order an MVR or PSP through a licensed screener. The driver knows what you need before you spend.',
  },
  {
    title: 'Facts before the full report',
    body: 'See issuer-backed license class and clean-window facts on the card. The full report stays behind the share the driver authorizes.',
  },
] as const

/** Static mock of the in-app ask flow — DQ file first, then consent / MVR. */
function RequestMock({ isDark }: { isDark: boolean }) {
  const chip = (icon: React.ReactNode, label: string, active?: boolean) => (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold',
        active
          ? isDark
            ? 'border-[#f15a2b]/40 bg-[#f15a2b]/15 text-[#f15a2b]'
            : 'border-[#f15a2b]/60 bg-[#f15a2b]/10 text-[#173150]'
          : isDark
            ? 'border-white/10 bg-white/[0.03] text-gray-400'
            : 'border-ironside/30 bg-white text-ironside',
      )}
    >
      {icon}
      {label}
    </span>
  )

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 shadow-lg',
        isDark ? 'border-white/10 bg-gray-900/70' : 'border-ironside/30 bg-white/90',
      )}
    >
      <p className='text-[10px] font-semibold uppercase tracking-[0.2em] text-ironside'>
        Request from Barry Burton
      </p>
      <div className='mt-3 flex flex-wrap gap-2'>
        {chip(<ClipboardList className='h-3.5 w-3.5' />, 'DQ file', true)}
        {chip(<FileSignature className='h-3.5 w-3.5' />, 'Consent')}
        {chip(<Gauge className='h-3.5 w-3.5' />, 'MVR')}
      </div>
      <div
        className={cn(
          'mt-4 flex items-center gap-2.5 rounded-lg px-3 py-2.5',
          isDark
            ? 'bg-[#f15a2b]/[0.08] ring-1 ring-inset ring-[#f15a2b]/25'
            : 'bg-[#f15a2b]/10 ring-1 ring-inset ring-[#f15a2b]/40',
        )}
      >
        <ShieldCheck className='h-4 w-4 shrink-0 text-[#f15a2b]' />
        <div className='min-w-0'>
          <p className={cn('text-xs font-semibold', isDark ? 'text-[#f15a2b]' : 'text-[#173150]')}>
            DOT application on file
          </p>
          <p className={cn('text-[10px]', isDark ? 'text-[#f15a2b]/70' : 'text-[#f15a2b]/85')}>
            Shared by the driver · same packet for your ask
          </p>
        </div>
      </div>
      <p className={cn('mt-3 text-[10px] leading-relaxed', mutedText(isDark))}>
        Screening orders still run through licensed CRAs with the candidate&rsquo;s explicit
        consent — Provven pre-qualifies, it doesn&rsquo;t replace compliance.
      </p>
    </div>
  )
}

interface EmployersSectionProps {
  isDark: boolean
  /** Existing members — /sign-in?intent=login (not self-serve signup) */
  onLogIn: () => void
}

export default function EmployersSection({ isDark, onLogIn }: EmployersSectionProps) {
  const [showAccess, setShowAccess] = useState(false)
  return (
    <section
      id='employers'
      className={cn(
        'scroll-mt-24 border-y py-20 sm:py-28',
        isDark ? 'border-gray-800' : 'border-stone-200',
        paperBand(isDark, true),
      )}
    >
      <LandingContainer>
        <div className='grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20'>
          <div data-reveal>
            <SectionHeader
              eyebrow='For employers & agencies'
              title='Receive the file. Ask for the next piece.'
              lede='Built with trucking recruiters first — the DQ file, screening consent, MVR, and PSP — so you spend screening dollars on drivers who already shared their application.'
              isDark={isDark}
              className='reveal-item'
            />

            <ul className='reveal-item mt-8 space-y-5' style={{ transitionDelay: '140ms' }}>
              {POINTS.map((point) => (
                <li key={point.title} className='flex gap-3.5'>
                  <BadgeCheck className='mt-0.5 h-5 w-5 shrink-0 text-[#f15a2b]' />
                  <div>
                    <h3 className={cn('text-[15px] font-semibold', headingText(isDark))}>{point.title}</h3>
                    <p className={cn('mt-1 text-sm leading-relaxed', mutedText(isDark))}>{point.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className='reveal-item mt-9' style={{ transitionDelay: '260ms' }}>
              <button
                type='button'
                onClick={() => setShowAccess(true)}
                className={cn(
                  'group inline-flex h-auto items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold transition-all duration-200',
                  GOLD_CTA,
                )}
              >
                Find drivers
                <ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
              </button>
              <p className={cn('mt-3 text-sm', mutedText(isDark))}>
                Company email only. We approve the account before you can search — no setup, and it
                doesn&rsquo;t replace the screening tools you already use.
              </p>
              <button
                type='button'
                onClick={onLogIn}
                className={cn(
                  'mt-4 text-sm font-medium underline underline-offset-4 transition-colors',
                  isDark
                    ? 'text-[#f15a2b] decoration-[#f15a2b]/40 hover:decoration-[#f15a2b]/80'
                    : 'text-[#f15a2b] decoration-[#f15a2b]/50 hover:decoration-[#f15a2b]',
                )}
              >
                Already on Provven? Log in
              </button>
            </div>
          </div>

          <div data-reveal className='reveal-item' style={{ transitionDelay: '180ms' }}>
            <RequestMock isDark={isDark} />
          </div>
        </div>
      </LandingContainer>
      {showAccess && <EmployerAccessModal onClose={() => setShowAccess(false)} />}
    </section>
  )
}
