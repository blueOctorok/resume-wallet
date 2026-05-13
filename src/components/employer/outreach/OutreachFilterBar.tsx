'use client'

import { useEffect, useRef } from 'react'
import { Search, X, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDarkTheme } from '@/lib/theme-storage'
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
  theme,
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
  const isDark = isDarkTheme(theme)
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

  const inputCls = cn(
    'w-full rounded-lg border pl-9 pr-9 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-teal-500/40',
    isDark
      ? 'border-gray-700 bg-gray-900/60 text-white placeholder-gray-500'
      : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-900/40 dark:text-white',
  )

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        sticky && 'sticky top-0 z-20 -mx-4 mb-4 border-b px-4 pb-3 pt-3 backdrop-blur-md sm:-mx-5 sm:px-5',
        sticky &&
          (isDark
            ? 'border-gray-700/80 bg-gray-950/85'
            : 'border-amber-100 bg-amber-50/85 dark:border-gray-700/80 dark:bg-gray-950/80'),
      )}
    >
      {/* Search + sort row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
              isDark ? 'text-gray-500' : 'text-gray-400',
            )}
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
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors',
                isDark ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <ArrowUpDown
              className={cn(
                'pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
                isDark ? 'text-gray-500' : 'text-gray-400',
              )}
              aria-hidden
            />
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
              aria-label="Sort"
              className={cn(
                'appearance-none rounded-lg border pl-7 pr-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500/40',
                isDark
                  ? 'border-gray-700 bg-gray-900/60 text-gray-200'
                  : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200',
              )}
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
          theme={theme}
          chips={statusFilters}
          selected={selectedStatuses}
          onToggle={onToggleStatus}
        />
      )}
      {blockFilters.length > 0 && (
        <FilterRow
          label={blockFilterLabel}
          theme={theme}
          chips={blockFilters}
          selected={selectedBlocks}
          onToggle={onToggleBlock}
        />
      )}

      {/* Result count — confirms filters narrowed the list, prevents "where did everyone go?" */}
      <p className={cn('text-[11px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
        Showing <span className="font-semibold">{showingCount}</span> of{' '}
        <span className="font-semibold">{totalCount}</span>
      </p>
    </div>
  )
}

function FilterRow({
  label,
  theme,
  chips,
  selected,
  onToggle,
}: {
  label: string
  theme: string
  chips: FilterChipDef[]
  selected?: Set<string>
  onToggle?: (id: string) => void
}) {
  const isDark = isDarkTheme(theme)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          'mr-1 text-[10px] font-semibold uppercase tracking-wide',
          isDark ? 'text-gray-500' : 'text-gray-500',
        )}
      >
        {label}
      </span>
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
                ? isDark
                  ? 'border-teal-500/60 bg-teal-500/20 text-teal-200'
                  : 'border-teal-500 bg-teal-50 text-teal-800 dark:border-teal-500/60 dark:bg-teal-500/20 dark:text-teal-200'
                : isDark
                  ? 'border-gray-700 bg-gray-900/60 text-gray-300 hover:border-gray-600 hover:text-gray-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:text-gray-100',
            )}
          >
            {chip.dotClass && <span className={cn('h-1.5 w-1.5 rounded-full', chip.dotClass)} aria-hidden />}
            <span>{chip.label}</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px]',
                active
                  ? isDark
                    ? 'bg-teal-500/30 text-teal-100'
                    : 'bg-teal-200 text-teal-900 dark:bg-teal-500/30 dark:text-teal-100'
                  : isDark
                    ? 'bg-gray-800 text-gray-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
              )}
            >
              {chip.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
