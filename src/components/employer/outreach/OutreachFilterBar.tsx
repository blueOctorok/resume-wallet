'use client'

import { useEffect, useRef } from 'react'
import { Search, X, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'

export type SortKey = 'newest' | 'oldest' | 'name'

export interface FilterChipDef {
  id: string
  label: string
  /** Optional dot color shown next to the label (e.g. status pill colors). */
  dotClass?: string
  count: number
}

interface OutreachFilterBarProps {
  theme: string
  search: string
  onSearchChange: (next: string) => void
  /** "/" key focuses the search input — only enable when this bar is the primary one on screen. */
  enableKeyboardShortcut?: boolean

  /** First filter row (multi-select). Pass [] to hide. */
  statusFilters?: FilterChipDef[]
  selectedStatuses?: Set<string>
  onToggleStatus?: (id: string) => void
  /** Override the row label (defaults to "Status"). Lets the Vault tab show "Type" instead. */
  statusFilterLabel?: string

  /** Second filter row (multi-select). Pass [] to hide. */
  blockFilters?: FilterChipDef[]
  selectedBlocks?: Set<string>
  onToggleBlock?: (id: string) => void
  /** Override the row label (defaults to "Block"). Lets the Vault tab show "Outcome" instead. */
  blockFilterLabel?: string

  sort: SortKey
  onSortChange: (next: SortKey) => void

  /** "Showing X of Y" — keeps users honest about over-tight filters. */
  showingCount: number
  totalCount: number
  /** When any filter/search is active, surface a one-click reset. */
  onClearAll?: () => void
  hasActiveFilters: boolean

  /** Optional sticky positioning — sticks within the parent container while user scrolls. */
  sticky?: boolean
}

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'name', label: 'Name A–Z' },
]

/**
 * Search + filter chips + sort, used by both the Active outreach and Files vault tabs.
 *
 * The chips are multi-select with counts so a recruiter can immediately see
 * "8 pending, 12 viewed, 20 completed" and tap to narrow. The "/" shortcut
 * focuses the search box (think Linear / GitHub) so power users move fast.
 */
export default function OutreachFilterBar({
  search,
  onSearchChange,
  enableKeyboardShortcut = true,
  statusFilters = [],
  selectedStatuses,
  onToggleStatus,
  statusFilterLabel = 'Status',
  blockFilters = [],
  selectedBlocks,
  onToggleBlock,
  blockFilterLabel = 'Block',
  sort,
  onSortChange,
  showingCount,
  totalCount,
  onClearAll,
  hasActiveFilters,
  sticky = false,
}: OutreachFilterBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)

  // "/" focuses the search input — but only when no other input is focused.
  // This mirrors how Linear, Slack, GitHub do it; lets recruiters type-to-search
  // from anywhere on the page without reaching for the mouse.
  useEffect(() => {
    if (!enableKeyboardShortcut) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [enableKeyboardShortcut])

  const inputCls =
    'w-full rounded-lg border border-stone-200 bg-white pl-9 pr-9 py-2 text-sm text-[#173150] placeholder-ironside outline-none transition-colors focus:ring-2 focus:ring-teal-500/40'

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5',
        sticky && 'sticky top-0 z-20 -mx-4 mb-3 border-b border-stone-200 bg-white/95 px-4 pb-3 pt-2 backdrop-blur-sm sm:-mx-5 sm:px-5',
      )}
    >
      {/* Search + sort row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ironside"
            aria-hidden
          />
          <input
            ref={searchInputRef}
            type="search"
            placeholder={enableKeyboardShortcut ? 'Search name or email  (press /)' : 'Search name or email'}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={inputCls}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ironside transition-colors hover:bg-stone-100 hover:text-[#173150]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <ArrowUpDown
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ironside"
              aria-hidden
            />
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
              aria-label="Sort"
              className="appearance-none rounded-lg border border-stone-200 bg-white py-2 pl-7 pr-3 text-xs font-medium text-[#173150] outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && onClearAll && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearAll} className="text-xs">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Filter chip rows — labels are overridable so the Vault tab can call them
          "Type" / "Outcome" instead of "Status" / "Block". */}
      {statusFilters.length > 0 && (
        <FilterRow
          label={statusFilterLabel}
          hideLabel={statusFilterLabel === 'Status'}
          chips={statusFilters}
          selected={selectedStatuses}
          onToggle={onToggleStatus}
        />
      )}
      {blockFilters.length > 0 && (
        <FilterRow
          label={blockFilterLabel}
          chips={blockFilters}
          selected={selectedBlocks}
          onToggle={onToggleBlock}
        />
      )}

      {hasActiveFilters && (
        <p className="text-[11px] text-ironside">
          Showing <span className="font-semibold text-[#173150]">{showingCount}</span> of{' '}
          <span className="font-semibold text-[#173150]">{totalCount}</span>
        </p>
      )}
    </div>
  )
}

function FilterRow({
  label,
  hideLabel = false,
  chips,
  selected,
  onToggle,
}: {
  label: string
  hideLabel?: boolean
  chips: FilterChipDef[]
  selected?: Set<string>
  onToggle?: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!hideLabel && (
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-ironside">
          {label}
        </span>
      )}
      {chips.map((chip) => {
        const active = selected?.has(chip.id) ?? false
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onToggle?.(chip.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              active
                ? 'border-[#173150] bg-[#173150] text-white'
                : 'border-stone-200 bg-white text-[#173150] hover:border-ironside',
            )}
          >
            {chip.dotClass && <span className={cn('h-1.5 w-1.5 rounded-full', chip.dotClass)} aria-hidden />}
            <span>{chip.label}</span>
            <span className={cn('tabular-nums text-[10px]', active ? 'text-white/80' : 'text-ironside')}>
              {chip.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
