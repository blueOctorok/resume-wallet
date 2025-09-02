'use client'

import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core'
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum'

export function DynamicProvider({ children }: { children: React.ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
        walletConnectors: [EthereumWalletConnectors],
        events: {
          onAuthInit: (args) => {
            console.log('onAuthInit was called', args)
          },
          onAuthSuccess: (args) => {
            console.log('onAuthSuccess was called', args)
          },
          onAuthFailure: (args) => {
            console.log('onAuthFailure was called', args)
          },
        },
      }}
    >
      {children}
    </DynamicContextProvider>
  )
}
