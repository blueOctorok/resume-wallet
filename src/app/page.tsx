'use client'

import ResumeUpload from '@/components/ResumeUpload'
import { useState } from 'react'
import { SimpleBaseAuth } from '@/components/SimpleBaseAuth'
import { DriverApplication } from '@/components/DriverApplication'
import { WalletTransactions } from '@/components/WalletTransactions'
import { RpcProviderTest } from '@/components/RpcProviderTest'
import { NetworkDiscovery } from '@/components/NetworkDiscovery'
import { DeploymentTest } from '@/components/DeploymentTest'
import AlchemyTest from '@/components/AlchemyTest'
import TokenAPITest from '@/components/TokenAPITest'
import USDCBalance from '@/components/USDCBalance'
import TransactionHistory from '@/components/TransactionHistory'
import TransfersAPITest from '@/components/TransfersAPITest'
import RawTransfersAPITest from '@/components/RawTransfersAPITest'
import SimulationAPITest from '@/components/SimulationAPITest'
import WebhookTest from '@/components/WebhookTest'

const Home = () => {
  const [user, setUser] = useState<any>(null)

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <header className='bg-white shadow-sm border-b border-gray-200'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-6'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>
                DriverAppChain
              </h1>
              <p className='text-gray-600'>
                AI-powered, blockchain-verified employment platform
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Left Sidebar - Stats & Quick Actions */}
          <div className='lg:col-span-1 space-y-6'>
            {/* Simple Base Authentication */}
            <SimpleBaseAuth
              onAuthSuccess={(userData) => {
                console.log('Authentication successful:', userData)
                setUser(userData)
              }}
              onAuthError={(error) => {
                console.error('Authentication failed:', error)
                setUser(null)
              }}
            />

            <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>
                Quick Stats
              </h3>
              <div className='space-y-3'>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Resumes Uploaded</span>
                  <span className='font-medium text-gray-900'>0</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Blockchain Verified</span>
                  <span className='font-medium text-gray-900'>0</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Public Resumes</span>
                  <span className='font-medium text-gray-900'>0</span>
                </div>
              </div>
            </div>

            <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>
                Quick Actions
              </h3>
              <div className='space-y-3'>
                <button className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md'>
                  View My Resumes
                </button>
                <button className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md'>
                  Update Profile
                </button>
                <button className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md'>
                  Browse Jobs
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className='lg:col-span-2'>
            <div className='mb-6'>
              <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                Welcome to DriverAppChain
              </h2>
              <p className='text-gray-600'>
                Upload your resume to get started with AI-powered job matching
                and blockchain verification.
              </p>
            </div>

            <ResumeUpload user={user} />

            {/* Driver Application */}
            <div className='mt-8'>
              <DriverApplication user={user} />
            </div>

            {/* Wallet Transaction Tests */}
            <div className='mt-8'>
              <WalletTransactions walletAddress={user?.address || ''} />
            </div>

            {/* Alchemy Infrastructure Test */}
            <div className='mt-8'>
              <AlchemyTest />
            </div>

            {/* USDC Balance Display */}
            {user?.address && (
              <div className='mt-8'>
                <div className='mb-4'>
                  <h2 className='text-xl font-bold'>💰 USDC Balance</h2>
                </div>
                <USDCBalance
                  walletAddress={user.address}
                  showSufficiencyCheck={true}
                  requiredAmount='1.00'
                />
              </div>
            )}

            {/* Token API Test */}
            <div className='mt-8'>
              <TokenAPITest walletAddress={user?.address} />
            </div>

            {/* Transaction History */}
            {user?.address && (
              <div className='mt-8'>
                <div className='mb-4'>
                  <h2 className='text-xl font-bold'>📊 Transaction History</h2>
                </div>
                <TransactionHistory
                  walletAddress={user.address}
                  maxTransactions={20}
                  showFilters={true}
                  autoRefresh={false}
                />
              </div>
            )}

            {/* Transfers API Test */}
            <div className='mt-8'>
              <TransfersAPITest walletAddress={user?.address} />
            </div>

            {/* Raw Transfers API Test */}
            <div className='mt-8'>
              <RawTransfersAPITest walletAddress={user?.address} />
            </div>

            {/* Simulation API Test */}
            <div className='mt-8'>
              <div className='mb-4'>
                <h2 className='text-xl font-bold'>🧪 Transaction Simulation</h2>
                <p className='text-gray-600'>
                  Preview transaction costs and asset changes before sending
                </p>
              </div>
              <SimulationAPITest />
            </div>

            {/* Webhook Test */}
            <div className='mt-8'>
              <div className='mb-4'>
                <h2 className='text-xl font-bold'>🔗 Real-Time Webhooks</h2>
                <p className='text-gray-600'>
                  Set up real-time notifications for transaction completion
                </p>
              </div>
              <WebhookTest />
            </div>

            {/* RPC Provider Tests */}
            <div className='mt-8'>
              <RpcProviderTest walletAddress={user?.address || ''} />
            </div>

            {/* Network Discovery Tests */}
            <div className='mt-8'>
              <NetworkDiscovery walletAddress={user?.address || ''} />
            </div>

            {/* Driver Experience Test */}
            <div className='mt-8'>
              <DeploymentTest
                contractAddress={process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Home
