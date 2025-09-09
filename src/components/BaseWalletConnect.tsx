'use client'

import React, { useState, useEffect } from 'react'
import {
  baseAccountSDK,
  baseProvider,
  getCurrentChainId,
  isBaseNetwork,
} from '@/lib/base-account-sdk'

interface BaseWalletConnectProps {
  onWalletConnected?: (address: string) => void
  onWalletDisconnected?: () => void
}

export const BaseWalletConnect: React.FC<BaseWalletConnectProps> = ({
  onWalletConnected,
  onWalletDisconnected,
}) => {
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Check if wallet is already connected on component mount
  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    if (!baseProvider) {
      console.warn('Base provider not initialized')
      return
    }

    try {
      // Check if wallet is connected
      const accounts = await baseProvider.request({ method: 'eth_accounts' })
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0])
        setIsConnected(true)
        onWalletConnected?.(accounts[0])
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error)
    }
  }

  const connectWallet = async () => {
    if (!baseProvider) {
      setError('Base provider not initialized. Please refresh the page.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Request account access
      const accounts = await baseProvider.request({
        method: 'eth_requestAccounts',
      })

      if (accounts && accounts.length > 0) {
        const address = accounts[0]
        setWalletAddress(address)
        setIsConnected(true)
        onWalletConnected?.(address)
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      setError(error.message || 'Failed to connect wallet')
    } finally {
      setIsLoading(false)
    }
  }

  const disconnectWallet = async () => {
    try {
      // Base Account SDK doesn't have a direct disconnect method
      // The wallet will remain connected until the user manually disconnects
      // or clears their browser data
      setWalletAddress('')
      setIsConnected(false)
      onWalletDisconnected?.()
    } catch (error) {
      console.error('Error disconnecting wallet:', error)
    }
  }

  const getShortAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (isConnected) {
    return (
      <div className='flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg'>
        <div className='flex items-center gap-2'>
          <div className='w-3 h-3 bg-green-500 rounded-full'></div>
          <span className='text-sm font-medium text-green-800'>
            Connected: {getShortAddress(walletAddress)}
          </span>
        </div>
        <button
          onClick={disconnectWallet}
          className='px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors'
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className='p-4 bg-blue-50 border border-blue-200 rounded-lg'>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold text-blue-900'>
            Connect to Base
          </h3>
          <p className='text-sm text-blue-700'>
            Connect your Base Account to verify and manage your resume
          </p>
        </div>
        <button
          onClick={connectWallet}
          disabled={isLoading}
          className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          {isLoading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>

      {error && (
        <div className='mt-3 p-3 bg-red-100 border border-red-200 rounded text-red-700 text-sm'>
          {error}
        </div>
      )}
    </div>
  )
}

export default BaseWalletConnect
