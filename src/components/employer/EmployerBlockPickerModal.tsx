'use client'

import { useState, useCallback } from 'react'
import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { VaultCredentialChrome } from '@/components/hub/HubBlockVault'
import { getBlockColor } from '@/lib/block-registry'
import { getInstallableEmployerBlockDefinitions } from '@/lib/employer-block-registry'
import { Plus, Check } from 'lucide-react'

export interface EmployerBlockPickerModalProps {
  open: boolean
  onClose: () => void
  /** Block types already installed for this company */
  installedTypes: Set<string>
  /** False for employer recruiters/viewers — browse only */
  canInstall: boolean
  /** Returns true on success so parent can refresh */
  onInstallBlock: (blockType: string) => Promise<boolean>
}

/**
 * Catalog of installable employer blocks (MVR / PSP). Mirrors candidate BlockPicker vault chrome.
 */
export default function EmployerBlockPickerModal({
  open,
  onClose,
  installedTypes,
  canInstall,
  onInstallBlock,
}: EmployerBlockPickerModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [adding, setAdding] = useState<string | null>(null)

  const catalog = [...getInstallableEmployerBlockDefinitions()].sort(
    (a, b) => a.suggestedOrder - b.suggestedOrder,
  )

  const handleAdd = useCallback(
    async (blockType: string) => {
      if (!canInstall || adding) return
      setAdding(blockType)
      try {
        const ok = await onInstallBlock(blockType)
        if (ok) onClose()
      } finally {
        setAdding(null)
      }
    },
    [canInstall, adding, onInstallBlock, onClose],
  )

  if (!open) return null

  return (
    <Modal onClose={onClose} maxWidth='max-w-lg' panelShape='block' zIndex={1100}>
      <ModalHeader
        variant='block'
        title='Employer blocks'
        subtitle={
          canInstall
            ? 'Add capabilities your hiring team needs. Universal features (jobs, applicants, talent search) stay on without installing anything.'
            : 'Only company owners and admins can install or remove blocks. Ask an admin to enable MVR or PSP ordering.'
        }
        onClose={onClose}
      />
      <div
        className={cn(
          'max-h-[min(70vh,28rem)] space-y-3 overflow-y-auto p-4 sm:p-5',
          'border-t border-gray-200/80 dark:border-gray-700/80',
          isDark ? 'bg-gray-950/30' : 'bg-slate-50/50',
        )}
      >
        {catalog.map((def) => {
          const installed = installedTypes.has(def.id)
          const colors = getBlockColor(def.categoryId === 'drivers' ? 'driver-mvr' : 'general-resume')
          const Icon = def.icon
          const accentClass = isDark ? colors.iconText.dark : colors.iconText.light
          const isAdding = adding === def.id

          return (
            <div
              key={def.id}
              className={cn(
                'flex gap-3 rounded-xl border p-3 sm:p-4',
                isDark ? 'border-gray-700/90 bg-gray-900/40' : 'border-slate-200 bg-white/90',
                installed && 'opacity-60',
              )}
            >
              <div className='relative h-14 w-14 shrink-0 sm:h-16 sm:w-16'>
                <VaultCredentialChrome
                  isDark={isDark}
                  glowColor={colors.glowColor}
                  hasRoute
                  className='h-full min-h-14 sm:min-h-16'
                >
                  <div className='flex h-full items-center justify-center p-1'>
                    <Icon className={cn('h-6 w-6 sm:h-7 sm:w-7', accentClass)} aria-hidden />
                  </div>
                </VaultCredentialChrome>
              </div>
              <div className='min-w-0 flex-1'>
                <p className={cn('text-sm font-semibold', isDark ? 'text-gray-100' : 'text-gray-900')}>{def.label}</p>
                <p className={cn('mt-0.5 text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>{def.description}</p>
                {def.pricingNote && (
                  <p className={cn('mt-1 text-[11px]', isDark ? 'text-gray-500' : 'text-gray-500')}>{def.pricingNote}</p>
                )}
                {def.complianceNote && (
                  <p className={cn('mt-1 text-[11px] font-medium', isDark ? 'text-amber-300/90' : 'text-amber-800')}>
                    {def.complianceNote}
                  </p>
                )}
              </div>
              <div className='flex shrink-0 items-center'>
                {installed ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
                      isDark ? 'bg-teal-500/15 text-teal-300' : 'bg-teal-50 text-teal-800',
                    )}
                  >
                    <Check className='h-3.5 w-3.5' />
                    Installed
                  </span>
                ) : (
                  <Button
                    type='button'
                    size='sm'
                    variant='primary'
                    disabled={!canInstall || isAdding}
                    isLoading={isAdding}
                    onClick={() => void handleAdd(def.id)}
                    className='shrink-0'
                  >
                    <Plus className='mr-1 h-3.5 w-3.5' />
                    Add
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
