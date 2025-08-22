'use client'

import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core'
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum'

export const DynamicProvider = ({
  children,
}: {
  children: React.ReactNode
}) => (
  <DynamicContextProvider
    settings={{
      environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
      walletConnectors: [EthereumWalletConnectors],
      evmNetworks: [
        {
          chainId: 80001,
          chainName: 'Polygon Mumbai',
          rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        },
      ],
    }}
  >
    {children}
  </DynamicContextProvider>
)
