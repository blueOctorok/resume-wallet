'use client'

import React from 'react'
import AdminResetWallet from '@/components/admin/AdminResetWallet'

interface ToolsTabProps {
  theme: 'light' | 'dark'
  walletAddress: string
}

export default function ToolsTab({ theme, walletAddress }: ToolsTabProps) {
  return <AdminResetWallet initialWalletAddress={walletAddress} />
}
