'use client'

/**
 * DisclosureCard — the landing page's core product visual.
 *
 * A Career Card rendered as two strata separated by a violet cryptographic
 * seam: verified facts above (what an employer receives), private source data
 * below (what never leaves the vault unless the candidate chooses).
 *
 * `view='shared'`  → employer projection: verified facts lit, private rows redacted.
 * `view='vault'`   → owner view: private rows revealed, marked "only you".
 *
 * Always ink-styled (fixed dark) — it only ever renders on `InkBand` planes,
 * so it needs exactly one color treatment. See landing-shared.tsx.
 */

import { Lock, ShieldCheck, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DisclosureView = 'shared' | 'vault'

interface DisclosureCardProps {
  view: DisclosureView
  className?: string
}

const VERIFIED_FACTS = [
  {
    fact: 'Clean MVR — 36 months',
    source: 'Derived from a licensed CRA report',
  },
  {
    fact: 'CDL-A · Hazmat + Tanker',
    source: 'Issuer-backed · TX DPS',
  },
  {
    fact: 'Employment — 3 carriers confirmed',
    source: 'Verified with prior carriers',
  },
] as const

const PRIVATE_ROWS = [
  { label: 'Date of birth', value: 'March 14, 1987', bars: ['w-20'] },
  { label: 'Home address', value: '4128 Elm Creek Dr, Dallas, TX', bars: ['w-28', 'w-12'] },
  { label: 'Violation history', value: '2 minor, resolved · 2019', bars: ['w-16', 'w-24'] },
  { label: 'Full MVR report', value: '14 pages · Feb 2026 pull', bars: ['w-24', 'w-14'] },
] as const

/** Redaction bars — visibly present, deliberately unreadable */
function Redaction({ widths }: { widths: readonly string[] }) {
  return (
    <span className='flex max-w-full items-center gap-1.5 overflow-hidden' aria-label='redacted'>
      {widths.map((w, i) => (
        <span
          key={i}
          className={cn(
            'h-2 shrink rounded-[2px] bg-gradient-to-r from-slate-500/45 via-violet-400/25 to-slate-500/45 blur-[0.5px]',
            w,
          )}
        />
      ))}
    </span>
  )
}

export default function DisclosureCard({ view, className }: DisclosureCardProps) {
  const isShared = view === 'shared'

  return (
    <div
      className={cn(
        'relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10',
        'bg-gradient-to-b from-[rgba(20,27,36,0.92)] via-[rgba(13,18,25,0.94)] to-[rgba(9,13,18,0.97)]',
        'shadow-[0_24px_70px_-18px_rgba(0,0,0,0.7),0_0_60px_-24px_rgba(45,212,191,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'backdrop-blur-md',
        className,
      )}
    >
      {/* Teal rim light along the top edge */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent'
      />

      {/* Header — identity + verification badge */}
      <div className='flex items-start gap-3 px-5 pt-5'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white ring-2 ring-teal-400/25'>
          MR
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-[15px] font-semibold text-white'>Marcus Reed</h3>
            <span className='inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-300 ring-1 ring-teal-400/30'>
              <ShieldCheck className='h-2.5 w-2.5' />
              Verified by Provven
            </span>
          </div>
          <p className='mt-0.5 text-xs text-slate-400'>CDL-A driver · 9 years · Dallas, TX</p>
        </div>
      </div>

      {/* Sharing context strip */}
      <div className='mx-5 mt-4 rounded-lg bg-white/[0.04] px-3 py-2'>
        <p className='font-mono text-[10px] tracking-wide text-slate-400'>
          {isShared ? (
            <>
              <span className='text-teal-300'>sharing with Pace Drivers</span> · 3 facts · 0 documents
            </>
          ) : (
            <>
              <span className='text-amber-300'>your vault</span> · everything · visible only to you
            </>
          )}
        </p>
      </div>

      {/* Verified facts — always lit, in both views */}
      <ul className='space-y-1.5 px-5 pt-4'>
        {VERIFIED_FACTS.map((row) => (
          <li
            key={row.fact}
            className='flex items-center gap-2.5 rounded-lg bg-teal-400/[0.06] px-3 py-2 ring-1 ring-inset ring-teal-400/15'
          >
            <ShieldCheck className='h-3.5 w-3.5 shrink-0 text-teal-300' />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-[13px] font-medium text-slate-100'>{row.fact}</p>
              <p className='truncate text-[10px] text-slate-500'>{row.source}</p>
            </div>
            <span className='shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider text-teal-400/90'>
              verified
            </span>
          </li>
        ))}
      </ul>

      {/* The seam — cryptographic boundary between shared and private */}
      <div className='relative my-4 flex items-center gap-3 px-5' aria-hidden>
        <span className='h-px flex-1 bg-gradient-to-r from-transparent via-violet-400/60 to-violet-400/60 shadow-[0_0_12px_rgba(167,139,250,0.5)]' />
        <span className='inline-flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-300/90'>
          <Lock className='h-3 w-3' />
          selective disclosure
        </span>
        <span className='h-px flex-1 bg-gradient-to-l from-transparent via-violet-400/60 to-violet-400/60 shadow-[0_0_12px_rgba(167,139,250,0.5)]' />
      </div>

      {/* Private strata — redacted when shared, revealed in the vault */}
      <ul className='space-y-1 px-5'>
        {PRIVATE_ROWS.map((row) => (
          <li
            key={row.label}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-500',
              isShared ? 'opacity-55' : 'bg-amber-400/[0.04] opacity-100 ring-1 ring-inset ring-amber-400/10',
            )}
          >
            {isShared ? (
              <Lock className='h-3 w-3 shrink-0 text-slate-500' />
            ) : (
              <Eye className='h-3 w-3 shrink-0 text-amber-300/80' />
            )}
            <p className='w-20 shrink-0 text-[11px] text-slate-400 sm:w-[7.5rem]'>{row.label}</p>
            {/* Both value states stay mounted so the swap animates as a crossfade.
                overflow-hidden keeps this cell's min-content at 0 so the card can
                shrink on narrow viewports; aria-hidden keeps the inactive state
                (incl. private values while redacted) out of the a11y tree. */}
            <div className='relative min-w-0 flex-1 overflow-hidden'>
              <span
                aria-hidden={!isShared}
                className={cn(
                  'block transition-opacity duration-500',
                  isShared ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
                )}
              >
                <Redaction widths={row.bars} />
              </span>
              <span
                aria-hidden={isShared}
                className={cn(
                  'block truncate text-[11px] text-slate-200 transition-opacity duration-500',
                  isShared ? 'pointer-events-none absolute inset-0 opacity-0' : 'opacity-100',
                )}
              >
                {row.value}
              </span>
            </div>
            <span
              className={cn(
                'shrink-0 font-mono text-[8px] font-semibold uppercase tracking-wider',
                isShared ? 'text-slate-500' : 'text-amber-300/70',
              )}
            >
              {isShared ? 'stays private' : 'only you'}
            </span>
          </li>
        ))}
      </ul>

      {/* Footer caption */}
      <p className='px-5 pb-5 pt-4 text-center text-[10px] leading-relaxed text-slate-500'>
        {isShared
          ? 'Only what Marcus chose to share leaves the vault. Nothing else.'
          : 'Every share starts here — and every share is your call.'}
      </p>
    </div>
  )
}
