'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Wallet, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import BuyUSDCButton from './BuyUSDCButton'

interface WalletCardProps {
  user: {
    address: string
    message?: string
    signature?: string
    method?: string
  } | null
  onClick?: () => void
  isMobile?: boolean
  userRole?: 'driver' | 'developer' | 'employer' | null
  onSwitchRole?: () => void
  /** Show the Buy USDC button (default: true for desktop, false for mobile) */
  showBuyUSDC?: boolean
}

export default function WalletCard({
  user,
  onClick,
  isMobile = false,
  userRole,
  onSwitchRole,
  showBuyUSDC,
}: WalletCardProps) {
  // Default: show Buy USDC on desktop, hide on mobile
  const shouldShowBuyUSDC = showBuyUSDC ?? !isMobile
  const [copied, setCopied] = useState(false)
  const [showFullAddress, setShowFullAddress] = useState(false)
  const { theme } = useTheme()
  const showAdminTools = process.env.NODE_ENV !== 'production'

  const formatAddress = (address: string) => {
    if (!address) return ''
    if (showFullAddress || isMobile) {
      return address
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyToClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.address) return

    try {
      await navigator.clipboard.writeText(user.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  const toggleAddressVisibility = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowFullAddress(!showFullAddress)
  }

  if (!user?.address) {
    return null
  }

  if (isMobile) {
    // Mobile: Button style
    return (
      <div className='flex items-center gap-2'>
        <button
          onClick={onClick}
          className={`relative group flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
            theme !== 'dark'
              ? 'text-gray-800 bg-white/70 hover:bg-gray-100 border-gray-200'
              : 'bg-gray-800/50 text-gray-200 hover:bg-gray-700/50 border-gray-600'
          }`}
        >
          <Wallet className='w-4 h-4' />
          <span className='hidden sm:inline'>Wallet</span>

          {/* Tooltip */}
          <div className='absolute left-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
            View wallet details
          </div>
        </button>
      </div>
    )
  }

  // Desktop: Card style — same surface as employment verification
  return (
    <div
      onClick={onClick}
      className={`relative group cursor-pointer backdrop-blur-sm rounded-xl border transition-all duration-300 p-4 min-w-[280px] ${
        theme !== 'dark'
          ? 'bg-white/70 border-gray-200 hover:border-gray-300'
          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
      }`}
    >
      {/* Wallet Header */}
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-50'
            }`}
          >
            <Wallet
              className={`w-4 h-4 ${
                theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
              }`}
            />
          </div>
          <span
            className={`text-sm font-semibold ${
              theme !== 'dark' ? 'text-gray-800' : 'text-gray-200'
            }`}
          >
            Wallet
          </span>
        </div>

        <button
          onClick={toggleAddressVisibility}
          className={`p-1.5 rounded-lg transition-colors ${
            theme !== 'dark'
              ? 'hover:bg-gray-200 text-gray-600'
              : 'hover:bg-gray-600/50 text-gray-400'
          }`}
          aria-label={
            showFullAddress ? 'Hide full address' : 'Show full address'
          }
        >
          {showFullAddress ? (
            <EyeOff className='w-3.5 h-3.5' />
          ) : (
            <Eye className='w-3.5 h-3.5' />
          )}
        </button>
      </div>

      {/* Address */}
      <div className='space-y-2'>
        <div className='flex items-center gap-2'>
          <span
            className={`text-xs font-medium ${
              theme !== 'dark' ? 'text-gray-600' : 'text-brand-cream/70'
            }`}
          >
            Address:
          </span>
          <button
            onClick={copyToClipboard}
            className={`p-1 rounded transition-colors ${
              theme !== 'dark'
                ? 'bg-teal-600/20 hover:bg-teal-600/30'
                : 'bg-teal-600/40 hover:bg-teal-600/60'
            }`}
            aria-label='Copy address'
          >
            {copied ? (
              <Check className='w-3 h-3 text-green-400' />
            ) : (
              <Copy
                className={`w-3 h-3 ${
                  theme !== 'dark' ? 'text-gray-600' : 'text-gray-400'
                }`}
              />
            )}
          </button>
        </div>

        <div
          className={`rounded-lg p-2.5 ${
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
          }`}
        >
          <code
            className={`text-xs font-mono break-all ${
              theme !== 'dark' ? 'text-gray-700' : 'text-gray-300'
            }`}
          >
            {formatAddress(user.address)}
          </code>
        </div>
      </div>

      {/* Network Info */}
      <div
        className={`mt-3 pt-3 border-t ${
          theme !== 'dark' ? 'border-gray-200' : 'border-gray-600'
        }`}
      >
        <div className='flex items-center justify-between text-xs'>
          <span
            className={
              theme !== 'dark' ? 'text-gray-600' : 'text-gray-400'
            }
          >
            Network:
          </span>
          <span
            className={`font-medium ${
              theme !== 'dark' ? 'text-gray-800' : 'text-indigo-400'
            }`}
          >
            Base Sepolia
          </span>
        </div>

        {user.method && (
          <div className='flex items-center justify-between text-xs mt-1'>
            <span
              className={
                theme !== 'dark' ? 'text-gray-600' : 'text-gray-400'
              }
            >
              Method:
            </span>
            <span
              className={`font-medium capitalize ${
                theme !== 'dark' ? 'text-gray-800' : 'text-gray-300'
              }`}
            >
              {user.method.replace('_', ' ')}
            </span>
          </div>
        )}

        {userRole && (
          <div className='flex items-center justify-between text-xs mt-1'>
            <span
              className={
                theme !== 'dark' ? 'text-gray-600' : 'text-gray-400'
              }
            >
              Role:
            </span>
            <span
              className={`font-medium capitalize ${
                theme !== 'dark' ? 'text-gray-800' : 'text-gray-300'
              }`}
            >
              {userRole === 'driver' ? '🚗 Driver' : '🏢 Employer'}
            </span>
          </div>
        )}
      </div>

      {/* Switch Role Button */}
      {userRole && onSwitchRole && (
        <div className='mt-4'>
          <button
            onClick={(event) => {
              event.stopPropagation()
              onSwitchRole()
            }}
            className={`w-full inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              theme !== 'dark'
                ? 'text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
                : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30'
            }`}
          >
            Switch to {userRole === 'driver' ? 'Employer' : 'Driver'}
          </button>
        </div>
      )}

      {/* Buy USDC Button */}
      {shouldShowBuyUSDC && user?.address && (
        <div
          className={`mt-4 pt-4 border-t ${
            theme !== 'dark' ? 'border-gray-200' : 'border-gray-600'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <BuyUSDCButton walletAddress={user.address} />
        </div>
      )}

      {showAdminTools && (
        <div className='mt-4'>
          <Link
            href='/admin'
            onClick={(event) => event.stopPropagation()}
            className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              theme !== 'dark'
                ? 'text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
                : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30'
            }`}
          >
            Admin Tools
          </Link>
        </div>
      )}

      {/* Hover Tooltip */}
      <div className='absolute left-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
        Click to view full wallet details
      </div>
    </div>
  )
}
