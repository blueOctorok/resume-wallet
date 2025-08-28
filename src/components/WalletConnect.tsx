'use client'

import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { useState, useEffect } from 'react'
import {
  WalletIcon,
  UserIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

export function WalletConnect() {
  const context = useDynamicContext()
  const [isConnecting, setIsConnecting] = useState(false)

  // Debug: Log what's available in the context
  useEffect(() => {
    console.log('Dynamic.xyz context:', context)
    console.log('Available methods:', Object.keys(context))
    // Log specific properties we might need
    console.log('handleConnect exists:', 'handleConnect' in context)
    console.log('handleDisconnect exists:', 'handleDisconnect' in context)
    console.log('primaryWallet:', context.primaryWallet)
  }, [context])

  const handleWalletConnect = async () => {
    setIsConnecting(true)
    try {
      // Based on console output, use the methods that actually exist
      if (
        'setShowAuthFlow' in context &&
        typeof context.setShowAuthFlow === 'function'
      ) {
        console.log('Using setShowAuthFlow to trigger connection modal')
        // This should trigger Dynamic.xyz's built-in connection flow
        ;(context as any).setShowAuthFlow(true)
      } else if (
        'handleUnlinkWallet' in context &&
        typeof context.handleUnlinkWallet === 'function'
      ) {
        console.log('Using handleUnlinkWallet method')
        await (context as any).handleUnlinkWallet()
      } else if (
        context.primaryWallet?.connector &&
        'connect' in context.primaryWallet.connector
      ) {
        console.log('Using primary wallet connector')
        await (context.primaryWallet.connector as any).connect()
      } else {
        // Fallback: show instructions
        console.log('No direct connection method available')
        alert(
          'Please use your browser extension (MetaMask, etc.) to connect your wallet, or check the console for available methods.'
        )
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      alert('Failed to connect wallet. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleWalletDisconnect = async () => {
    try {
      if (
        'handleDisconnect' in context &&
        typeof context.handleDisconnect === 'function'
      ) {
        await (context as any).handleDisconnect()
      } else if (
        context.primaryWallet?.connector &&
        'disconnect' in context.primaryWallet.connector
      ) {
        await (context.primaryWallet.connector as any).disconnect()
      } else {
        console.log('No disconnect method available')
        alert('Please disconnect manually from your wallet')
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
      alert('Failed to disconnect wallet. Please try again.')
    }
  }

  // Check if user is logged in (using available properties)
  const isLoggedIn = context.user && context.primaryWallet
  const primaryWallet = context.primaryWallet
  const user = context.user

  // Show wallet info when connected
  if (isLoggedIn && primaryWallet) {
    return (
      <div className='flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg'>
        <div className='flex items-center gap-2'>
          <WalletIcon className='w-5 h-5 text-green-600' />
          <span className='text-sm font-medium text-green-800'>
            Wallet Connected
          </span>
        </div>

        <div className='flex items-center gap-2 ml-auto'>
          <UserIcon className='w-4 h-4 text-green-600' />
          <span className='text-xs text-green-700 font-mono'>
            {primaryWallet.address?.slice(0, 6)}...
            {primaryWallet.address?.slice(-4)}
          </span>

          <button
            onClick={handleWalletDisconnect}
            className='px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors'
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  // Show connect button when not connected
  return (
    <div className='p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg'>
      <div className='flex items-center gap-3'>
        <div className='flex-shrink-0'>
          <WalletIcon className='w-8 h-8 text-blue-600' />
        </div>

        <div className='flex-1'>
          <h3 className='text-sm font-medium text-blue-900'>
            Connect Your Wallet
          </h3>
          <p className='text-xs text-blue-700 mt-1'>
            Connect your wallet to upload resumes and verify credentials on the
            blockchain
          </p>
        </div>

        <button
          onClick={handleWalletConnect}
          disabled={isConnecting}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          {isConnecting ? (
            'Connecting...'
          ) : (
            <>
              Connect Wallet
              <ArrowRightIcon className='w-4 h-4' />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
