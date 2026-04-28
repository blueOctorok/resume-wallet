'use client'

import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { VaultCredentialChrome } from '@/components/hub/HubBlockVault'
import type { BlockCategory, BlockDefinition } from '@/lib/block-registry'
import { getBlockColor, getBlocksByCategory } from '@/lib/block-registry'

function resolveIcon(name: string) {
  const Icon = (LucideIcons as Record<string, LucideIcons.LucideIcon>)[name]
  return Icon ?? LucideIcons.Box
}

function categoryGlow(categoryId: string): string {
  const blocks = getBlocksByCategory(categoryId)
  const first = blocks[0]
  return first ? getBlockColor(first.id).glowColor : 'rgba(20,184,166,0.18)'
}

export interface BlockPickerCategoryCardProps {
  category: BlockCategory
  blocks: BlockDefinition[]
  installedTypes: Set<string>
  suggestedCategoryIds: string[]
  rowIndex: number
  onPick: () => void
}

export default function BlockPickerCategoryCard({
  category,
  blocks,
  installedTypes,
  suggestedCategoryIds,
  rowIndex,
  onPick,
}: BlockPickerCategoryCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const CategoryIcon = resolveIcon(category.icon)
  const glow = categoryGlow(category.id)
  const installedCount = blocks.filter((b) => installedTypes.has(b.id)).length
  const allInstalled = blocks.length > 0 && installedCount === blocks.length
  const isSuggested = suggestedCategoryIds.includes(category.id)

  return (
    <button
      type='button'
      onClick={onPick}
      data-block-picker-animate
      style={{
        animation: `block-picker-stagger 0.48s ease-out ${rowIndex * 90}ms both`,
      }}
      className={cn(
        'group/cat w-full text-left rounded-xl border overflow-hidden transition-shadow duration-300',
        'hover:shadow-lg hover:shadow-teal-900/10 dark:hover:shadow-black/40',
        isDark ? 'border-gray-700 bg-gray-900/50' : 'border-slate-200 bg-white',
        isSuggested && !allInstalled && 'ring-2 ring-teal-500/35 dark:ring-teal-400/25',
      )}
    >
      <div className='flex gap-3 sm:gap-4 items-stretch min-h-[7.25rem]'>
        <div
          className={cn(
            'w-[6.25rem] sm:w-[7rem] shrink-0 transition-transform duration-300',
            'group-hover/cat:-translate-y-1',
          )}
        >
          <div className='h-full min-h-[7.25rem] pt-1 pb-1 pl-1'>
            <VaultCredentialChrome isDark={isDark} glowColor={glow} hasRoute className='h-full min-h-[6.75rem]'>
              <div className='relative flex h-full min-h-[6.5rem] flex-col items-center justify-center px-2 pb-3 pt-4 text-center'>
                <CategoryIcon
                  className={cn(
                    'h-8 w-8 shrink-0 drop-shadow-sm sm:h-9 sm:w-9',
                    isDark ? 'text-teal-200' : 'text-teal-700',
                  )}
                />
                <span
                  className={cn(
                    'mt-1.5 text-[10px] font-bold uppercase tracking-wide sm:text-xs',
                    isDark ? 'text-gray-100' : 'text-slate-800',
                  )}
                >
                  {category.label}
                </span>
              </div>
            </VaultCredentialChrome>
          </div>
        </div>

        <div className='flex min-w-0 flex-1 flex-col justify-center gap-1 py-3 pr-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className={cn('text-sm font-semibold sm:text-base', isDark ? 'text-white' : 'text-gray-900')}>
              {category.label}
            </span>
            {isSuggested && !allInstalled && (
              <span className='rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:bg-teal-400/15 dark:text-teal-300'>
                Suggested
              </span>
            )}
          </div>
          <p className={cn('text-xs leading-relaxed sm:text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
            {category.description}
          </p>
          <p className={cn('text-[11px] font-medium', isDark ? 'text-gray-500' : 'text-slate-500')}>
            {installedCount}/{blocks.length} blocks added
          </p>
        </div>
      </div>
    </button>
  )
}
