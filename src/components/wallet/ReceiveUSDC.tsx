'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { Copy, Check, ExternalLink } from 'lucide-react'

interface ReceiveUSDCProps {
  walletAddress: string
}

export default function ReceiveUSDC({ walletAddress }: ReceiveUSDCProps) {
  const { theme } = useTheme()
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  // Generate QR code URL using a public API (no library needed)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(walletAddress)}`

  const baseScanUrl = `https://sepolia.basescan.org/address/${walletAddress}`

  return (
    <div className='space-y-6'>
      {/* QR Code */}
      <div className='flex flex-col items-center'>
        <div className={`p-4 rounded-xl ${
          theme === 'dark'
            ? 'bg-white/10 backdrop-blur-sm'
            : 'bg-gray-50'
        }`}>
          <img
            src={qrCodeUrl}
            alt='Wallet QR Code'
            className='w-48 h-48'
          />
        </div>
        <p className={`text-sm mt-4 ${
          theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
        }`}>
          Scan to receive USDC
        </p>
      </div>

      {/* Wallet Address */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-brand-cream' : 'text-gray-700'
        }`}>
          Your Wallet Address
        </label>
        <div className='flex items-center gap-2'>
          <div className={`flex-1 px-4 py-3 rounded-lg border font-mono text-sm break-all ${
            theme === 'dark'
              ? 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream'
              : 'bg-white border-gray-300 text-gray-900'
          }`}>
            {walletAddress}
          </div>
          <button
            onClick={copyToClipboard}
            className={`p-3 rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'bg-brand-sage-light/20 border-brand-cream/30 hover:bg-brand-sage-light/30 text-brand-cream'
                : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
            aria-label='Copy address'
          >
            {copied ? (
              <Check className='w-5 h-5 text-green-500' />
            ) : (
              <Copy className='w-5 h-5' />
            )}
          </button>
        </div>
        {copied && (
          <p className={`text-xs mt-2 ${
            theme === 'dark' ? 'text-green-400' : 'text-green-600'
          }`}>
            Address copied to clipboard!
          </p>
        )}
      </div>

      {/* Network Info */}
      <div className={`p-4 rounded-lg ${
        theme === 'dark'
          ? 'bg-brand-sage/20 border border-brand-mint/30'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-700'
            }`}>
              Network:
            </span>
            <span className={`text-sm ${
              theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'
            }`}>
              Base Sepolia (Testnet)
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-700'
            }`}>
              Token:
            </span>
            <span className={`text-sm ${
              theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'
            }`}>
              USDC
            </span>
          </div>
        </div>
      </div>

      {/* View on Explorer */}
      <a
        href={baseScanUrl}
        target='_blank'
        rel='noopener noreferrer'
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
          theme === 'dark'
            ? 'bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border border-brand-cream/30 text-brand-cream'
            : 'bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700'
        }`}
      >
        <ExternalLink className='w-4 h-4' />
        View on BaseScan
      </a>

      <p className={`text-xs text-center ${
        theme === 'dark' ? 'text-brand-cream/50' : 'text-gray-500'
      }`}>
        Only send USDC tokens to this address on Base Sepolia network
      </p>
    </div>
  )
}

