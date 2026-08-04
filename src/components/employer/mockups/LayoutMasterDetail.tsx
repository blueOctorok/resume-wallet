'use client'

/**
 * LAYOUT B — "Master–Detail workspace"
 *
 * Hierarchy fix: only TWO regions ever compete — a quiet roster on the left and
 * a rich detail pane on the right. This is the strongest answer to "too much
 * visual competition": the list is deliberately plain (avatar + name + one
 * badge), and ALL richness (files, checklist, actions) lives in the detail pane
 * that only fills in when you pick someone.
 *
 * DQ monitor's "list → click name → detail" pattern becomes the whole layout.
 * A slim utility bar up top carries the attention count + block config so they
 * never take a full-width panel.
 */

import { useState } from 'react'
import { AlertTriangle, Package, Users } from 'lucide-react'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import {
  MOCK_ATTENTION,
  MOCK_BLOCKS,
  MOCK_DRIVERS,
  MOCK_OUTREACH,
  MOCK_STATS,
  type MockDriver,
} from './mock-data'
import {
  AttentionList,
  CandidateDetailCard,
  DriverRosterList,
  OutreachRowList,
  SegTabs,
  StatStrip,
} from './shared'

type RosterTab = 'dq' | 'outreach'

export default function LayoutMasterDetail({ isDark }: { isDark: boolean }) {
  const [rosterTab, setRosterTab] = useState<RosterTab>('dq')
  const [selected, setSelected] = useState<MockDriver | null>(MOCK_DRIVERS[0])

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* ── Slim utility bar: attention count + blocks (never a full panel) ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-2.5 dark:border-amber-500/25 dark:bg-amber-950/25">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {MOCK_ATTENTION.length} need attention
        </span>
        <span className="hidden text-amber-400 sm:inline">·</span>
        <span className="hidden items-center gap-1.5 text-xs text-slate-600 dark:text-gray-400 sm:inline-flex">
          <Package className="h-3.5 w-3.5 text-teal-500 dark:text-teal-400" />
          {MOCK_BLOCKS.length} blocks installed
        </span>
        <Button type="button" variant="ghost" size="sm" className="ml-auto !py-1 !text-xs">
          Review all
        </Button>
      </div>

      {/* ── Two-column master / detail ──────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* LEFT — quiet roster */}
        <HubSectionPanel isDark={isDark} accent="teal" contentClassName="p-3 sm:p-4">
          <BlockCard
            variant="embed"
            icon={Users}
            title="Roster"
            className="[&_h3]:text-sm"
          >
            <div className="space-y-3">
              <SegTabs<RosterTab>
                value={rosterTab}
                onChange={setRosterTab}
                tabs={[
                  { id: 'dq', label: 'DQ', count: MOCK_DRIVERS.length },
                  { id: 'outreach', label: 'Outreach', count: MOCK_OUTREACH.length },
                ]}
              />
              {rosterTab === 'dq' ? (
                <DriverRosterList
                  drivers={MOCK_DRIVERS}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelected}
                  compact
                />
              ) : (
                <OutreachRowList items={MOCK_OUTREACH} />
              )}
            </div>
          </BlockCard>
        </HubSectionPanel>

        {/* RIGHT — detail pane (where all the density is allowed to live) */}
        <HubSectionPanel isDark={isDark} accent="teal">
          <BlockCard
            variant="embed"
            icon={Users}
            title={selected ? 'Candidate detail' : 'Overview'}
            description={
              selected
                ? 'DQ checklist, files, and actions for the selected candidate.'
                : 'Pick someone on the left to see their DQ file checklist and actions.'
            }
          >
            {selected ? (
              <CandidateDetailCard driver={selected} onClose={() => setSelected(null)} />
            ) : (
              <div className="space-y-4">
                <StatStrip stats={MOCK_STATS} />
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                    Needs attention
                  </p>
                  <AttentionList items={MOCK_ATTENTION} />
                </div>
              </div>
            )}
          </BlockCard>
        </HubSectionPanel>
      </div>
    </div>
  )
}
