'use client'

import { useState } from 'react'
import { ChevronDown, Check, Plus, Loader2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Button from '@/components/ui/Button'
import type { BlockDefinition, BlockCategory } from '@/lib/block-registry'

const complexityLabel: Record<string, { text: string; color: string }> = {
  simple: { text: 'Quick setup', color: 'text-green-500 dark:text-green-400' },
  moderate: { text: 'A few steps', color: 'text-amber-500 dark:text-amber-400' },
  complex: { text: 'Multi-step flow', color: 'text-orange-500 dark:text-orange-400' },
}

function resolveIcon(name: string) {
  const Icon = (LucideIcons as Record<string, LucideIcons.LucideIcon>)[name]
  return Icon ?? LucideIcons.Box
}

interface BlockPickerCategoryProps {
  category: BlockCategory
  blocks: BlockDefinition[]
  installedTypes: Set<string>
  /** Category IDs suggested by Stormi from onboarding — these start expanded */
  suggestedCategoryIds: string[]
  addingBlockType: string | null
  onAddBlock: (blockType: string) => void
}

/**
 * An accordion section in the block picker. Shows the category header
 * and expands to reveal its blocks. Suggested categories default open.
 */
export default function BlockPickerCategory({
  category,
  blocks,
  installedTypes,
  suggestedCategoryIds,
  addingBlockType,
  onAddBlock,
}: BlockPickerCategoryProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const isSuggested = suggestedCategoryIds.includes(category.id)
  const [isOpen, setIsOpen] = useState(isSuggested)

  const CategoryIcon = resolveIcon(category.icon)
  const installedCount = blocks.filter((b) => installedTypes.has(b.id)).length
  const allInstalled = installedCount === blocks.length

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      isDark ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-white',
      isSuggested && !allInstalled && 'ring-1 ring-teal-500/30'
    )}>
      {/* Accordion header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors',
          isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
        )}
      >
        <div className='flex items-center gap-3 min-w-0'>
          <CategoryIcon className={cn('w-5 h-5 flex-shrink-0', isDark ? 'text-gray-400' : 'text-gray-500')} />
          <div className='min-w-0'>
            <span className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              {category.label}
            </span>
            {isSuggested && !allInstalled && (
              <span className='ml-2 text-xs font-medium text-teal-500'>Suggested</span>
            )}
            <p className={cn('text-xs truncate', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {category.description}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2 flex-shrink-0'>
          {installedCount > 0 && (
            <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {installedCount}/{blocks.length} added
            </span>
          )}
          <ChevronDown className={cn(
            'w-4 h-4 transition-transform',
            isDark ? 'text-gray-500' : 'text-gray-400',
            isOpen && 'rotate-180'
          )} />
        </div>
      </button>

      {/* Block list */}
      {isOpen && (
        <div className={cn('border-t px-4 py-2 space-y-2', isDark ? 'border-gray-700' : 'border-gray-200')}>
          {blocks.map((block) => {
            const isInstalled = installedTypes.has(block.id)
            const isAdding = addingBlockType === block.id
            const BlockIcon = resolveIcon(block.icon)
            const hint = complexityLabel[block.complexity]

            return (
              <div
                key={block.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg p-3 transition-colors',
                  isInstalled
                    ? isDark ? 'bg-gray-700/30 opacity-60' : 'bg-gray-50 opacity-60'
                    : isDark ? 'bg-gray-700/20 hover:bg-gray-700/40' : 'bg-gray-50/50 hover:bg-gray-100'
                )}
              >
                <div className='flex items-center gap-3 min-w-0'>
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                    isDark ? 'bg-gray-700' : 'bg-gray-200/70'
                  )}>
                    <BlockIcon className={cn('w-4 h-4', isDark ? 'text-gray-300' : 'text-gray-600')} />
                  </div>
                  <div className='min-w-0'>
                    <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {block.label}
                    </p>
                    <p className={cn('text-xs truncate', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {block.description}
                    </p>
                    <p className={cn('text-[11px] mt-0.5', hint.color)}>
                      {hint.text}
                    </p>
                  </div>
                </div>

                {isInstalled ? (
                  <span className='flex items-center gap-1 text-xs font-medium text-emerald-500 flex-shrink-0'>
                    <Check className='w-3.5 h-3.5' /> Added
                  </span>
                ) : (
                  <Button
                    variant='secondary'
                    size='sm'
                    disabled={isAdding}
                    onClick={() => onAddBlock(block.id)}
                    className='flex-shrink-0'
                  >
                    {isAdding ? (
                      <Loader2 className='w-3.5 h-3.5 animate-spin' />
                    ) : (
                      <>
                        <Plus className='w-3.5 h-3.5' />
                        Add
                      </>
                    )}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
