'use client'

import { useState, useCallback } from 'react'
import { Package, ChevronDown, Check, Plus, Loader2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Button from '@/components/ui/Button'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import {
  useEmployerBlocksStore,
  useEmployerIsPickerOpen,
  useEmployerInstalledBlocks,
} from '@/stores/employer-blocks-store'
import {
  EMPLOYER_BLOCK_CATEGORIES,
  EMPLOYER_BLOCK_DEFINITIONS,
  getEmployerBlocksByCategory,
} from '@/lib/employer-block-registry'
import type { EmployerBlockDefinition, EmployerBlockCategory } from '@/lib/employer-block-registry'
import { useAuthStore } from '@/stores'

function resolveIcon(name: string) {
  const Icon = (LucideIcons as Record<string, LucideIcons.LucideIcon>)[name]
  return Icon ?? LucideIcons.Box
}

// ── Category accordion ──────────────────────────────────────────────────────

interface CategorySectionProps {
  category: EmployerBlockCategory
  blocks: EmployerBlockDefinition[]
  installedTypes: Set<string>
  addingBlockType: string | null
  onAddBlock: (blockType: string) => void
}

function CategorySection({ category, blocks, installedTypes, addingBlockType, onAddBlock }: CategorySectionProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [isOpen, setIsOpen] = useState(true)

  const CategoryIcon = resolveIcon(category.icon)
  const installedCount = blocks.filter((b) => installedTypes.has(b.id)).length

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      isDark ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-white',
    )}>
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

      {isOpen && (
        <div className={cn('border-t px-4 py-2 space-y-2', isDark ? 'border-gray-700' : 'border-gray-200')}>
          {blocks.map((block) => {
            const isInstalled = installedTypes.has(block.id)
            const isAdding = addingBlockType === block.id
            const BlockIcon = resolveIcon(block.icon)

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

// ── Modal ────────────────────────────────────────────────────────────────────

export default function EmployerBlockPickerModal() {
  const isOpen = useEmployerIsPickerOpen()
  const installedBlocks = useEmployerInstalledBlocks()
  const closePicker = useEmployerBlocksStore((s) => s.closePicker)
  const addBlock = useEmployerBlocksStore((s) => s.addBlock)
  const walletAddress = useAuthStore((s) => s.walletAddress)

  const [addingBlockType, setAddingBlockType] = useState<string | null>(null)

  const installedTypes = new Set(installedBlocks.map((b) => b.blockType))
  const allAdded = installedBlocks.length >= EMPLOYER_BLOCK_DEFINITIONS.length

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
    <Modal onClose={closePicker} maxWidth='max-w-2xl'>
      <ModalHeader
        title='Add Tools'
        subtitle={allAdded ? "You've added all available tools!" : 'Add industry-specific tools to your hub'}
        onClose={closePicker}
      />
      <div className='p-4 sm:p-5 space-y-3'>
        {EMPLOYER_BLOCK_CATEGORIES.map((category) => {
          const blocks = getEmployerBlocksByCategory(category.id)
          if (blocks.length === 0) return null

          return (
            <CategorySection
              key={category.id}
              category={category}
              blocks={blocks}
              installedTypes={installedTypes}
              addingBlockType={addingBlockType}
              onAddBlock={handleAddBlock}
            />
          )
        })}
      </div>
    </Modal>
  )
}
