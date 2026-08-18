'use client'

/**
 * For employers & agencies — the second audience. Copy leads with signal
 * quality; the visual is a deliberate product mock of block-specific requests
 * (the actual employer flow in the app).
 */

import { ArrowRight, BadgeCheck, FileText, Gauge, IdCard, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GOLD_CTA, headingText, mutedText, paperBand, LandingContainer, SectionHeader } from './landing-shared'

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
            ? 'border-[#c99700]/40 bg-[#c99700]/15 text-[#e0c56a]'
            : 'border-[#c99700]/60 bg-[#f5eeda] text-[#5d4a1e]'
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
          isDark ? 'bg-[#c99700]/[0.08] ring-1 ring-inset ring-[#c99700]/25' : 'bg-[#f5eeda] ring-1 ring-inset ring-[#c99700]/40',
        )}
      >
        <ShieldCheck className={cn('h-4 w-4 shrink-0', isDark ? 'text-[#d4b44a]' : 'text-[#8a6700]')} />
        <div className='min-w-0'>
          <p className={cn('text-xs font-semibold', isDark ? 'text-[#e0c56a]' : 'text-[#5d4a1e]')}>
            Clean MVR — 36 months · verified
          </p>
          <p className={cn('text-[10px]', isDark ? 'text-[#d4b44a]/70' : 'text-[#8a6700]/85')}>
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
  /** Existing members — /sign-in?intent=login (not self-serve signup) */
  onLogIn: () => void
}

/**
 * New employer accounts are provisioned by Provven (mailto) — not self-serve signup.
 * Existing members use Employer login → /sign-in; role routing lands them in EmployerShell.
 *
 * DPPA / FCRA: an employer account can order MVR/PSP, so "reasonable procedures"
 * mean we verify the carrier before anyone can order.
 */
// Hiring leads go to Pace ops (not a brand inbox — those aren't set up yet).
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_EMPLOYER_CONTACT_EMAIL || 's.blaha@pacedrivers.com'

const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Hiring on Provven'
)}&body=${encodeURIComponent(
  `Company:\nDOT number:\nYour name and role:\nWhat you're hiring for:\n\nWe'll get back to you to set up your account.`
)}`

export default function EmployersSection({ isDark, onLogIn }: EmployersSectionProps) {
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
              title='Signal you can act on.'
              lede='Built with trucking recruiters first — DQ files, MVR, PSP, DOT applications — and designed to carry any credentialed career.'
              isDark={isDark}
              className='reveal-item'
            />

            <ul className='reveal-item mt-8 space-y-5' style={{ transitionDelay: '140ms' }}>
              {POINTS.map((point) => (
                <li key={point.title} className='flex gap-3.5'>
                  <BadgeCheck className={cn('mt-0.5 h-5 w-5 shrink-0', isDark ? 'text-[#d4b44a]' : 'text-[#8a6700]')} />
                  <div>
                    <h3 className={cn('text-[15px] font-semibold', headingText(isDark))}>{point.title}</h3>
                    <p className={cn('mt-1 text-sm leading-relaxed', mutedText(isDark))}>{point.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className='reveal-item mt-9' style={{ transitionDelay: '260ms' }}>
              {/* Real <a href=mailto> — window.location mailto often does nothing on WSL/Linux */}
              <a
                href={MAILTO}
                className={cn(
                  'group inline-flex h-auto items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold transition-all duration-200',
                  GOLD_CTA,
                )}
              >
                I&rsquo;m hiring &mdash; talk to us
                <ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
              </a>
              <p className={cn('mt-3 text-sm', mutedText(isDark))}>
                Email{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className={cn(
                    'font-medium underline underline-offset-2',
                    isDark ? 'text-[#d4b44a]' : 'text-[#8a6700]',
                  )}
                >
                  {CONTACT_EMAIL}
                </a>
                {' '}
                — we verify the carrier before anyone can order an MVR or PSP.
              </p>
              <button
                type='button'
                onClick={onLogIn}
                className={cn(
                  'mt-4 text-sm font-medium underline underline-offset-4 transition-colors',
                  isDark
                    ? 'text-[#d4b44a] decoration-[#c99700]/40 hover:decoration-[#c99700]/80'
                    : 'text-[#8a6700] decoration-[#c99700]/50 hover:decoration-[#8a6700]',
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
    </section>
  )
}
