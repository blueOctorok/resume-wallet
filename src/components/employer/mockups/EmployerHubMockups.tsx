'use client'

/**
 * Employer Hub — layout mockup gallery.
 *
 * A design-review harness (NOT wired to live data). Switch between three
 * alternate arrangements of the same restyled pieces, all built on the real
 * BlockCard + HubSectionPanel primitives so a chosen layout ports straight
 * onto EmployerHub.tsx.
 */

import { useState } from 'react'
import { LayoutGrid, Columns2, ListTree } from 'lucide-react'
import { useTheme, isDarkTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import LayoutFocusRail from './LayoutFocusRail'
import LayoutMasterDetail from './LayoutMasterDetail'
import LayoutPriorityStack from './LayoutPriorityStack'

type LayoutId = 'focus' | 'master' | 'priority'

const LAYOUTS: {
  id: LayoutId
  label: string
  icon: typeof LayoutGrid
  blurb: string
}[] = [
  {
    id: 'focus',
    label: 'A · Focus Rail',
    icon: LayoutGrid,
    blurb:
      'One loud "do this first" strip, one tabbed Candidates workspace (Outreach / DQ / Pipeline), quiet reference footer.',
  },
  {
    id: 'master',
    label: 'B · Master–Detail',
    icon: Columns2,
    blurb:
      'Quiet roster on the left, rich detail pane on the right. Only two regions ever compete; density lives in the detail.',
  },
  {
    id: 'priority',
    label: 'C · Priority Stack',
    icon: ListTree,
    blurb:
      'Smallest diff from today: same vertical stack, but accent = role, size = priority, reference sections collapsed.',
  },
]

export default function EmployerHubMockups() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [layout, setLayout] = useState<LayoutId>('focus')
  const active = LAYOUTS.find((l) => l.id === layout)!

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-gray-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">
            Employer Hub · layout studies
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Three ways to quiet the noise
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-gray-400">
            Same BlockCard / HubSectionPanel chrome, same teal + amber language. Only the
            arrangement changes: clearer &ldquo;what&nbsp;first&rdquo;, less competition between
            Blocks / Outreach / DQ / Activity, lighter outreach rows, and DQ kept as list &rarr;
            detail.
          </p>
        </header>

        {/* Layout switcher */}
        <div className="mb-4 flex flex-wrap gap-2">
          {LAYOUTS.map((l) => {
            const isActive = l.id === layout
            const Icon = l.icon
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLayout(l.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors',
                  isActive
                    ? 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600',
                )}
              >
                <Icon className="h-4 w-4" />
                {l.label}
              </button>
            )
          })}
        </div>

        <p className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs leading-relaxed text-slate-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          <span className="font-semibold text-slate-800 dark:text-gray-200">{active.label}:</span>{' '}
          {active.blurb}
        </p>

        {layout === 'focus' && <LayoutFocusRail isDark={isDark} />}
        {layout === 'master' && <LayoutMasterDetail isDark={isDark} />}
        {layout === 'priority' && <LayoutPriorityStack isDark={isDark} />}
      </div>
    </div>
  )
}
