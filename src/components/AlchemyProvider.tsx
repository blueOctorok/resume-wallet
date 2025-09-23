'use client'

/**
 * Alchemy Account Provider Wrapper
 *
 * Simplified client-only provider to avoid SSR issues
 */

import { useEffect, useState } from 'react'
import { AlchemyAccountProvider } from '@account-kit/react'
import { QueryClient } from '@tanstack/react-query'
import { getAlchemyAccountConfig } from '@/lib/alchemy-account-config'

interface AlchemyProviderProps {
  children: React.ReactNode
}

export default function AlchemyProvider({ children }: AlchemyProviderProps) {
  const [mounted, setMounted] = useState(false)

  // Only render on client side to avoid SSR issues
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return children without provider during SSR
    return <>{children}</>
  }

  // Use the proper configuration from our config file
  const config = getAlchemyAccountConfig()

  if (!config) {
    console.error('❌ Alchemy config is undefined!')
    return (
      <div className='bg-red-50 p-4 rounded-lg m-4'>
        <h3 className='text-red-800 font-medium'>Configuration Error</h3>
        <p className='text-red-600 text-sm'>
          Alchemy Smart Wallets configuration failed to load. Check console for
          details.
        </p>
      </div>
    )
  }

  // Create a query client for React Query
  const queryClient = new QueryClient()

  return (
    <AlchemyAccountProvider config={config} queryClient={queryClient}>
      {children}
    </AlchemyAccountProvider>
  )
}
