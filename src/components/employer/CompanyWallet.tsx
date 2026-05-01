'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import WalletInfo from '@/components/WalletInfo'
import TransactionHistory from '@/components/TransactionHistory'
import { Wallet, Info, Loader2 } from 'lucide-react'

export type CompanyWalletLayout = 'rail' | 'modal'

export interface CompanyWalletContentProps {
  companyName: string
  companyWalletAddress: string | null
  /** True while POST ensure-wallet is in flight */
  walletProvisioning?: boolean
  layout: CompanyWalletLayout
  /** Use with `ModalHeader` so the title is not duplicated */
  omitHero?: boolean
}

/**
 * Shared body for the employer company wallet — desktop left rail or mobile modal.
 */
export function CompanyWalletContent({
  companyName,
  companyWalletAddress,
  walletProvisioning = false,
  layout,
  omitHero = false,
}: CompanyWalletContentProps) {
  const { theme } = useTheme()
  const isRail = layout === 'rail'
  const ink = theme === 'ink'
  const dark = isDarkTheme(theme)

  return (
    <div className={cn(isRail ? 'space-y-3' : 'space-y-5')}>
      {!omitHero && (
        <div
          className={cn(
            'rounded-xl border overflow-hidden',
            ink
              ? 'border-zinc-600/50 bg-gradient-to-br from-zinc-800/55 via-zinc-900/70 to-zinc-950/80'
              : dark
                ? 'border-teal-500/25 bg-gradient-to-br from-teal-500/15 via-gray-900/40 to-cyan-500/10'
                : 'border-teal-200/60 bg-gradient-to-br from-teal-50 via-white to-cyan-50/80',
          )}
        >
          <div className={cn('flex items-center gap-3', isRail ? 'p-3' : 'p-4')}>
            <div
              className={cn(
                'rounded-xl shadow-sm flex items-center justify-center shrink-0',
                isRail ? 'p-2.5' : 'p-3',
                ink ? 'bg-zinc-800/95 text-zinc-200' : dark ? 'bg-gray-800/90 text-teal-300' : 'bg-white text-teal-700',
              )}
            >
              <Wallet className={isRail ? 'w-5 h-5' : 'w-6 h-6'} />
            </div>
            <div className="min-w-0">
              <h2
                className={cn(
                  'font-bold tracking-tight',
                  ink ? 'text-zinc-50' : 'text-gray-900 dark:text-gray-100',
                  isRail ? 'text-base' : 'text-lg',
                )}
              >
                Company wallet
              </h2>
              <p
                className={cn(
                  'truncate',
                  ink ? 'text-zinc-400' : 'text-gray-600 dark:text-gray-400',
                  isRail ? 'text-xs' : 'text-sm',
                )}
                title={companyName}
              >
                {companyName}
              </p>
            </div>
          </div>
        </div>
      )}

      <p
        className={cn(
          ink ? 'text-zinc-400' : 'text-gray-600 dark:text-gray-300 leading-snug',
          isRail ? 'text-xs' : 'text-sm',
        )}
      >
        {isRail
          ? 'Shared company address for team purchases — separate from your personal wallet.'
          : `Shared balance for ${companyName}. Team members can use this address for employer purchases such as MVR orders.`}
      </p>

      <div
        className={cn(
          'flex gap-2 p-3 rounded-xl text-xs border',
          ink
            ? 'bg-zinc-800/70 border-zinc-600/60 text-zinc-300'
            : dark
              ? 'bg-gray-800/60 border-gray-700 text-gray-300'
              : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-300',
        )}
      >
        <Info className={cn('w-4 h-4 shrink-0 mt-0.5', ink ? 'text-zinc-400' : 'text-teal-600 dark:text-teal-400')} />
        <p>
          Your personal wallet is unchanged. This smart account keeps company USDC and STORM rewards
          in one place.
        </p>
      </div>

      {walletProvisioning && (
        <p className={cn('flex items-center gap-2 text-sm', ink ? 'text-zinc-300' : 'text-teal-600 dark:text-teal-300')}>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Setting up your company wallet…
        </p>
      )}

      {!companyWalletAddress && !walletProvisioning ? (
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          Wallet not available yet. If this persists, confirm{' '}
          <code className="text-[0.65rem] px-1 py-0.5 rounded bg-amber-500/10 dark:bg-amber-500/20">
            COMPANY_WALLET_SERVICE_PRIVATE_KEY
          </code>{' '}
          is configured, then refresh.
        </p>
      ) : companyWalletAddress ? (
        <div className="space-y-3">
          <WalletInfo walletAddress={companyWalletAddress} defaultExpanded />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Recent activity
            </h3>
            <div
              className={cn(
                'rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden',
                isRail && 'max-h-[min(42vh,360px)] overflow-y-auto overscroll-contain',
              )}
            >
              <TransactionHistory
                walletAddress={companyWalletAddress}
                maxTransactions={isRail ? 8 : 20}
                showFilters={!isRail}
                autoRefresh={false}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
