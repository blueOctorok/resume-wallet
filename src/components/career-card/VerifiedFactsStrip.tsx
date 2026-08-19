'use client'

import { BadgeCheck, Ban, Building2, IdCard, ShieldCheck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProvvenMark from '@/components/ui/ProvvenMark'
import type {
  ProjectedCareerCard as CardData,
  CareerCardSection,
  MvrData,
  PspData,
} from '@/types/career-card'

/**
 * Verified facts — prestige seal on the career card.
 * Midnight-attested facts get the gold tiles; Accio/PSP fallbacks stay quieter.
 */

interface VerifiedFact {
  id: string
  label: string
  provenance: string
  provenOnMidnight: boolean
  icon: LucideIcon
}

const CLEAN_OUTCOMES = new Set(['clear', 'no_hits', 'pass'])

const FACT_ICONS: Record<string, LucideIcon> = {
  cdl_class: IdCard,
  cdl_class_a: IdCard,
  cdl_endorsements: BadgeCheck,
  cdl_restrictions: Ban,
  med_cert_valid: ShieldCheck,
  previous_employer_verified: Building2,
  mvr: ShieldCheck,
  psp: ShieldCheck,
  employment: Building2,
}

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

function isMvrAttestedType(factType: string): boolean {
  return (
    factType.startsWith('cdl_') ||
    factType === 'med_cert_valid' ||
    factType === 'mvr_clean_36_months'
  )
}

export function deriveVerifiedFacts(data: CardData): VerifiedFact[] {
  const facts: VerifiedFact[] = []
  const attested = data.attestedFacts ?? []

  for (const f of attested) {
    facts.push({
      id: f.id,
      label: f.label,
      provenance: f.provenance,
      provenOnMidnight: f.provenOnMidnight,
      icon: FACT_ICONS[f.factType] ?? BadgeCheck,
    })
  }

  const attestedTypes = new Set(attested.map((f) => f.factType))
  const hasMvrAttestation = attested.some((f) => isMvrAttestedType(f.factType))

  if (!hasMvrAttestation) {
    const mvrSection = data.sections.find(
      (s): s is CareerCardSection<'driver-mvr'> => s.blockType === 'driver-mvr',
    )
    const mvr: MvrData | undefined = mvrSection?.data
    if (mvr && screeningComplete(mvr.orderStatus)) {
      facts.push({
        id: 'mvr',
        label: CLEAN_OUTCOMES.has(mvr.resultOutcome ?? '') ? 'Clean MVR' : 'MVR on file',
        provenance: withDate('Accio', mvr.completedAt ?? mvr.orderedAt),
        provenOnMidnight: false,
        icon: ShieldCheck,
      })
    }
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
      provenOnMidnight: false,
      icon: ShieldCheck,
    })
  }

  if (!attestedTypes.has('previous_employer_verified')) {
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
        provenOnMidnight: false,
        icon: Building2,
      })
    }
  }

  return facts
}

export default function VerifiedFactsStrip({ data, isDark }: { data: CardData; isDark: boolean }) {
  const facts = deriveVerifiedFacts(data)
  if (facts.length === 0) return null

  const midnightFacts = facts.filter((f) => f.provenOnMidnight)
  const otherFacts = facts.filter((f) => !f.provenOnMidnight)
  const prestige = midnightFacts.length > 0

  return (
    <div
      className={cn(
        'relative mt-4 overflow-hidden rounded-2xl border',
        prestige
          ? isDark
            ? 'border-teal-400/35 bg-gradient-to-b from-teal-500/15 via-gray-900/40 to-gray-900/20 ring-1 ring-teal-400/20'
            : 'border-teal-300/70 bg-gradient-to-b from-teal-50 via-[#fffdf8] to-[#f6efe2] ring-1 ring-teal-700/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'
          : isDark
            ? 'border-teal-400/25 bg-teal-500/[0.07]'
            : 'border-teal-200/80 bg-teal-50/60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/50 to-transparent',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'facts-strip-sheen pointer-events-none absolute inset-y-0 w-1/3',
          'bg-gradient-to-r from-transparent to-transparent',
          isDark ? 'via-teal-300/25' : 'via-white/70',
        )}
      />

      <div className='relative px-4 py-3.5 sm:px-5'>
        <div className='flex items-start gap-3'>
          {prestige ? (
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                isDark
                  ? 'bg-teal-500/15 text-teal-200 ring-teal-400/30'
                  : 'bg-teal-50 text-teal-800 ring-teal-200',
              )}
            >
              <ProvvenMark tone='auto' isDark={isDark} className='text-xl' />
            </div>
          ) : (
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                isDark ? 'bg-teal-500/15 text-teal-200' : 'bg-teal-50 text-teal-800',
              )}
            >
              <BadgeCheck className='h-4 w-4' aria-hidden />
            </div>
          )}
          <div className='min-w-0'>
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.2em]',
                isDark ? 'text-teal-300/90' : 'text-teal-800/80',
              )}
            >
              {prestige ? 'Verified credentials' : 'Verified'}
            </p>
            <p className={cn('mt-0.5 text-xs leading-snug', isDark ? 'text-gray-300' : 'text-gray-600')}>
              {prestige
                ? 'Proven on Midnight · derived from Accio'
                : 'Third-party facts on file'}
            </p>
          </div>
        </div>

        {midnightFacts.length > 0 ? (
          <ul className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {midnightFacts.map((fact) => {
              const Icon = fact.icon
              return (
                <li
                  key={fact.id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5',
                    isDark
                      ? 'border-teal-400/20 bg-black/20'
                      : 'border-teal-200/80 bg-white/80',
                  )}
                >
                  <Icon
                    className={cn(
                      'mb-1.5 h-3.5 w-3.5',
                      isDark ? 'text-teal-300' : 'text-teal-700',
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'block text-sm font-semibold leading-tight',
                      isDark ? 'text-gray-100' : 'text-gray-900',
                    )}
                  >
                    {fact.label}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}

        {otherFacts.length > 0 ? (
          <ul
            className={cn(
              'flex flex-wrap gap-x-5 gap-y-2',
              midnightFacts.length > 0
                ? 'mt-3 border-t pt-3 border-teal-700/10 dark:border-teal-400/15'
                : 'mt-2',
            )}
          >
            {otherFacts.map((fact) => {
              const Icon = fact.icon
              return (
                <li key={fact.id} className='flex items-start gap-1.5'>
                  <Icon
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      isDark ? 'text-teal-300' : 'text-teal-700',
                    )}
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
                    <span
                      className='block text-[11px] text-ironside'
                    >
                      {fact.provenance}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
