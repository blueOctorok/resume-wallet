'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import {
  useHubBlocksStore,
  useIsPickerOpen,
  useInstalledBlocks,
} from '@/stores/hub-blocks-store'
import { getPickerBlockDefinitions } from '@/lib/block-registry'
import { useAuthStore } from '@/stores'
import BlockPickerBlockRow from './BlockPickerBlockRow'

/**
 * Flat drivers-only feature catalog — no General / Drivers / Developers category step.
 */
export default function BlockPickerModal() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const isOpen = useIsPickerOpen()
  const installedBlocks = useInstalledBlocks()
  const closePicker = useHubBlocksStore((s) => s.closePicker)
  const addBlock = useHubBlocksStore((s) => s.addBlock)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)

  const [addingBlockType, setAddingBlockType] = useState<string | null>(null)

  const installedTypes = new Set(installedBlocks.map((b) => b.blockType))
  const pickerCatalog = getPickerBlockDefinitions()
  const allAdded =
    pickerCatalog.length > 0 && pickerCatalog.every((b) => installedTypes.has(b.id))

  const handleAddBlock = useCallback(
    async (blockType: string) => {
      if (!sessionUserId || addingBlockType) return
      setAddingBlockType(blockType)
      try {
        await addBlock(blockType, sessionUserId)
      } finally {
        setAddingBlockType(null)
      }
    },
    [sessionUserId, addBlock, addingBlockType],
  )

  if (!isOpen) return null

  return (
    <Modal onClose={closePicker} maxWidth='max-w-3xl' panelShape='block'>
      <ModalHeader
        variant='block'
        title='Add features to career card'
        subtitle={
          allAdded
            ? "You've added all available features."
            : 'Pick a feature to strengthen your card — employers see what you install.'
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
        {pickerCatalog.length === 0 ? (
          <p className={cn('text-center text-sm py-8', isDark ? 'text-gray-400' : 'text-slate-500')}>
            No features available to add right now.
          </p>
        ) : (
          <div className='space-y-3'>
            {pickerCatalog.map((block, i) => (
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
        )}
      </div>
    </Modal>
  )
}
