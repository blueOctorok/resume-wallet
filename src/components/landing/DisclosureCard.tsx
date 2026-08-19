'use client'

/**
 * DisclosureCard — the landing page's core product visual.
 *
 * `view`  — shared = employer projection; vault = owner sees everything.
 * `live`  — hero demo: facts stamp in, a share types, then private rows
 *           lock/unlock. Motion explains selective disclosure (Stripe-style).
 */

import { useEffect, useRef, useState } from 'react'
import { Lock, Eye } from 'lucide-react'
import ProvvenMark from '@/components/ui/ProvvenMark'
import { cn } from '@/lib/utils'

export type DisclosureView = 'shared' | 'vault'

interface DisclosureCardProps {
  view: DisclosureView
  live?: boolean
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

const SHARE_TARGETS = ['Pace Drivers', 'Schneider', 'a Dallas carrier'] as const

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function wait(ms: number, getTimeout: (id: number) => void) {
  return new Promise<void>((resolve) => {
    getTimeout(window.setTimeout(resolve, ms))
  })
}

async function typeTo(
  word: string,
  setText: (s: string) => void,
  cancelled: () => boolean,
  setTimeoutId: (id: number) => void,
  step = 48,
) {
  for (let c = 1; c <= word.length; c++) {
    if (cancelled()) return
    setText(word.slice(0, c))
    await wait(step, setTimeoutId)
  }
}

async function deleteFrom(
  word: string,
  setText: (s: string) => void,
  cancelled: () => boolean,
  setTimeoutId: (id: number) => void,
  step = 32,
) {
  for (let c = word.length; c >= 0; c--) {
    if (cancelled()) return
    setText(word.slice(0, c))
    await wait(step, setTimeoutId)
  }
}

/** Hero loop: stamp facts → type a share → unlock vault → lock → next audience. */
function useLiveDemo(enabled: boolean) {
  const [view, setView] = useState<DisclosureView>('shared')
  const [factsOn, setFactsOn] = useState(enabled ? 0 : VERIFIED_FACTS.length)
  const [stamped, setStamped] = useState(enabled ? 0 : VERIFIED_FACTS.length)
  const [unlocked, setUnlocked] = useState(0)
  const [share, setShare] = useState(SHARE_TARGETS[0])
  const [caret, setCaret] = useState(false)
  const [seamPulse, setSeamPulse] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setView('shared')
      setFactsOn(VERIFIED_FACTS.length)
      setStamped(VERIFIED_FACTS.length)
      setUnlocked(0)
      setShare(SHARE_TARGETS[0])
      setCaret(false)
      return
    }
    if (reducedMotion()) {
      setFactsOn(VERIFIED_FACTS.length)
      setStamped(VERIFIED_FACTS.length)
      setCaret(false)
      return
    }

    let cancelled = false
    let timeout = 0
    const track = (id: number) => {
      timeout = id
    }
    const dead = () => cancelled

    const pulseSeam = () => setSeamPulse((n) => n + 1)

    const run = async () => {
      setView('shared')
      setFactsOn(0)
      setStamped(0)
      setUnlocked(0)
      setShare('')
      setCaret(true)
      await wait(400, track)

      for (let i = 1; i <= VERIFIED_FACTS.length; i++) {
        if (dead()) return
        setFactsOn(i)
        await wait(160, track)
        setStamped(i)
        await wait(380, track)
      }

      let audience = 0
      while (!dead()) {
        const target = SHARE_TARGETS[audience]
        await typeTo(target, setShare, dead, track)
        if (dead()) return
        await wait(1600, track)

        pulseSeam()
        setView('vault')
        for (let i = 1; i <= PRIVATE_ROWS.length; i++) {
          if (dead()) return
          setUnlocked(i)
          await wait(200, track)
        }
        await wait(2200, track)

        pulseSeam()
        for (let i = PRIVATE_ROWS.length - 1; i >= 0; i--) {
          if (dead()) return
          setUnlocked(i)
          await wait(140, track)
        }
        setView('shared')
        await wait(700, track)

        await deleteFrom(target, setShare, dead, track)
        if (dead()) return
        await wait(240, track)
        audience = (audience + 1) % SHARE_TARGETS.length
      }
    }

    void run()
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [enabled])

  return { view, factsOn, stamped, unlocked, share, caret, seamPulse }
}

/** Manual toggle: unlock/lock private rows one at a time so the flip isn’t a hard cut. */
function useToggleStagger(isShared: boolean, enabled: boolean) {
  const [unlocked, setUnlocked] = useState(isShared ? 0 : PRIVATE_ROWS.length)
  const first = useRef(true)

  useEffect(() => {
    if (!enabled) return
    if (first.current) {
      first.current = false
      setUnlocked(isShared ? 0 : PRIVATE_ROWS.length)
      return
    }
    if (reducedMotion()) {
      setUnlocked(isShared ? 0 : PRIVATE_ROWS.length)
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
  }, [isShared, enabled])

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

export default function DisclosureCard({ view, live = false, className }: DisclosureCardProps) {
  const demo = useLiveDemo(live)
  const resolvedView = live ? demo.view : view
  const isShared = resolvedView === 'shared'
  const toggleUnlocked = useToggleStagger(isShared, !live)
  const unlocked = live ? demo.unlocked : toggleUnlocked
  const factsOn = live ? demo.factsOn : VERIFIED_FACTS.length
  const stamped = live ? demo.stamped : VERIFIED_FACTS.length
  const shareTarget = live ? demo.share : SHARE_TARGETS[0]
  const showCaret = live && demo.caret && isShared

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
            <span className='inline-flex items-center gap-1 rounded-full bg-[#f15a2b]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#f15a2b] ring-1 ring-[#f15a2b]/30'>
              <ProvvenMark tone='auto' className='h-3 w-auto' />
              Verified by Provven
            </span>
          </div>
          <p className='mt-0.5 text-xs text-ironside'>CDL-A driver · 9 years · Dallas, TX</p>
        </div>
      </div>

      <div className='mx-5 mt-4 rounded-lg bg-[#f3f4f5] px-3 py-2'>
        <p className='min-h-[1.25rem] font-mono text-[10px] tracking-wide text-ironside'>
          {isShared ? (
            <>
              <span className='text-[#f15a2b]'>
                sharing with {shareTarget}
                {showCaret && (
                  <span
                    aria-hidden
                    className='ml-px inline-block h-[0.85em] w-px translate-y-px bg-[#f15a2b] align-middle animate-pulse'
                  />
                )}
              </span>{' '}
              · 3 facts · 0 documents
            </>
          ) : (
            <>
              <span className='text-[#f15a2b]'>your vault</span> · everything · visible only to you
            </>
          )}
        </p>
      </div>

      <ul className='space-y-1.5 px-5 pt-4'>
        {VERIFIED_FACTS.map((row, i) => {
          const on = i < factsOn
          const isStamped = i < stamped
          return (
            <li
              key={row.fact}
              className={cn(
                'flex min-h-[3.25rem] items-center gap-2.5 rounded-lg px-3 py-2 ring-1 ring-inset transition-all duration-300',
                on
                  ? 'bg-[#f15a2b]/[0.06] ring-[#f15a2b]/20'
                  : 'bg-transparent ring-stone-200/80',
              )}
            >
              <ProvvenMark
                tone='auto'
                className={cn('h-4 w-auto shrink-0 transition-opacity duration-300', on ? 'opacity-100' : 'opacity-20')}
              />
              <div className='min-w-0 flex-1'>
                <p
                  className={cn(
                    'truncate text-[13px] font-medium transition-opacity duration-300',
                    on ? 'text-[#173150] opacity-100' : 'text-ironside opacity-40',
                  )}
                >
                  {on ? row.fact : '—'}
                </p>
                <p className={cn('truncate text-[10px] text-ironside transition-opacity duration-300', on ? 'opacity-100' : 'opacity-0')}>
                  {row.source}
                </p>
              </div>
              {isStamped && (
                <span className='lp-stamp shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#f15a2b]'>
                  verified
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <div
        key={live ? demo.seamPulse : resolvedView}
        className={cn('relative my-4 flex items-center gap-3 px-5', live && 'lp-seam-pulse')}
        aria-hidden
      >
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
          ? 'Only what Marcus chose to share leaves the vault. Nothing else.'
          : 'Every share starts here — and every share is your call.'}
      </p>
    </div>
  )
}
