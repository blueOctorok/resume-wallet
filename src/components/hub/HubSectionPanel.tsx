'use client'

/**
 * Standard chrome for hub-style sections (Block files, Your blocks, Ask Stormi, job alerts, etc.):
 * `VaultHorizontalVaultShell` in `panel` layout with the shared padding contract.
 *
 * Wrap **`BlockCard variant="embed"`** as the direct child — same pairing as `CandidateHub.tsx`.
 */
import type { ReactNode } from 'react'
import VaultHorizontalVaultShell from '@/components/ui/VaultHorizontalVaultShell'
import type { VaultAccentPreset } from '@/lib/vault-accent-presets'
import { cn } from '@/lib/utils'

export interface HubSectionPanelProps {
  isDark: boolean
  children: ReactNode
  /** Rim / strip / glow — matches hub sections (teal = blocks, violet = Stormi, sky = job alerts, …) */
  accent?: VaultAccentPreset
  /**
   * Inner padding; default matches Block Hive / Block files / Ask Stormi.
   * Override for one-offs (e.g. profile header uses `p-6 sm:p-7`).
   */
  contentClassName?: string
  className?: string
}

const DEFAULT_CONTENT_PADDING = 'p-4 sm:p-5 lg:p-6'

export default function HubSectionPanel({
  isDark,
  children,
  accent = 'teal',
  contentClassName,
  className,
}: HubSectionPanelProps) {
  return (
    <VaultHorizontalVaultShell
      isDark={isDark}
      layout='panel'
      accent={accent}
      className={className}
      contentClassName={cn(DEFAULT_CONTENT_PADDING, contentClassName)}
    >
      {children}
    </VaultHorizontalVaultShell>
  )
}
