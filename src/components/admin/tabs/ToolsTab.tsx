'use client'

import React from 'react'
import AdminResetWallet from '@/components/admin/AdminResetWallet'

interface ToolsTabProps {
  theme: 'light' | 'dark'
  sessionUserId: string
}

export default function ToolsTab({ theme, sessionUserId }: ToolsTabProps) {
  return <AdminResetWallet initialWalletAddress={sessionUserId} />
}
