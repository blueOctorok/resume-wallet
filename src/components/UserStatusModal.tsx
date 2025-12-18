'use client'

import { useState, useEffect } from 'react'
import USDCBalance from './USDCBalance'
import SendUSDC from './wallet/SendUSDC'
import ReceiveUSDC from './wallet/ReceiveUSDC'
import TransactionHistory from './TransactionHistory'
import { useTheme } from '@/contexts/ThemeContext'
import { Wallet, Send, QrCode, History } from 'lucide-react'

interface UserStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onLogout: () => void
  user: {
    email?: string
    address?: string
    chain?: string
  }
  userRole?: 'driver' | 'employer' | null
  onSwitchRole?: () => void
}

type WalletTab = 'overview' | 'send' | 'receive' | 'history'

export default function UserStatusModal({
  isOpen,
  onClose,
  onLogout,
  user,
  userRole,
  onSwitchRole,
}: UserStatusModalProps) {
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState<WalletTab>('overview')
  
  const handleLogout = () => {
    onLogout()
    onClose()
  }

  const handleSwitchRole = () => {
    onSwitchRole?.()
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not the modal
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY
      // Lock body scroll
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      
      return () => {
        // Restore body scroll
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]'
        onClick={handleBackdropClick}
        onTouchMove={(e) => e.preventDefault()}
        onWheel={(e) => e.preventDefault()}
      />

      {/* Modal */}
      <div
        className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90vw] max-w-[340px] sm:max-w-sm md:max-w-md lg:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col'
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className='relative bg-brand-sage-light/20 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-brand-mint/30 flex flex-col h-full'>
          {/* Close Button */}
          <button
            onClick={onClose}
            className='absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 hover:border-brand-mint/70 transition-all duration-300 shadow-lg hover:shadow-xl border border-transparent'
            aria-label='Close modal'
          >
            <svg
              className='w-3 h-3 sm:w-4 sm:h-4 text-brand-cream'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>

          {/* Inner shadow for depth */}
          <div className='absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] pointer-events-none' />

          {/* Outer glow */}
          <div className='absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-mint/20 to-transparent opacity-50 blur-sm -z-10' />

          {/* Header */}
          <div className='p-4 sm:p-6 border-b border-brand-mint/20'>
            <h2 className='text-lg sm:text-xl md:text-2xl font-semibold text-brand-cream text-center'>
              Wallet
            </h2>
          </div>

          {/* Tabs */}
          {user.address && (
            <div className='flex border-b border-brand-mint/20 scrollbar-hide-mobile overflow-x-auto'>
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
                  activeTab === 'overview'
                    ? 'text-brand-mint border-b-2 border-brand-mint bg-brand-sage-light/10'
                    : 'text-brand-cream/70 hover:text-brand-cream hover:bg-brand-sage-light/5'
                }`}
              >
                <Wallet className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                <span>Overview</span>
              </button>
              <button
                onClick={() => setActiveTab('send')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
                  activeTab === 'send'
                    ? 'text-brand-mint border-b-2 border-brand-mint bg-brand-sage-light/10'
                    : 'text-brand-cream/70 hover:text-brand-cream hover:bg-brand-sage-light/5'
                }`}
              >
                <Send className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                <span>Send</span>
              </button>
              <button
                onClick={() => setActiveTab('receive')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
                  activeTab === 'receive'
                    ? 'text-brand-mint border-b-2 border-brand-mint bg-brand-sage-light/10'
                    : 'text-brand-cream/70 hover:text-brand-cream hover:bg-brand-sage-light/5'
                }`}
              >
                <QrCode className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                <span>Receive</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
                  activeTab === 'history'
                    ? 'text-brand-mint border-b-2 border-brand-mint bg-brand-sage-light/10'
                    : 'text-brand-cream/70 hover:text-brand-cream hover:bg-brand-sage-light/5'
                }`}
              >
                <History className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                <span>History</span>
              </button>
            </div>
          )}

          {/* Tab Content */}
          <div 
            className='flex-1 overflow-y-auto p-4 sm:p-6'
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {activeTab === 'overview' && (
              <div className='space-y-4 sm:space-y-6'>

                {/* User Info Card */}
                <div className='bg-brand-sage/30 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 border border-brand-mint/20 shadow-lg'>
                  <div className='space-y-2 sm:space-y-3 md:space-y-4 text-xs sm:text-sm'>
                    {user.email && (
                      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0'>
                        <span className='font-medium text-brand-cream/70 text-xs sm:text-sm'>
                          Email:
                        </span>
                        <span className='text-brand-cream text-xs sm:text-sm break-all sm:break-normal'>
                          {user.email}
                        </span>
                      </div>
                    )}
                    {user.address && (
                      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0'>
                        <span className='font-medium text-brand-cream/70 text-xs sm:text-sm'>
                          Wallet:
                        </span>
                        <span className='text-brand-cream font-mono text-xs'>
                          {user.address.slice(0, 8)}...{user.address.slice(-6)}
                        </span>
                      </div>
                    )}
                    {user.chain && (
                      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0'>
                        <span className='font-medium text-brand-cream/70 text-xs sm:text-sm'>
                          Network:
                        </span>
                        <span className='text-brand-cream text-xs sm:text-sm'>
                          {user.chain}
                        </span>
                      </div>
                    )}
                    {userRole && (
                      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0'>
                        <span className='font-medium text-brand-cream/70 text-xs sm:text-sm'>
                          Role:
                        </span>
                        <span className='text-brand-cream text-xs sm:text-sm'>
                          {userRole === 'driver' ? '🚗 Driver' : '🏢 Employer'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* USDC Balance Display */}
                {user.address && (
                  <div>
                    <USDCBalance 
                      walletAddress={user.address}
                      refreshInterval={60000} // Auto-refresh every 60 seconds
                    />
                  </div>
                )}

                {/* Switch Role Button */}
                {userRole && onSwitchRole && (
                  <button
                    onClick={handleSwitchRole}
                    className='w-full px-4 sm:px-6 py-3 sm:py-4 text-brand-cream font-semibold bg-brand-sage/60 backdrop-blur-sm border border-brand-mint/30 rounded-lg sm:rounded-xl hover:bg-brand-sage/80 hover:border-brand-mint/50 transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base'
                  >
                    Switch to {userRole === 'driver' ? 'Employer' : 'Driver'}
                  </button>
                )}

                {/* Clear Role Button (for testing) */}
                {userRole && user?.address && (
                  <button
                    onClick={async () => {
                      if (confirm('Clear your role? This will show the role selection modal again. (For testing)')) {
                        try {
                          const response = await fetch('/api/user/set-role', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              role: null,
                              walletAddress: user.address 
                            }),
                          })
                          if (response.ok) {
                            // Reload page to trigger role fetch and show modal
                            window.location.reload()
                          } else {
                            const errorData = await response.json().catch(() => ({}))
                            alert(`Failed to clear role: ${errorData.error || 'Unknown error'}`)
                          }
                        } catch (error) {
                          console.error('Error clearing role:', error)
                          alert('Error clearing role')
                        }
                      }
                    }}
                    className='w-full px-4 sm:px-6 py-3 sm:py-4 text-yellow-200 font-semibold bg-yellow-600/20 backdrop-blur-sm border border-yellow-500/30 rounded-lg sm:rounded-xl hover:bg-yellow-600/30 hover:border-yellow-500/50 transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base'
                  >
                    🧪 Clear Role (Test)
                  </button>
                )}

                {/* Sign Out Button */}
                <button
                  onClick={handleLogout}
                  className='w-full px-4 sm:px-6 py-3 sm:py-4 text-brand-sage font-semibold bg-brand-mint rounded-lg sm:rounded-xl hover:bg-brand-mint/80 transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base'
                >
                  Sign Out
                </button>
              </div>
            )}

            {activeTab === 'send' && user.address && (
              <div className='space-y-4'>
                {/* Simple token list / selector */}
                <div
                  className={`p-3 rounded-lg border text-xs sm:text-sm ${
                    theme === 'dark'
                      ? 'bg-brand-sage-light/10 border-brand-mint/30'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <p
                    className={`mb-2 font-medium ${
                      theme === 'dark' ? 'text-brand-cream' : 'text-gray-800'
                    }`}
                  >
                    Choose asset to send
                  </p>

                  <div className='space-y-2'>
                    {/* Base Sepolia USDC – currently supported */}
                    <div
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs sm:text-sm ${
                        theme === 'dark'
                          ? 'bg-blue-900/30 border-blue-500/40'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div>
                        <div
                          className={`font-semibold ${
                            theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'
                          }`}
                        >
                          USDC
                          <span className='ml-1 text-[11px] opacity-80'>
                            • Base Sepolia (test)
                          </span>
                        </div>
                        <div
                          className={`text-[11px] ${
                            theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
                          }`}
                        >
                          Current send flow uses this asset for testing.
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                          theme === 'dark'
                            ? 'bg-blue-500/30 text-blue-100 border border-blue-400/50'
                            : 'bg-blue-100 text-blue-700 border border-blue-300'
                        }`}
                      >
                        Active
                      </span>
                    </div>

                    {/* Base Mainnet USDC – view-only for now */}
                    <div
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs sm:text-sm opacity-70 ${
                        theme === 'dark'
                          ? 'bg-gray-900/40 border-gray-700'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div>
                        <div
                          className={`font-semibold ${
                            theme === 'dark' ? 'text-brand-cream/80' : 'text-gray-800'
                          }`}
                        >
                          USDC
                          <span className='ml-1 text-[11px] opacity-80'>
                            • Base Mainnet
                          </span>
                        </div>
                        <div
                          className={`text-[11px] ${
                            theme === 'dark' ? 'text-brand-cream/60' : 'text-gray-500'
                          }`}
                        >
                          View-only for now. Sending from Veree will use this in production.
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                          theme === 'dark'
                            ? 'bg-gray-800 text-gray-400 border border-gray-700'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        Coming soon
                      </span>
                    </div>
                  </div>
                </div>

                {/* Current send flow: Base Sepolia USDC */}
                <SendUSDC
                  walletAddress={user.address}
                  onSuccess={() => {
                    // Refresh balance after successful send
                    setTimeout(() => window.location.reload(), 2000)
                  }}
                />
              </div>
            )}

            {activeTab === 'receive' && user.address && (
              <div>
                <ReceiveUSDC walletAddress={user.address} />
              </div>
            )}

            {activeTab === 'history' && user.address && (
              <div>
                <TransactionHistory 
                  walletAddress={user.address}
                  maxTransactions={50}
                  showFilters={true}
                  autoRefresh={true}
                  refreshInterval={30000}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
