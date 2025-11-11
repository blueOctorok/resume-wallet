'use client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import dynamic from 'next/dynamic'
import { useTheme } from '@/contexts/ThemeContext'
import AdminResetWallet from '@/components/admin/AdminResetWallet'
import { useAccount } from '@account-kit/react'

const TBackendSetup = dynamic(() => import('@/components/admin/TBackendSetup'), {
  ssr: false,
})

export default function AdminPage() {
  const { theme } = useTheme()
  const account = useAccount({ type: 'LightAccount' })
  const adminKey = process.env.ADMIN_API_KEY

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <div>
          <h1
            className={`text-3xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-brand-sage'
            }`}
          >
            Admin Panel
          </h1>
          <p
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            Manage T Backend configuration and testing utilities.
          </p>
        </div>

        <AdminResetWallet
          adminKey={adminKey}
          initialWalletAddress={account?.address || ''}
        />

        <TBackendSetup />
      </div>
    </div>
  )
}

