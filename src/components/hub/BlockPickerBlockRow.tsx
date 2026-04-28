'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Button from '@/components/ui/Button'
import { VaultCredentialChrome } from '@/components/hub/HubBlockVault'
import { getBlockColor } from '@/lib/block-registry'
import { getBlockIllustration } from '@/components/hub/BlockIllustrations'
import type { BlockDefinition } from '@/lib/block-registry'

const complexityLabel: Record<string, { text: string; color: string }> = {
  simple: { text: 'Quick setup', color: 'text-green-500 dark:text-green-400' },
  moderate: { text: 'A few steps', color: 'text-amber-500 dark:text-amber-400' },
  complex: { text: 'Multi-step flow', color: 'text-orange-500 dark:text-orange-400' },
}

export interface BlockPickerBlockRowProps {
  block: BlockDefinition
  installedTypes: Set<string>
  addingBlockType: string | null
  rowIndex: number
  onAddBlock: (blockType: string) => void
}

export default function BlockPickerBlockRow({
  block,
  installedTypes,
  addingBlockType,
  rowIndex,
  onAddBlock,
}: BlockPickerBlockRowProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const colors = getBlockColor(block.id)
  const Illustration = getBlockIllustration(block.id)
  const hint = complexityLabel[block.complexity] ?? complexityLabel.moderate
  const isInstalled = installedTypes.has(block.id)
  const isAdding = addingBlockType === block.id
  const [pulse, setPulse] = useState(false)

  const accentClass = isDark ? colors.iconText.dark : colors.iconText.light

  const defaultLight =
    'drop-shadow(0 4px 12px rgba(15,23,42,0.1)) drop-shadow(0 0 20px rgba(13,148,136,0.14))'
  const defaultDark = 'drop-shadow(0 3px 14px rgba(0,0,0,0.4))'
  const [vaultFilter, setVaultFilter] = useState(() => (isDark ? defaultDark : defaultLight))

  useEffect(() => {
    setVaultFilter(isDark ? defaultDark : defaultLight)
  }, [isDark])

  const handleAddClick = () => {
    if (isInstalled || isAdding) return
    setPulse(true)
    window.setTimeout(() => setPulse(false), 450)
    onAddBlock(block.id)
  }

  return (
    <div
      data-block-picker-animate
      style={{
        animation: `block-picker-stagger 0.44s ease-out ${rowIndex * 80}ms both`,
      }}
      className={cn(
        'group/row rounded-xl border p-3 sm:p-4 transition-opacity',
        isDark ? 'border-gray-700/90 bg-gray-900/40' : 'border-slate-200 bg-white/90',
        isInstalled && 'opacity-55',
      )}
    >
      <div className='flex gap-3 sm:gap-4'>
        <div
          className={cn(
            'relative h-[5.25rem] w-[5.25rem] shrink-0 transition-transform duration-300 sm:h-[5.5rem] sm:w-[5.5rem]',
            'group-hover/row:-translate-y-0.5',
          )}
        >
          <div className={cn('h-full w-full', pulse && 'animate-[block-picker-mini-pulse_0.45s_ease-out]')}>
            <VaultCredentialChrome
              isDark={isDark}
              glowColor={colors.glowColor}
              hasRoute
              className='h-full min-h-[5.25rem] sm:min-h-[5.5rem]'
              style={{ filter: vaultFilter }}
              onMouseEnter={() =>
                setVaultFilter(
                  isDark
                    ? `drop-shadow(0 8px 22px ${colors.glowColor})`
                    : `${defaultLight}, drop-shadow(0 6px 18px ${colors.glowColor})`,
                )
              }
              onMouseLeave={() => setVaultFilter(isDark ? defaultDark : defaultLight)}
            >
              <div className='flex h-full min-h-[5rem] items-center justify-center p-1 sm:min-h-[5.25rem]'>
                <div className='scale-[0.88] sm:scale-95'>
                  <Illustration accentText={accentClass} isDark={isDark} />
                </div>
              </div>
            </VaultCredentialChrome>
          </div>
        </div>

        <div className='flex min-w-0 flex-1 flex-col gap-2'>
          <div className='flex flex-wrap items-start justify-between gap-2'>
            <h4 className={cn('text-sm font-semibold sm:text-base', isDark ? 'text-white' : 'text-gray-900')}>
              {block.label}
            </h4>
            <span className={cn('shrink-0 text-[11px] font-medium', hint.color)}>{hint.text}</span>
          </div>
          <p className={cn('text-xs leading-relaxed sm:text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
            {block.description}
          </p>

          <div className='mt-auto pt-1'>
            {isInstalled ? (
              <span className='inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500 dark:text-emerald-400'>
                <Check className='h-4 w-4' aria-hidden />
                Added
              </span>
            ) : (
              <Button
                type='button'
                variant='primary'
                size='sm'
                disabled={isAdding}
                onClick={handleAddClick}
                className='w-full max-w-[11rem] sm:w-auto'
              >
                {isAdding ? (
                  <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
                ) : (
                  <Plus className='h-4 w-4' aria-hidden />
                )}
                Add
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
