'use client'

/**
 * For employers & agencies — the second audience. Copy leads with signal
 * quality; the visual is a deliberate product mock of block-specific requests
 * (the actual employer flow in the app).
 */

import { ArrowRight, BadgeCheck, FileText, Gauge, IdCard, ShieldCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { GOLD_CTA, headingText, mutedText, LandingContainer, SectionHeader } from './landing-shared'

const POINTS = [
  {
    title: 'Structured, comparable candidates',
    body: 'Every Career Card has the same shape. Compare CDL class, endorsements, and verified history at a glance — not fourteen resume formats.',
  },
  {
    title: 'Request exactly what you need',
    body: 'Ask a candidate for the specific block your role requires — resume, MVR, CDL, employment verification. They know what you need; you get what you asked for.',
  },
  {
    title: 'Pre-qualified before you spend',
    body: 'Verified facts up front mean fewer surprises at screening time, faster placements, and less sensitive PII sitting in your inbox.',
  },
] as const

/** Static mock of the in-app block-request flow */
function RequestMock({ isDark }: { isDark: boolean }) {
  const chip = (icon: React.ReactNode, label: string, active?: boolean) => (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold',
        active
          ? isDark
            ? 'border-[#c9a86a]/40 bg-[#c9a86a]/15 text-[#e6cf9f]'
            : 'border-[#c9a86a]/60 bg-[#f5eeda] text-[#5d4a1e]'
          : isDark
            ? 'border-white/10 bg-white/[0.03] text-gray-400'
            : 'border-stone-200 bg-white text-stone-500',
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
        isDark ? 'border-white/10 bg-gray-900/70' : 'border-stone-200 bg-white/90',
      )}
    >
      <p className={cn('text-[10px] font-semibold uppercase tracking-[0.2em]', isDark ? 'text-gray-500' : 'text-stone-400')}>
        Request from Marcus Reed
      </p>
      <div className='mt-3 flex flex-wrap gap-2'>
        {chip(<FileText className='h-3.5 w-3.5' />, 'Resume')}
        {chip(<Gauge className='h-3.5 w-3.5' />, 'MVR', true)}
        {chip(<IdCard className='h-3.5 w-3.5' />, 'CDL')}
      </div>
      <div
        className={cn(
          'mt-4 flex items-center gap-2.5 rounded-lg px-3 py-2.5',
          isDark ? 'bg-[#c9a86a]/[0.08] ring-1 ring-inset ring-[#c9a86a]/25' : 'bg-[#f5eeda] ring-1 ring-inset ring-[#c9a86a]/40',
        )}
      >
        <ShieldCheck className={cn('h-4 w-4 shrink-0', isDark ? 'text-[#d4be93]' : 'text-[#8a6d3b]')} />
        <div className='min-w-0'>
          <p className={cn('text-xs font-semibold', isDark ? 'text-[#e6cf9f]' : 'text-[#5d4a1e]')}>
            Clean MVR — 36 months · verified
          </p>
          <p className={cn('text-[10px]', isDark ? 'text-[#d4be93]/70' : 'text-[#8a6d3b]/85')}>
            Fact shared by candidate · ready to review
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
}

/**
 * Employer accounts are provisioned by Provven, so this CTA opens a conversation
 * rather than a signup. It used to share `onGetStarted` with the candidate CTA,
 * which routed to /sign-in — meaning a hiring manager clicking "I'm hiring" was
 * silently onboarded as a candidate.
 *
 * That conversation IS the credentialing step: an employer account can order an
 * MVR against a state DMV and a PSP against FMCSA, so DPPA and FCRA make a
 * self-serve form hard to defend as "reasonable procedures".
 */
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_EMPLOYER_CONTACT_EMAIL || 'hello@provven.com'

const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Hiring on Provven'
)}&body=${encodeURIComponent(
  `Company:\nDOT number:\nYour name and role:\nWhat you're hiring for:\n\nWe'll get back to you to set up your account.`
)}`

export default function EmployersSection({ isDark }: EmployersSectionProps) {
  return (
    <section
      id='employers'
      className={cn('scroll-mt-24 border-y py-20 sm:py-28', isDark ? 'border-gray-800 bg-white/[0.015]' : 'border-stone-200 bg-[#eee8da]/60')}
    >
      <LandingContainer>
        <div className='grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20'>
          <div data-reveal>
            <SectionHeader
              eyebrow='For employers & agencies'
              title='Signal you can act on.'
              lede='Built with trucking recruiters first — DQ files, MVR, PSP, DOT applications — and designed to carry any credentialed career.'
              isDark={isDark}
              className='reveal-item'
            />

            <ul className='reveal-item mt-8 space-y-5' style={{ transitionDelay: '140ms' }}>
              {POINTS.map((point) => (
                <li key={point.title} className='flex gap-3.5'>
                  <BadgeCheck className={cn('mt-0.5 h-5 w-5 shrink-0', isDark ? 'text-[#d4be93]' : 'text-[#8a6d3b]')} />
                  <div>
                    <h3 className={cn('text-[15px] font-semibold', headingText(isDark))}>{point.title}</h3>
                    <p className={cn('mt-1 text-sm leading-relaxed', mutedText(isDark))}>{point.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className='reveal-item mt-9' style={{ transitionDelay: '260ms' }}>
              <Button
                variant='primary'
                size='lg'
                onClick={() => { window.location.href = MAILTO }}
                className={cn('group h-auto rounded-xl px-7 py-3.5', GOLD_CTA)}
              >
                I&rsquo;m hiring &mdash; talk to us
                <ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
              </Button>
              <p className={cn('mt-3 text-sm', mutedText(isDark))}>
                Employer accounts are set up by our team — we verify the carrier before anyone can
                order an MVR or PSP.
              </p>
            </div>
          </div>

          <div data-reveal className='reveal-item' style={{ transitionDelay: '180ms' }}>
            <RequestMock isDark={isDark} />
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
