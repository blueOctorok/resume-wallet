'use client'

/**
 * LAYOUT A — "Focus Rail"
 *
 * Hierarchy fix: collapse the wall of equal-weight panels into
 *   1. ONE loud amber "Do this first" attention strip (the signature element)
 *   2. ONE primary teal "Candidates" workspace with segmented tabs
 *      (Active outreach · DQ monitor · Pipeline) — so Outreach, DQ, and
 *      Pipeline stop competing and share a single frame
 *   3. A quiet, muted footer grid for reference/config (Blocks · Activity · Jobs)
 *
 * Everything is built from the real BlockCard + HubSectionPanel primitives.
 */

import { useState } from 'react'
import { AlertTriangle, ClipboardList, Users } from 'lucide-react'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import {
  MOCK_ATTENTION,
  MOCK_BLOCKS,
  MOCK_DRIVERS,
  MOCK_JOBS,
  MOCK_OUTREACH,
  MOCK_STATS,
  type MockDriver,
} from './mock-data'
import {
  AttentionList,
  BlocksStrip,
  CandidateDetailCard,
  DriverRosterList,
  JobsMini,
  OutreachRowList,
  SegTabs,
  StatStrip,
} from './shared'

type WorkspaceTab = 'outreach' | 'dq' | 'pipeline'

export default function LayoutFocusRail({ isDark }: { isDark: boolean }) {
  const [tab, setTab] = useState<WorkspaceTab>('outreach')
  const [selected, setSelected] = useState<MockDriver | null>(null)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 1 ── ATTENTION: single loud signature element (amber) ─────────────── */}
      <HubSectionPanel isDark={isDark} accent="amber">
        <BlockCard
          variant="embed"
          icon={AlertTriangle}
          title="Do this first"
          description={`${MOCK_ATTENTION.length} candidates need a decision from you`}
        >
          <AttentionList items={MOCK_ATTENTION} />
        </BlockCard>
      </HubSectionPanel>

      {/* 2 ── PRIMARY WORKSPACE: one panel, three tabs (teal) ──────────────── */}
      <HubSectionPanel isDark={isDark} accent="teal">
        <BlockCard
          variant="embed"
          icon={Users}
          title="Candidates"
          description="Everything you're working — one place, switch the view."
          headerActions={
            <SegTabs<WorkspaceTab>
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'outreach', label: 'Outreach', count: MOCK_OUTREACH.length },
                { id: 'dq', label: 'DQ monitor', count: MOCK_DRIVERS.length },
                { id: 'pipeline', label: 'Pipeline', count: MOCK_STATS[0].value },
              ]}
            />
          }
        >
          {tab === 'outreach' && <OutreachRowList items={MOCK_OUTREACH} />}

          {tab === 'dq' &&
            (selected ? (
              <div className="rounded-xl border border-slate-200/80 p-4 dark:border-gray-700/60">
                <CandidateDetailCard driver={selected} onClose={() => setSelected(null)} />
              </div>
            ) : (
              <DriverRosterList
                drivers={MOCK_DRIVERS}
                selectedId={selected ? (selected as MockDriver).id : null}
                onSelect={setSelected}
              />
            ))}

          {tab === 'pipeline' && (
            <div className="space-y-3">
              <StatStrip stats={MOCK_STATS} />
              <p className="text-xs text-slate-500 dark:text-gray-400">
                The full drag-and-drop kanban lives here — kept behind its own tab so it never
                competes with outreach for vertical space.
              </p>
            </div>
          )}
        </BlockCard>
      </HubSectionPanel>

      {/* 3 ── QUIET FOOTER: reference / config recedes (indigo, small) ─────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <HubSectionPanel isDark={isDark} accent="indigo">
          <BlockCard variant="embed" icon={ClipboardList} title="Installed blocks">
            <BlocksStrip blocks={MOCK_BLOCKS} />
          </BlockCard>
        </HubSectionPanel>
        <HubSectionPanel isDark={isDark} accent="indigo">
          <BlockCard variant="embed" icon={Users} title="Jobs">
            <JobsMini jobs={MOCK_JOBS} />
          </BlockCard>
        </HubSectionPanel>
        <HubSectionPanel isDark={isDark} accent="indigo">
          <BlockCard variant="embed" icon={Users} title="Activity">
            <div className="grid grid-cols-2 gap-2 text-center">
              {MOCK_STATS.map((s) => (
                <div key={s.label} className="rounded-lg bg-slate-50 py-2 dark:bg-gray-900/50">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{s.value}</p>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </BlockCard>
        </HubSectionPanel>
      </div>
    </div>
  )
}
