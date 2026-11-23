'use client'

/**
 * DisclosureCard — the selective-disclosure visual.
 *
 * `view` — shared = employer projection; vault = owner sees everything.
 * Flipping the view locks or unlocks the private rows one at a time.
 */

import { useEffect, useRef, useState } from 'react'
import { Lock, Eye } from 'lucide-react'
import ProvvenMark from '@/components/ui/ProvvenMark'
import { cn } from '@/lib/utils'
import { PAPER_DOCUMENT } from './landing-shared'

export type DisclosureView = 'shared' | 'vault'

interface DisclosureCardProps {
  view: DisclosureView
  className?: string
}

/** Screener-backed facts only — never a self-typed resume or DOT field. */
const SHARED_FACTS = [
  {
    fact: 'Clean MVR · 36 months',
    source: 'Licensed screener',
  },
  {
    fact: 'Class D · Ohio',
    source: 'From the motor vehicle record',
  },
  {
    fact: 'Endorsements · Hazmat + Tanker',
    source: 'From the motor vehicle record',
  },
] as const

const PRIVATE_ROWS = [
  { label: 'Date of birth', value: 'On file', bars: ['w-20'] },
  { label: 'Home address', value: 'Raccoon City', bars: ['w-28'] },
  { label: 'License number', value: 'On file', bars: ['w-16', 'w-24'] },
  { label: 'Full MVR report', value: 'On file', bars: ['w-24', 'w-14'] },
] as const

/**
 * Unlock/lock private rows one at a time so the flip is a short sequence.
 * Each step schedules the next with a timeout; the cleanup cancels the chain
 * if the view flips again mid-sequence.
 */
function useToggleStagger(isShared: boolean) {
  const [unlocked, setUnlocked] = useState(isShared ? 0 : PRIVATE_ROWS.length)
  const first = useRef(true)

  useEffect(() => {
    const target = isShared ? 0 : PRIVATE_ROWS.length
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (first.current || reducedMotion) {
      first.current = false
      setUnlocked(target)
      return
    }
    let cancelled = false
    let timeout = 0
    if (!isShared) {
      setUnlocked(0)
      const step = (n: number) => {
        if (cancelled) return
        setUnlocked(n)
        if (n < PRIVATE_ROWS.length) timeout = window.setTimeout(() => step(n + 1), 150)
      }
      step(1)
    } else {
      const step = (n: number) => {
        if (cancelled) return
        setUnlocked(n)
        if (n > 0) timeout = window.setTimeout(() => step(n - 1), 110)
      }
      step(PRIVATE_ROWS.length)
    }
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [isShared])

  return unlocked
}

function Redaction({ widths }: { widths: readonly string[] }) {
  return (
    <span className='flex max-w-full items-center gap-1.5 overflow-hidden' aria-label='redacted'>
      {widths.map((w, i) => (
        <span
          key={i}
          className={cn(
            'lp-redact-bar h-2 shrink rounded-[2px] bg-gradient-to-r from-stone-300 via-stone-200 to-stone-300',
            w,
          )}
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  )
}

export default function DisclosureCard({ view, className }: DisclosureCardProps) {
  const isShared = view === 'shared'
  const unlocked = useToggleStagger(isShared)

  return (
    <div className={cn(PAPER_DOCUMENT, className)}>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f15a2b]/50 to-transparent'
      />

      <div className='flex items-start gap-3 px-5 pt-5'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#173150] text-sm font-bold text-white ring-2 ring-[#f15a2b]/40'>
          BB
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-[15px] font-semibold text-[#173150]'>Barry Burton</h3>
            <span className='inline-flex items-center gap-1 rounded-full bg-[#f15a2b]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#f15a2b] ring-1 ring-[#f15a2b]/30'>
              <ProvvenMark tone='auto' className='h-3 w-auto' />
              Verified by Provven
            </span>
          </div>
          <p className='mt-0.5 text-xs text-ironside'>Class D · Hazmat + Tanker · Raccoon City</p>
        </div>
      </div>

      <div className='mx-5 mt-4 rounded-lg bg-[#f3f4f5] px-3 py-2'>
        <p className='min-h-[1.25rem] font-mono text-[10px] tracking-wide text-ironside'>
          {isShared ? (
            <>
              <span className='text-[#f15a2b]'>sharing with Pace Drivers</span> · 3 facts · 0 documents
            </>
          ) : (
            <>
              <span className='text-[#f15a2b]'>your vault</span> · everything · visible only to you
            </>
          )}
        </p>
      </div>

      <ul className='space-y-1.5 px-5 pt-4'>
        {SHARED_FACTS.map((row) => (
          <li
            key={row.fact}
            className='flex min-h-[3.25rem] items-center gap-2.5 rounded-lg bg-[#f15a2b]/[0.06] px-3 py-2 ring-1 ring-inset ring-[#f15a2b]/20'
          >
            <ProvvenMark tone='auto' className='h-4 w-auto shrink-0' />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-[13px] font-medium text-[#173150]'>{row.fact}</p>
              <p className='truncate text-[10px] text-ironside'>{row.source}</p>
            </div>
            <span className='shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#f15a2b]'>
              verified
            </span>
          </li>
        ))}
      </ul>

      <div className='relative my-4 flex items-center gap-3 px-5' aria-hidden>
        <span className='h-px flex-1 bg-gradient-to-r from-transparent via-[#f15a2b]/55 to-[#f15a2b]/55' />
        <span className='inline-flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-[#f15a2b]'>
          <Lock className='h-3 w-3' />
          selective disclosure
        </span>
        <span className='h-px flex-1 bg-gradient-to-l from-transparent via-[#f15a2b]/55 to-[#f15a2b]/55' />
      </div>

      <ul className='space-y-1 px-5'>
        {PRIVATE_ROWS.map((row, i) => {
          const open = i < unlocked
          return (
            <li
              key={row.label}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-300',
                open
                  ? 'bg-[#f15a2b]/[0.05] opacity-100 ring-1 ring-inset ring-[#f15a2b]/15'
                  : 'opacity-70',
              )}
            >
              {open ? (
                <Eye className='h-3 w-3 shrink-0 text-[#f15a2b]/80' />
              ) : (
                <Lock className='h-3 w-3 shrink-0 text-ironside' />
              )}
              <p className='w-20 shrink-0 text-[11px] text-ironside sm:w-[7.5rem]'>{row.label}</p>
              <div className='relative min-w-0 flex-1 overflow-hidden'>
                <span className={cn('block transition-opacity duration-300', open ? 'pointer-events-none absolute inset-0 opacity-0' : 'opacity-100')}>
                  <Redaction widths={row.bars} />
                </span>
                <span
                  className={cn(
                    'block truncate text-[11px] text-[#173150] transition-opacity duration-300',
                    open ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
                  )}
                >
                  {row.value}
                </span>
              </div>
              <span
                className={cn(
                  'shrink-0 font-mono text-[8px] font-semibold uppercase tracking-wider',
                  open ? 'text-[#f15a2b]/80' : 'text-ironside',
                )}
              >
                {open ? 'only you' : 'stays private'}
              </span>
            </li>
          )
        })}
      </ul>

      <p className='px-5 pb-5 pt-4 text-center text-[10px] leading-relaxed text-ironside'>
        {isShared
          ? 'Only what Barry chose to share leaves the vault. Nothing else.'
          : 'Every share starts here — and every share is your call.'}
      </p>
    </div>
  )
}
