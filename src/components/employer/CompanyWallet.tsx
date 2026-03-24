'use client'

import { useTheme } from '@/contexts/ThemeContext'
import Card from '@/components/ui/Card'
import WalletInfo from '@/components/WalletInfo'
import TransactionHistory from '@/components/TransactionHistory'
import { Wallet, Info } from 'lucide-react'

interface CompanyWalletProps {
  companyName: string
  companyWalletAddress: string | null
  /** True while POST ensure-wallet is in flight */
  walletProvisioning?: boolean
}

export default function CompanyWallet({
  companyName,
  companyWalletAddress,
  walletProvisioning = false,
}: CompanyWalletProps) {
  const { theme } = useTheme()

  return (
    <Card variant="elevated" className="mb-8 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-teal-500/15 text-teal-300' : 'bg-teal-50 text-teal-700'
          }`}
        >
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h2
            className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            Company wallet
          </h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Shared balance for {companyName}. Team members listed on the company can spend USDC from
            this address for employer purchases (e.g. MVR orders).
          </p>
        </div>
      </div>

      <div
        className={`flex gap-2 p-3 rounded-lg mb-4 text-sm ${
          theme === 'dark' ? 'bg-gray-800/80 text-gray-300' : 'bg-gray-50 text-gray-700'
        }`}
      >
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Your personal wallet is unchanged. Payments use a multi-owner smart account so purchases
          and STORM rewards stay with the company.
        </p>
      </div>

      {walletProvisioning && (
        <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-teal-300' : 'text-teal-700'}`}>
          Setting up your company wallet…
        </p>
      )}

      {!companyWalletAddress && !walletProvisioning ? (
        <p className={`text-sm ${theme === 'dark' ? 'text-amber-300' : 'text-amber-800'}`}>
          Company wallet is not available yet. Ensure the server has{' '}
          <code className="text-xs">COMPANY_WALLET_SERVICE_PRIVATE_KEY</code> set, then refresh the
          page.
        </p>
      ) : companyWalletAddress ? (
        <div className="space-y-4">
          <WalletInfo walletAddress={companyWalletAddress} defaultExpanded />
          <div>
            <h3
              className={`text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              Recent activity
            </h3>
            <TransactionHistory walletAddress={companyWalletAddress} />
          </div>
        </div>
      ) : null}
    </Card>
  )
}
