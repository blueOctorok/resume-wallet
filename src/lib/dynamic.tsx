'use client'

import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core'

// Minimal Dynamic.xyz configuration to avoid 404 errors
export const dynamicConfig = {
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
  settings: {
    environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
    // Only enable basic wallet types to avoid chain loading
    walletList: ['metamask'],
    // Disable features that cause chain loading
    enableAnalytics: false,
    enableLogging: false,
    // Minimal configuration
    eventsCallbacks: {
      onAuthSuccess: (args: any) => {
        console.log('User authenticated successfully:', args)
      },
      onAuthFailure: (args: any) => {
        console.error('Authentication failed:', args)
      },
      onConnect: (args: any) => {
        console.log('Wallet connected:', args)
      },
      onDisconnect: (args: any) => {
        console.log('Wallet disconnected:', args)
      },
    },
  },
}

// Dynamic.xyz Provider component
export function DynamicProvider({ children }: { children: React.ReactNode }) {
  return (
    <DynamicContextProvider {...dynamicConfig}>
      {children}
    </DynamicContextProvider>
  )
}
