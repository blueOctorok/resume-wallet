'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useCallback, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import BackToHubButton from '@/components/ui/BackToHubButton'
import {
  useHubBlocksStore,
  useIsPickerOpen,
  useInstalledBlocks,
  useHubOnboarding,
} from '@/stores/hub-blocks-store'
import { BLOCK_CATEGORIES, getBlocksByCategory, getPickerBlockDefinitions } from '@/lib/block-registry'
import { useAuthStore } from '@/stores'
import BlockPickerCategoryCard from './BlockPickerCategoryCard'
import BlockPickerBlockRow from './BlockPickerBlockRow'

/**
 * BlockPickerModal — two-step catalog: pick a category, then browse vault-style rows.
 * Opens when `isPickerOpen` is true in the hub-blocks-store.
 */
export default function BlockPickerModal() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const isOpen = useIsPickerOpen()
  const installedBlocks = useInstalledBlocks()
  const onboarding = useHubOnboarding()
  const closePicker = useHubBlocksStore((s) => s.closePicker)
  const addBlock = useHubBlocksStore((s) => s.addBlock)
  const walletAddress = useAuthStore((s) => s.walletAddress)

  const [addingBlockType, setAddingBlockType] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const installedTypes = new Set(installedBlocks.map((b) => b.blockType))
  const suggestedCategoryIds = onboarding?.suggestedCategories ?? []
  const pickerCatalog = getPickerBlockDefinitions()
  const allAdded =
    pickerCatalog.length > 0 && pickerCatalog.every((b) => installedTypes.has(b.id))

  useEffect(() => {
    if (isOpen) setSelectedCategoryId(null)
  }, [isOpen])

  const sortedCategories = [...BLOCK_CATEGORIES].sort((a, b) => {
    const aSuggested = suggestedCategoryIds.includes(a.id) ? 0 : 1
    const bSuggested = suggestedCategoryIds.includes(b.id) ? 0 : 1
    if (aSuggested !== bSuggested) return aSuggested - bSuggested
    return a.order - b.order
  })

  const handleAddBlock = useCallback(
    async (blockType: string) => {
      if (!walletAddress || addingBlockType) return
      setAddingBlockType(blockType)
      try {
        await addBlock(blockType, walletAddress)
      } finally {
        setAddingBlockType(null)
      }
    },
    [walletAddress, addBlock, addingBlockType],
  )

  if (!isOpen) return null

  const activeCategory = selectedCategoryId
    ? BLOCK_CATEGORIES.find((c) => c.id === selectedCategoryId)
    : null
  const categoryBlocks = selectedCategoryId ? getBlocksByCategory(selectedCategoryId) : []

  return (
    <Modal onClose={closePicker} maxWidth='max-w-3xl' panelShape='block'>
      <ModalHeader
        variant='block'
        title={activeCategory ? `${activeCategory.label} blocks` : 'Add Blocks'}
        subtitle={
          allAdded
            ? "You've added all available blocks!"
            : activeCategory
              ? 'Pick a block to install — descriptions show what each one does.'
              : 'Choose a category, then add blocks to your hub.'
        }
        onClose={closePicker}
      />
      <div
        className={cn(
          'p-4 sm:p-5 max-h-[min(70vh,36rem)] overflow-y-auto scrollbar-none',
          'border-t border-gray-200/80 dark:border-gray-700/80',
          isDark ? 'bg-gray-950/30' : 'bg-slate-50/50',
        )}
      >
        {selectedCategoryId && activeCategory ? (
          <div className='space-y-4'>
            <BackToHubButton label='Back to categories' onClick={() => setSelectedCategoryId(null)} />
            <div className='space-y-3'>
              {categoryBlocks.map((block, i) => (
                <BlockPickerBlockRow
                  key={block.id}
                  block={block}
                  installedTypes={installedTypes}
                  addingBlockType={addingBlockType}
                  rowIndex={i}
                  onAddBlock={handleAddBlock}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='space-y-3'>
              {sortedCategories.map((category, i) => {
                const blocks = getBlocksByCategory(category.id)
                if (blocks.length === 0) return null
                return (
                  <BlockPickerCategoryCard
                    key={category.id}
                    category={category}
                    blocks={blocks}
                    installedTypes={installedTypes}
                    suggestedCategoryIds={suggestedCategoryIds}
                    rowIndex={i}
                    onPick={() => setSelectedCategoryId(category.id)}
                  />
                )
              })}
            </div>

            <p
              data-block-picker-animate
              style={{ animation: 'block-picker-stagger 0.48s ease-out 320ms both' }}
              className={cn(
                'flex items-center justify-center gap-2 pt-2 text-center text-xs',
                isDark ? 'text-gray-500' : 'text-slate-500',
              )}
            >
              <Sparkles className='h-3.5 w-3.5 shrink-0 text-teal-500 dark:text-teal-400' aria-hidden />
              <span>More career-specific blocks coming soon</span>
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
