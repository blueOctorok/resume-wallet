'use client'

/**
 * Built for trust — the Midnight / zero-knowledge narrative.
 *
 * Language is deliberately present-continuous ("built on", "designed for"):
 * we celebrate the architecture without claiming any specific fact is
 * ZK-proven on-chain today. The honesty line about self-reported data is a
 * feature, not fine print — it's what makes the verified badge worth trusting.
 */

import { EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INK, InkBand, LandingContainer, SectionHeader } from './landing-shared'

const PILLARS = [
  {
    icon: EyeOff,
    accent: 'violet' as const,
    title: 'Zero-knowledge by design',
    body: 'Provven is built on Midnight, a privacy-first blockchain, and designed for zero-knowledge selective disclosure — proving a fact is true without revealing the document behind it.',
  },
  {
    icon: ShieldCheck,
    accent: 'teal' as const,
    title: 'Verified means verified',
    body: 'Only facts from licensed screeners and issuers carry the badge — MVR, screening data, employment. Self-reported claims never do. That honesty is why the badge means something.',
  },
  {
    icon: KeyRound,
    accent: 'slate' as const,
    title: 'Nothing to manage',
    body: 'No wallets, no seed phrases, no tokens, nothing to install. The cryptography does its work where you never have to see it — you just build, verify, and share.',
  },
] as const

const ACCENT_STYLES = {
  violet: 'bg-violet-500/12 text-violet-300 ring-violet-400/25',
  teal: 'bg-teal-500/12 text-teal-300 ring-teal-400/25',
  slate: 'bg-white/[0.06] text-slate-300 ring-white/15',
} as const

export default function TrustSection() {
  return (
    <InkBand
      className='border-y border-white/[0.06]'
      atmosphere={
        <div
          aria-hidden
          className='pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[44rem] -translate-x-1/2 opacity-[0.1] blur-[100px]'
          style={{ background: 'radial-gradient(ellipse, #8b5cf6 0%, transparent 70%)' }}
        />
      }
    >
      <LandingContainer className='py-20 sm:py-28'>
        <SectionHeader
          eyebrow='Built for trust'
          title='Cryptography where it counts.'
          onInk
          align='center'
        />

        {/* Decorative proof line — the "technical moment" in mono */}
        <p
          className='mx-auto mt-8 w-fit rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-center font-mono text-[11px] tracking-wide text-slate-500'
          aria-hidden
          data-reveal
        >
          <span className='reveal-item inline-block'>
            prove(<span className='text-teal-300'>mvr_clean_36mo</span>) → <span className='text-teal-300'>valid ✓</span>
            <span className='mx-2 text-slate-700'>·</span>
            document attached: <span className='text-violet-300'>none</span>
          </span>
        </p>

        <div className='mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8' data-reveal>
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon
            return (
              <div key={pillar.title} className='reveal-item text-center sm:text-left' style={{ transitionDelay: `${i * 140}ms` }}>
                <span
                  className={cn(
                    'mx-auto flex h-10 w-10 items-center justify-center rounded-xl ring-1 sm:mx-0',
                    ACCENT_STYLES[pillar.accent],
                  )}
                >
                  <Icon className='h-4.5 w-4.5' />
                </span>
                <h3 className={cn('mt-4 font-display text-xl font-medium tracking-tight', INK.heading)}>
                  {pillar.title}
                </h3>
                <p className={cn('mt-3 text-sm leading-relaxed sm:text-[15px]', INK.body)}>{pillar.body}</p>
              </div>
            )
          })}
        </div>
      </LandingContainer>
    </InkBand>
  )
}
