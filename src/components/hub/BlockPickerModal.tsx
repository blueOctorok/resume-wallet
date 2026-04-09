'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import {
  useHubBlocksStore,
  useIsPickerOpen,
  useInstalledBlocks,
  useHubOnboarding,
} from '@/stores/hub-blocks-store'
import { BLOCK_CATEGORIES, getBlocksByCategory, getPickerBlockDefinitions } from '@/lib/block-registry'
import { useAuthStore } from '@/stores'
import BlockPickerCategory from './BlockPickerCategory'

/**
 * BlockPickerModal — the catalog where candidates browse and add blocks.
 *
 * Opens when `isPickerOpen` is true in the hub-blocks-store.
 * Categories render as accordions. Suggested categories (from Stormi's
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
  const pickerCatalog = getPickerBlockDefinitions()
  const allAdded =
    pickerCatalog.length > 0 && pickerCatalog.every((b) => installedTypes.has(b.id))

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

  if (!isOpen) return null

  return (
    <Modal onClose={closePicker} maxWidth='max-w-3xl'>
      <ModalHeader
        title='Add Blocks'
        subtitle={allAdded ? "You've added all available blocks!" : 'Choose blocks to build your hub'}
        onClose={closePicker}
      />
      <div
        className={cn(
          'p-4 sm:p-5 space-y-3 max-h-[min(70vh,36rem)] overflow-y-auto',
          'border-t border-gray-200/80 dark:border-gray-700/80',
          isDark ? 'bg-gray-950/30' : 'bg-slate-50/50',
        )}
      >
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
    </Modal>
  )
}
