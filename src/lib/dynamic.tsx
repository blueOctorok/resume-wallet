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
          onEmbeddedWalletCreated: (args) => {
            console.log('✅ Embedded wallet created successfully!', args)
            // You can add additional logic here like:
            // - Update user profile with wallet address
            // - Send welcome email
            // - Initialize user-specific data
          },
        },
        handlers: {
          handleConnectedWallet: (args) => {
            console.log('🔍 Checking wallet connection...', args)

            // Add your custom logic here
            // For example: fraud detection, address validation, etc.

            // Example: Check if wallet address is on a blocklist
            // const isBlocked = checkAddressBlocklist(args.address)
            // if (isBlocked) {
            //   console.log('❌ Wallet address is blocked')
            //   return false // Reject the connection
            // }

            // Example: Validate wallet address format
            if (!args.address || !args.address.startsWith('0x')) {
              console.log('❌ Invalid wallet address format')
              return false // Reject the connection
            }

            console.log('✅ Wallet connection approved')
            return true // Allow the connection
          },
        },
      }}
    >
      {children}
    </DynamicContextProvider>
  )
}
