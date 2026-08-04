'use client'

/**
 * LAYOUT C — "Priority Stack" (smallest diff from today's hub)
 *
 * Keeps the current top-to-bottom stack of HubSectionPanels but fixes the
 * "everything shouts equally" problem with THREE levers, no structural rewrite:
 *
 *   • Accent = role. amber = act now, teal = active work, indigo = reference.
 *   • Size   = priority. Hero attention + primary outreach are open and roomy;
 *              reference sections are compact.
 *   • State  = default collapsed for reference sections (Activity, Jobs, Blocks)
 *              so they recede until asked for.
 *
 * This is the layout you can port by mostly re-ordering + re-accenting the
 * existing EmployerHub.tsx sections and swapping the heavy outreach cards for
 * OutreachRowLite.
 */

import { useState } from 'react'
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  ClipboardList,
  Send,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
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
  StatStrip,
} from './shared'

/** Collapse toggle rendered in a BlockCard header. */
function CollapseButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} aria-expanded={open}>
      <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
    </Button>
  )
}

export default function LayoutPriorityStack({ isDark }: { isDark: boolean }) {
  const [selected, setSelected] = useState<MockDriver | null>(null)
  // Reference sections start collapsed so they visually recede.
  const [open, setOpen] = useState({ activity: false, jobs: false, blocks: false })
  const toggle = (k: keyof typeof open) => setOpen((s) => ({ ...s, [k]: !s[k] }))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* HERO ── Action needed (amber, open) ───────────────────────────────── */}
      <HubSectionPanel isDark={isDark} accent="amber">
        <BlockCard
          variant="embed"
          icon={AlertTriangle}
          title="Action needed"
          description={`${MOCK_ATTENTION.length} candidates are waiting on you`}
        >
          <AttentionList items={MOCK_ATTENTION} />
        </BlockCard>
      </HubSectionPanel>

      {/* PRIMARY ── Active outreach, now LIGHT rows (teal, open) ────────────── */}
      <HubSectionPanel isDark={isDark} accent="teal">
        <BlockCard
          variant="embed"
          icon={Send}
          title="Active outreach"
          description="Lightweight rows — expand one only when you need the files and actions."
        >
          <OutreachRowList items={MOCK_OUTREACH} />
        </BlockCard>
      </HubSectionPanel>

      {/* PRIMARY ── DQ monitor (teal, open, list → detail) ─────────────────── */}
      <HubSectionPanel isDark={isDark} accent="teal">
        <BlockCard
          variant="embed"
          icon={ClipboardList}
          title="Drivers — DQ monitor"
          description="Click a name for their DQ file checklist."
        >
          {selected ? (
            <div className="rounded-xl border border-slate-200/80 p-4 dark:border-gray-700/60">
              <CandidateDetailCard driver={selected} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <DriverRosterList drivers={MOCK_DRIVERS} onSelect={setSelected} />
          )}
        </BlockCard>
      </HubSectionPanel>

      {/* REFERENCE ── collapsed by default, muted indigo, compact ──────────── */}
      <HubSectionPanel isDark={isDark} accent="indigo">
        <BlockCard
          variant="embed"
          icon={Users}
          title="Activity snapshot"
          headerActions={<CollapseButton open={open.activity} onClick={() => toggle('activity')} />}
        >
          {open.activity && <StatStrip stats={MOCK_STATS} />}
        </BlockCard>
      </HubSectionPanel>

      <HubSectionPanel isDark={isDark} accent="indigo">
        <BlockCard
          variant="embed"
          icon={Briefcase}
          title="Job postings"
          headerActions={<CollapseButton open={open.jobs} onClick={() => toggle('jobs')} />}
        >
          {open.jobs && <JobsMini jobs={MOCK_JOBS} />}
        </BlockCard>
      </HubSectionPanel>

      <HubSectionPanel isDark={isDark} accent="indigo">
        <BlockCard
          variant="embed"
          icon={ClipboardList}
          title="Installed blocks"
          headerActions={<CollapseButton open={open.blocks} onClick={() => toggle('blocks')} />}
        >
          {open.blocks && <BlocksStrip blocks={MOCK_BLOCKS} />}
        </BlockCard>
      </HubSectionPanel>
    </div>
  )
}
