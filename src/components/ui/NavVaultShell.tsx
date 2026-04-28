'use client'

/**
 * Nav container: horizontal vault credential behind content. Delegates to `VaultHorizontalVaultShell`
 * with nav width + padding. Clip applies only to the decorative layer so dropdowns are not clipped.
 */
import type { ReactNode } from 'react'
import VaultHorizontalVaultShell from '@/components/ui/VaultHorizontalVaultShell'

export interface NavVaultShellProps {
  isDark: boolean
  children: ReactNode
  className?: string
}

export default function NavVaultShell({ isDark, children, className }: NavVaultShellProps) {
  return (
    <VaultHorizontalVaultShell
      layout='nav'
      isDark={isDark}
      className={className}
      contentClassName='px-3 pb-[13px] pt-3 sm:px-4 sm:pb-[14px] sm:pt-4'
    >
      {children}
    </VaultHorizontalVaultShell>
  )
}
