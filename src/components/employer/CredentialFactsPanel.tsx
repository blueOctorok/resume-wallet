'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ShieldCheck, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDarkTheme } from '@/lib/theme-storage'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import {
  FACT_TYPE_UI,
  formatFactDisclosedFields,
  formatVerifiedByStormLine,
} from '@/lib/attestation-fact-ui'
import type { EmployerCredentialFact } from '@/lib/employer-credential-facts'

interface CredentialFactsPanelProps {
  facts: EmployerCredentialFact[]
  theme: string
}

function FactRow({
  fact,
  isDark,
}: {
  fact: EmployerCredentialFact
  isDark: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const ui = FACT_TYPE_UI[fact.factType]
  const Icon = ui?.icon ?? ShieldCheck
  const detailLines = formatFactDisclosedFields(fact.disclosedFields)

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        isDark ? 'border-teal-500/25 bg-teal-500/5' : 'border-teal-200 bg-teal-50/60',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
            isDark
              ? 'bg-teal-500/15 text-teal-200 ring-teal-400/30'
              : 'bg-teal-100 text-teal-700 ring-teal-200',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              {ui?.label ?? fact.factSummary}
            </p>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800',
              )}
            >
              Verified by Storm
            </span>
          </div>
          <p className={cn('mt-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
            {fact.factSummary}
          </p>
          <p className={cn('mt-1 text-[11px]', isDark ? 'text-teal-300/80' : 'text-teal-800/80')}>
            {formatVerifiedByStormLine(fact.issuedAt, fact.sourceCra, fact.sourcePullId)}
          </p>
          {detailLines.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                isDark ? 'text-teal-300 hover:text-teal-200' : 'text-teal-700 hover:text-teal-900',
              )}
            >
              {expanded ? (
                <>
                  Hide details <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Technical details <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
          {expanded && detailLines.length > 0 && (
            <ul
              className={cn(
                'mt-2 space-y-1 rounded-lg border px-3 py-2 text-xs',
                isDark ? 'border-gray-700/60 bg-gray-900/40 text-gray-300' : 'border-gray-200 bg-white text-gray-700',
              )}
            >
              {detailLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Carrier-facing verified facts — facts before PDFs (Phase 2 moat surface).
 * Renders server-verified attestations only; never reads block_* tables.
 */
export default function CredentialFactsPanel({ facts, theme }: CredentialFactsPanelProps) {
  const isDark = isDarkTheme(theme)

  return (
    <HubSectionPanel isDark={isDark} accent="teal" contentClassName="p-0">
      <BlockCard
        variant="embed"
        icon={ShieldCheck}
        title="Verified credentials"
        description="Third-party facts verified by Storm — selective disclosure, not full reports."
        status={facts.length > 0 ? 'complete' : 'empty'}
      >
        {facts.length === 0 ? (
          <div className="py-6 text-center">
            <Package className={cn('mx-auto mb-2 h-8 w-8', isDark ? 'text-gray-500' : 'text-gray-400')} />
            <p className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
              No verified facts yet
            </p>
            <p className={cn('mt-1 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
              Request a screening or wait for the candidate to share verified credentials. Full MVR/PSP
              reports remain available below when your company has ordered them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {facts.map((fact) => (
              <FactRow key={fact.id} fact={fact} isDark={isDark} />
            ))}
          </div>
        )}
      </BlockCard>
    </HubSectionPanel>
  )
}
