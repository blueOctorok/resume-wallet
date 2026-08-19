'use client'

/**
 * The Career Card — a living identity assembled from blocks.
 * The visual is a block grid in three honest states (verified / added /
 * suggested) so "sparse card is still a valid card" is shown, not claimed.
 */

import {
  ClipboardList,
  FileText,
  Gauge,
  GraduationCap,
  IdCard,
  Plus,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { headingText, mutedText, paperBand, LandingContainer, SectionHeader } from './landing-shared'

type BlockState = 'verified' | 'added' | 'suggested'

const BLOCKS: Array<{ icon: typeof FileText; label: string; state: BlockState }> = [
  { icon: IdCard, label: 'CDL credentials', state: 'verified' },
  { icon: Gauge, label: 'MVR', state: 'verified' },
  { icon: Truck, label: 'Employment history', state: 'verified' },
  { icon: ClipboardList, label: 'DOT application', state: 'added' },
  { icon: FileText, label: 'Resume', state: 'added' },
  { icon: Wrench, label: 'Skills', state: 'added' },
  { icon: GraduationCap, label: 'Education', state: 'suggested' },
  { icon: Plus, label: 'Portfolio', state: 'suggested' },
] as const

function BlockChip({
  icon: Icon,
  label,
  state,
  isDark,
  delay,
}: {
  icon: typeof FileText
  label: string
  state: BlockState
  isDark: boolean
  delay: number
}) {
  const base = 'reveal-item flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors'

  const styles =
    state === 'verified'
      ? isDark
        ? 'border-[#f15a2b]/30 bg-[#f15a2b]/[0.08] text-[#ffb08a]'
        : 'border-[#f15a2b]/50 bg-[#fde8e0] text-[#7a2a12]'
      : state === 'added'
        ? isDark
          ? 'border-white/10 bg-white/[0.04] text-gray-200'
          : 'border-stone-200 bg-white text-stone-800 shadow-sm'
        : isDark
          ? 'border-dashed border-white/15 bg-transparent text-gray-500'
          : 'border-dashed border-stone-300 bg-transparent text-stone-400'

  return (
    <div className={cn(base, styles)} style={{ transitionDelay: `${delay}ms` }}>
      <Icon className='h-4 w-4 shrink-0' />
      <span className='min-w-0 flex-1 truncate'>{label}</span>
      {state === 'verified' && <ShieldCheck className={cn('h-3.5 w-3.5 shrink-0', isDark ? 'text-[#f78a5c]' : 'text-[#c43d14]')} />}
      {state === 'suggested' && <span className='shrink-0 text-[10px] font-semibold uppercase tracking-wide'>add</span>}
    </div>
  )
}

export default function CareerCardSection({ isDark }: { isDark: boolean }) {
  return (
    <section className={cn('py-20 sm:py-28', paperBand(isDark, true))}>
      <LandingContainer>
        <div className='grid items-center gap-12 lg:grid-cols-2 lg:gap-20'>
          <div data-reveal>
            <SectionHeader
              eyebrow='The Career Card'
              title={
                <>
                  Built from blocks.
                  <br />
                  Built once.
                </>
              }
              isDark={isDark}
              className='reveal-item'
            />
            <div className='reveal-item mt-6 space-y-4' style={{ transitionDelay: '120ms' }}>
              <p className={cn('text-base leading-relaxed sm:text-lg', mutedText(isDark))}>
                Your Career Card is a living identity, not a document. Start with one block
                &mdash; a resume, a CDL, a DOT application &mdash; and it&rsquo;s live from day
                one. Add verified facts over time and every employer you share with sees the
                current card, never a stale PDF.
              </p>
              <p className={cn('text-base leading-relaxed sm:text-lg', mutedText(isDark))}>
                A sparse card is still a valid card. Completeness is something you grow into
                &mdash; with an AI coach that knows your card and tells you which block moves
                the needle next &mdash; not a gate you have to clear.
              </p>
            </div>
          </div>

          {/* Block grid — the card assembling */}
          <div data-reveal>
            <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
              {BLOCKS.map((block, i) => (
                <BlockChip key={block.label} {...block} isDark={isDark} delay={i * 70} />
              ))}
            </div>
            <p className={cn('reveal-item mt-4 text-center text-xs', mutedText(isDark))} style={{ transitionDelay: '600ms' }}>
              Verified facts carry the badge. Self-reported blocks stay clearly labeled — no exceptions.
            </p>
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
