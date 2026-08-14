'use client'

import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  ProjectedCareerCard as CardData,
  CareerCardSection,
  MvrData,
  PspData,
} from '@/types/career-card'

/**
 * Verified facts strip — the first thing an employer reads on the card.
 *
 * Provenance gate (DEC-2026-05-014): only third-party / issuer-derived facts
 * appear here — MVR + PSP (pulled by Accio) and employer-confirmed employment.
 * Self-reported data (CDL, resume, skills) NEVER earns a seal, so this strip
 * renders nothing rather than padding itself with unverified claims.
 */

interface VerifiedFact {
  id: string
  label: string
  /** Issuer + date — Storm attestations always cite the originating CRA */
  provenance: string
}

const CLEAN_OUTCOMES = new Set(['clear', 'no_hits', 'pass'])

function screeningComplete(status: string | undefined): boolean {
  return status === 'completed' || status === 'needs_review'
}

function factDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function withDate(issuer: string, iso: string | null | undefined): string {
  const date = factDate(iso)
  return date ? `${issuer} · ${date}` : issuer
}

export function deriveVerifiedFacts(data: CardData): VerifiedFact[] {
  if (data.attestedFacts && data.attestedFacts.length > 0) {
    return data.attestedFacts.map((f) => ({
      id: f.id,
      label: f.label,
      provenance: f.provenance,
    }))
  }

  const facts: VerifiedFact[] = []

  const mvrSection = data.sections.find(
    (s): s is CareerCardSection<'driver-mvr'> => s.blockType === 'driver-mvr',
  )
  const mvr: MvrData | undefined = mvrSection?.data
  if (mvr && screeningComplete(mvr.orderStatus)) {
    facts.push({
      id: 'mvr',
      label: CLEAN_OUTCOMES.has(mvr.resultOutcome ?? '') ? 'Clean MVR' : 'MVR on file',
      provenance: withDate('Accio', mvr.completedAt ?? mvr.orderedAt),
    })
  }

  const pspSection = data.sections.find(
    (s): s is CareerCardSection<'driver-psp'> => s.blockType === 'driver-psp',
  )
  const psp: PspData | undefined = pspSection?.data
  if (psp && screeningComplete(psp.orderStatus)) {
    facts.push({
      id: 'psp',
      label: CLEAN_OUTCOMES.has(psp.resultOutcome ?? '') ? 'Clean PSP record' : 'PSP on file',
      provenance: withDate('FMCSA via Accio', psp.completedAt ?? psp.orderedAt),
    })
  }

  const employerCount = data.employerConfirmedEmploymentCount ?? 0
  if (employerCount > 0) {
    const latest = data.employerConfirmations
      .map((c) => c.verifiedAt)
      .sort()
      .at(-1)
    facts.push({
      id: 'employment',
      label: `${employerCount} employer${employerCount === 1 ? '' : 's'} confirmed employment`,
      provenance: withDate('On file', latest),
    })
  }

  return facts
}

export default function VerifiedFactsStrip({ data, isDark }: { data: CardData; isDark: boolean }) {
  const facts = deriveVerifiedFacts(data)
  if (facts.length === 0) return null

  return (
    <div
      className={cn(
        'relative mt-4 overflow-hidden rounded-xl border px-4 py-3',
        isDark
          ? 'border-teal-400/25 bg-teal-500/[0.07]'
          : 'border-teal-200/80 bg-teal-50/60',
      )}
    >
      {/* One-shot gold sheen on first render — base opacity 0 so reduced-motion
          users (animation: none) never see the overlay at all */}
      <span
        aria-hidden
        className={cn(
          'facts-strip-sheen pointer-events-none absolute inset-y-0 w-1/3',
          'bg-gradient-to-r from-transparent to-transparent',
          isDark ? 'via-teal-300/20' : 'via-white/60',
        )}
      />
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-[0.2em]',
          isDark ? 'text-teal-300/85' : 'text-teal-800/75',
        )}
      >
        Verified
      </p>
      <ul className='mt-2 flex flex-wrap gap-x-6 gap-y-2'>
        {facts.map((fact) => (
          <li key={fact.id} className='flex items-start gap-1.5'>
            <BadgeCheck
              className={cn('mt-0.5 h-4 w-4 shrink-0', isDark ? 'text-teal-300' : 'text-teal-700')}
              aria-hidden
            />
            <span className='min-w-0'>
              <span
                className={cn(
                  'block text-sm font-semibold leading-tight',
                  isDark ? 'text-gray-100' : 'text-gray-900',
                )}
              >
                {fact.label}
              </span>
              <span className={cn('block text-[11px]', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {fact.provenance}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
