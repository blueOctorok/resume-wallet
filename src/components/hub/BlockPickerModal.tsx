'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useHubBlocksStore,
  useIsPickerOpen,
  useInstalledBlocks,
  useHubOnboarding,
} from '@/stores/hub-blocks-store'
import { BLOCK_CATEGORIES, BLOCK_DEFINITIONS, getBlocksByCategory } from '@/lib/block-registry'
import { useAuthStore } from '@/stores'
import BlockPickerCategory from './BlockPickerCategory'

/**
 * BlockPickerModal — the catalog where candidates browse and add blocks.
 *
 * Opens when `isPickerOpen` is true in the hub-blocks-store.
 * Categories render as accordions. Suggested categories (from AvA's
 * onboarding analysis) start expanded so users see relevant blocks first.
 */
export default function BlockPickerModal() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const isOpen = useIsPickerOpen()
  const installedBlocks = useInstalledBlocks()
  const onboarding = useHubOnboarding()
  const closePicker = useHubBlocksStore((s) => s.closePicker)
  const addBlock = useHubBlocksStore((s) => s.addBlock)
  const walletAddress = useAuthStore((s) => s.walletAddress)

  const [addingBlockType, setAddingBlockType] = useState<string | null>(null)

  const installedTypes = new Set(installedBlocks.map((b) => b.blockType))
  const suggestedCategoryIds = onboarding?.suggestedCategories ?? []
  // Derived without a selector — avoids a new array ref on every render
  const allAdded = installedBlocks.length >= BLOCK_DEFINITIONS.length

  // Sort categories: suggested first, then by defined order
  const sortedCategories = [...BLOCK_CATEGORIES].sort((a, b) => {
    const aSuggested = suggestedCategoryIds.includes(a.id) ? 0 : 1
    const bSuggested = suggestedCategoryIds.includes(b.id) ? 0 : 1
    if (aSuggested !== bSuggested) return aSuggested - bSuggested
    return a.order - b.order
  })

  const handleAddBlock = useCallback(async (blockType: string) => {
    if (!walletAddress || addingBlockType) return
    setAddingBlockType(blockType)
    try {
      await addBlock(blockType, walletAddress)
    } finally {
      setAddingBlockType(null)
    }
  }, [walletAddress, addBlock, addingBlockType])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePicker()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, closePicker])

  if (!isOpen) return null

  return (
    <div
      className='fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150'
      onClick={(e) => {
        if (e.target === e.currentTarget) closePicker()
      }}
    >
      {/* Backdrop */}
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden',
          isDark
            ? 'bg-gray-900 border border-gray-700'
            : 'bg-white border border-gray-200'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between px-5 py-4 border-b flex-shrink-0',
          isDark ? 'border-gray-700' : 'border-gray-200'
        )}>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center'>
              <Package className='w-5 h-5 text-teal-500' />
            </div>
            <div>
              <h2 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Add Blocks
              </h2>
              <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {allAdded
                  ? "You've added all available blocks!"
                  : 'Choose blocks to build your hub'}
              </p>
            </div>
          </div>
          <button
            onClick={closePicker}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark
                ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            )}
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Category list — scrollable */}
        <div className='flex-1 overflow-y-auto p-4 sm:p-5 space-y-3'>
          {sortedCategories.map((category) => {
            const blocks = getBlocksByCategory(category.id)
            if (blocks.length === 0) return null

            return (
              <BlockPickerCategory
                key={category.id}
                category={category}
                blocks={blocks}
                installedTypes={installedTypes}
                suggestedCategoryIds={suggestedCategoryIds}
                addingBlockType={addingBlockType}
                onAddBlock={handleAddBlock}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
