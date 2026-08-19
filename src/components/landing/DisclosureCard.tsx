'use client'

/**
 * DisclosureCard — the landing page's core product visual.
 *
 * Paper card on the ink plane: verified facts above the ember seam,
 * private rows below. White so it reads as a document, not more navy.
 *
 * `view='shared'`  → employer projection: facts lit, private rows redacted.
 * `view='vault'`   → owner view: private rows revealed, marked "only you".
 */

import { Lock, Eye } from 'lucide-react'
import ProvvenMark from '@/components/ui/ProvvenMark'
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
            'h-2 shrink rounded-[2px] bg-gradient-to-r from-stone-300 via-stone-200 to-stone-300',
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
        'relative w-full max-w-md overflow-hidden rounded-2xl border border-ironside/30 bg-white',
        'shadow-[0_24px_70px_-18px_rgba(0,0,0,0.45),0_0_0_1px_rgba(23,49,80,0.06)]',
        className,
      )}
    >
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f15a2b]/50 to-transparent'
      />

      <div className='flex items-start gap-3 px-5 pt-5'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#173150] text-sm font-bold text-white ring-2 ring-[#f15a2b]/40'>
          MR
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-[15px] font-semibold text-[#173150]'>Marcus Reed</h3>
            <span className='inline-flex items-center gap-1 rounded-full bg-[#f15a2b]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#c43d14] ring-1 ring-[#f15a2b]/30'>
              <ProvvenMark tone='auto' className='h-3 w-auto' />
              Verified by Provven
            </span>
          </div>
          <p className='mt-0.5 text-xs text-ironside'>CDL-A driver · 9 years · Dallas, TX</p>
        </div>
      </div>

      <div className='mx-5 mt-4 rounded-lg bg-[#f3f4f5] px-3 py-2'>
        <p className='font-mono text-[10px] tracking-wide text-ironside'>
          {isShared ? (
            <>
              <span className='text-[#c43d14]'>sharing with Pace Drivers</span> · 3 facts · 0 documents
            </>
          ) : (
            <>
              <span className='text-[#c43d14]'>your vault</span> · everything · visible only to you
            </>
          )}
        </p>
      </div>

      <ul className='space-y-1.5 px-5 pt-4'>
        {VERIFIED_FACTS.map((row) => (
          <li
            key={row.fact}
            className='flex items-center gap-2.5 rounded-lg bg-[#f15a2b]/[0.06] px-3 py-2 ring-1 ring-inset ring-[#f15a2b]/20'
          >
            <ProvvenMark tone='auto' className='h-4 w-auto shrink-0' />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-[13px] font-medium text-[#173150]'>{row.fact}</p>
              <p className='truncate text-[10px] text-ironside'>{row.source}</p>
            </div>
            <span className='shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#c43d14]'>
              verified
            </span>
          </li>
        ))}
      </ul>

      <div className='relative my-4 flex items-center gap-3 px-5' aria-hidden>
        <span className='h-px flex-1 bg-gradient-to-r from-transparent via-[#f15a2b]/55 to-[#f15a2b]/55' />
        <span className='inline-flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-[#c43d14]'>
          <Lock className='h-3 w-3' />
          selective disclosure
        </span>
        <span className='h-px flex-1 bg-gradient-to-l from-transparent via-[#f15a2b]/55 to-[#f15a2b]/55' />
      </div>

      <ul className='space-y-1 px-5'>
        {PRIVATE_ROWS.map((row) => (
          <li
            key={row.label}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-500',
              isShared ? 'opacity-70' : 'bg-[#f15a2b]/[0.05] opacity-100 ring-1 ring-inset ring-[#f15a2b]/15',
            )}
          >
            {isShared ? (
              <Lock className='h-3 w-3 shrink-0 text-ironside' />
            ) : (
              <Eye className='h-3 w-3 shrink-0 text-[#c43d14]/80' />
            )}
            <p className='w-20 shrink-0 text-[11px] text-ironside sm:w-[7.5rem]'>{row.label}</p>
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
                  'block truncate text-[11px] text-[#173150] transition-opacity duration-500',
                  isShared ? 'pointer-events-none absolute inset-0 opacity-0' : 'opacity-100',
                )}
              >
                {row.value}
              </span>
            </div>
            <span
              className={cn(
                'shrink-0 font-mono text-[8px] font-semibold uppercase tracking-wider',
                isShared ? 'text-ironside' : 'text-[#c43d14]/80',
              )}
            >
              {isShared ? 'stays private' : 'only you'}
            </span>
          </li>
        ))}
      </ul>

      <p className='px-5 pb-5 pt-4 text-center text-[10px] leading-relaxed text-ironside'>
        {isShared
          ? 'Only what Marcus chose to share leaves the vault. Nothing else.'
          : 'Every share starts here — and every share is your call.'}
      </p>
    </div>
  )
}
