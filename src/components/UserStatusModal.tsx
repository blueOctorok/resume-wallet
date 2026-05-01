'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import USDCBalance from './USDCBalance'
import STORMBalance from './STORMBalance'
import SendUSDC from './wallet/SendUSDC'
import SendSTORM from './wallet/SendSTORM'
import ReceiveUSDC from './wallet/ReceiveUSDC'
import TransactionHistory from './TransactionHistory'
import StormEarningsHistory from './StormEarningsHistory'
import BuyUSDCButton from './BuyUSDCButton'
import StormTokenMark from '@/components/ui/StormTokenMark'
import { useTheme } from '@/contexts/ThemeContext'
import type { UserRole } from '@/stores/types'
import {
  Wallet,
  Send,
  QrCode,
  History,
  X,
  Copy,
  Check,
  ExternalLink,
  User,
  Coins,
} from 'lucide-react'

interface UserStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onLogout: () => void
  user: {
    email?: string
    address?: string
    chain?: string
  }
  userRole?: UserRole
}

type WalletTab = 'overview' | 'send' | 'receive' | 'earnings' | 'history'
type SendToken = 'usdc' | 'storm'

export default function UserStatusModal({
  isOpen,
  onClose,
  onLogout,
  user,
  userRole,
}: UserStatusModalProps) {
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState<WalletTab>('overview')
  const [sendToken, setSendToken] = useState<SendToken>('usdc')
  const [copied, setCopied] = useState(false)

  const handleLogout = () => {
    onLogout()
    onClose()
  }

  const copyAddress = async () => {
    if (!user.address) return
    try {
      await navigator.clipboard.writeText(user.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (!isOpen) return null

  // Consistent card styling (matches hub)
  const cardClass = `rounded-2xl border transition-all duration-200 ${
    isDarkTheme(theme)
      ? 'bg-gray-800/50 border-gray-700'
      : 'bg-white/70 border-gray-200'
  }`

  const tabClass = (isActive: boolean) =>
    `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 justify-center rounded-t-lg ${
      isActive
        ? isDarkTheme(theme)
          ? 'text-indigo-400 bg-gray-800/50 border-b-2 border-indigo-400'
          : 'text-indigo-600 bg-white/70 border-b-2 border-indigo-600'
        : isDarkTheme(theme)
          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
    }`

  const buttonPrimary = `w-full px-4 py-3 font-semibold rounded-xl transition-all duration-200 ${
    isDarkTheme(theme)
      ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
  }`

  const buttonSecondary = `w-full px-4 py-3 font-semibold rounded-xl border transition-all duration-200 ${
    isDarkTheme(theme)
      ? 'bg-gray-800/50 border-gray-600 text-gray-200 hover:border-indigo-500/50 hover:text-indigo-400'
      : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-600'
  }`

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndex={100}>
      <div
        className={`flex flex-col max-h-[90vh] overflow-hidden ${
          isDarkTheme(theme)
            ? 'bg-gray-900'
            : 'bg-gray-50'
        }`}
      >
          {/* Header */}
          <div
            className={`flex items-center justify-between p-4 sm:p-5 border-b ${
              isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <div className='flex items-center gap-3'>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDarkTheme(theme)
                    ? 'bg-indigo-500/20 border border-indigo-500/30'
                    : 'bg-indigo-50 border border-indigo-200'
                }`}
              >
                <Wallet
                  className={`w-5 h-5 ${
                    isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                  }`}
                />
              </div>
              <div>
                <h2
                  className={`text-lg font-semibold ${
                    isDarkTheme(theme) ? 'text-gray-100' : 'text-gray-900'
                  }`}
                >
                  Wallet
                </h2>
                <p
                  className={`text-xs ${
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Base Network
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkTheme(theme)
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
              }`}
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          {/* Tabs */}
          {user.address && (
            <div
              className={`flex overflow-x-auto scrollbar-hide border-b ${
                isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'
              }`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <button
                onClick={() => setActiveTab('overview')}
                className={tabClass(activeTab === 'overview')}
              >
                <Wallet className='w-4 h-4' />
                <span>Overview</span>
              </button>
              <button
                onClick={() => setActiveTab('send')}
                className={tabClass(activeTab === 'send')}
              >
                <Send className='w-4 h-4' />
                <span>Send</span>
              </button>
              <button
                onClick={() => setActiveTab('receive')}
                className={tabClass(activeTab === 'receive')}
              >
                <QrCode className='w-4 h-4' />
                <span>Receive</span>
              </button>
              <button
                onClick={() => setActiveTab('earnings')}
                className={tabClass(activeTab === 'earnings')}
              >
                <Coins className='w-4 h-4' />
                <span>Earn</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={tabClass(activeTab === 'history')}
              >
                <History className='w-4 h-4' />
                <span>History</span>
              </button>
            </div>
          )}

          {/* Content */}
          <div className='flex-1 overflow-y-auto p-4 sm:p-5 space-y-4'>
            {activeTab === 'overview' && (
              <>
                {/* Account Card */}
                <div className={`${cardClass} p-4`}>
                  <div className='flex items-center gap-3 mb-4'>
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isDarkTheme(theme)
                          ? 'bg-indigo-500/20'
                          : 'bg-indigo-50'
                      }`}
                    >
                      <User
                        className={`w-6 h-6 ${
                          isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                        }`}
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      {user.email && (
                        <p
                          className={`text-sm truncate ${
                            isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'
                          }`}
                        >
                          {user.email}
                        </p>
                      )}
                      {userRole && (
                        <p
                          className={`text-xs ${
                            isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                          }`}
                        >
                          {userRole === 'driver'
                            ? '🚗 Driver'
                            : userRole === 'developer'
                              ? '💻 Developer'
                              : userRole === 'candidate'
                                ? '🧩 Candidate'
                                : userRole === 'employer'
                                  ? '🏢 Employer'
                                  : userRole}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Wallet Address */}
                  {user.address && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-xl ${
                        isDarkTheme(theme) ? 'bg-gray-900/50' : 'bg-gray-100'
                      }`}
                    >
                      <code
                        className={`flex-1 text-xs font-mono truncate ${
                          isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        {user.address}
                      </code>
                      <button
                        onClick={copyAddress}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDarkTheme(theme)
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-500'
                        }`}
                      >
                        {copied ? (
                          <Check className='w-4 h-4 text-green-500' />
                        ) : (
                          <Copy className='w-4 h-4' />
                        )}
                      </button>
                      <a
                        href={`https://sepolia.basescan.org/address/${user.address}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDarkTheme(theme)
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-500'
                        }`}
                      >
                        <ExternalLink className='w-4 h-4' />
                      </a>
                    </div>
                  )}
                </div>

                {/* Token Balances */}
                {user.address && (
                  <div className='space-y-3'>
                    <h3
                      className={`text-sm font-medium ${
                        isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Token Balances
                    </h3>

                    {/* USDC Balance */}
                    <USDCBalance
                      walletAddress={user.address}
                      refreshInterval={60000}
                    />

                    {/* STORM Balance */}
                    <STORMBalance
                      walletAddress={user.address}
                      refreshInterval={60000}
                    />

                    {/* STORM Earnings Summary */}
                    <div className={`${cardClass} p-4`}>
                      <StormEarningsHistory
                        walletAddress={user.address}
                        compact={true}
                      />
                    </div>
                  </div>
                )}

                {/* Buy USDC */}
                {user.address && (
                  <div className={`${cardClass} p-4`}>
                    <BuyUSDCButton walletAddress={user.address} />
                  </div>
                )}

                {/* Action Buttons */}
                <div className='space-y-3 pt-2'>
                  <button onClick={handleLogout} className={buttonPrimary}>
                    Sign Out
                  </button>
                </div>
              </>
            )}

            {activeTab === 'send' && user.address && (
              <div className='space-y-4'>
                {/* Token Selector */}
                <div className={`${cardClass} p-4`}>
                  <p
                    className={`text-sm font-medium mb-3 ${
                      isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Select token to send
                  </p>
                  <div className='grid grid-cols-2 gap-3'>
                    {/* USDC Option */}
                    <button
                      onClick={() => setSendToken('usdc')}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        sendToken === 'usdc'
                          ? isDarkTheme(theme)
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-blue-500 bg-blue-50'
                          : isDarkTheme(theme)
                            ? 'border-gray-700 hover:border-gray-600'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className='flex items-center gap-2'>
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isDarkTheme(theme) ? 'bg-blue-500/20' : 'bg-blue-100'
                          }`}
                        >
                          <span className='text-lg'>💵</span>
                        </div>
                        <div className='text-left'>
                          <p
                            className={`text-sm font-semibold ${
                              isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'
                            }`}
                          >
                            USDC
                          </p>
                          <p
                            className={`text-xs ${
                              isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'
                            }`}
                          >
                            Sepolia
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* STORM Option */}
                    <button
                      onClick={() => setSendToken('storm')}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        sendToken === 'storm'
                          ? isDarkTheme(theme)
                            ? 'border-yellow-500 bg-yellow-500/10'
                            : 'border-yellow-500 bg-yellow-50'
                          : isDarkTheme(theme)
                            ? 'border-gray-700 hover:border-gray-600'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className='flex items-center gap-2'>
                        <StormTokenMark size='sm' />
                        <div className='text-left'>
                          <p
                            className={`text-sm font-semibold ${
                              isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'
                            }`}
                          >
                            STORM
                          </p>
                          <p
                            className={`text-xs ${
                              isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'
                            }`}
                          >
                            Sepolia
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Send Form */}
                {sendToken === 'usdc' ? (
                  <SendUSDC
                    walletAddress={user.address}
                    onSuccess={() => {
                      setTimeout(() => window.location.reload(), 2000)
                    }}
                  />
                ) : (
                  <SendSTORM
                    walletAddress={user.address}
                    onSuccess={() => {
                      setTimeout(() => window.location.reload(), 2000)
                    }}
                  />
                )}
              </div>
            )}

            {activeTab === 'receive' && user.address && (
              <ReceiveUSDC walletAddress={user.address} />
            )}

            {activeTab === 'earnings' && user.address && (
              <StormEarningsHistory walletAddress={user.address} />
            )}

            {activeTab === 'history' && user.address && (
              <TransactionHistory
                walletAddress={user.address}
                maxTransactions={50}
                showFilters={true}
                autoRefresh={true}
                refreshInterval={30000}
              />
            )}
          </div>
      </div>
    </Modal>
  )
}
