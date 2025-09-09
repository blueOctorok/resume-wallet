import ResumeUpload from '@/components/ResumeUpload'
import { BaseWalletConnect } from '@/components/BaseWalletConnect'
import { BaseAccountAuth } from '@/components/BaseAccountAuth'
import { WalletTransactions } from '@/components/WalletTransactions'
import { RpcProviderTest } from '@/components/RpcProviderTest'
import { NetworkDiscovery } from '@/components/NetworkDiscovery'
import { DeploymentTest } from '@/components/DeploymentTest'

const Home = () => {
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
            {/* Base Account Authentication */}
            <BaseAccountAuth />

            {/* Base Wallet Connection */}
            <BaseWalletConnect />

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

            <ResumeUpload />

            {/* Wallet Transaction Tests */}
            <div className='mt-8'>
              <WalletTransactions walletAddress='' />
            </div>

            {/* RPC Provider Tests */}
            <div className='mt-8'>
              <RpcProviderTest walletAddress='' />
            </div>

            {/* Network Discovery Tests */}
            <div className='mt-8'>
              <NetworkDiscovery walletAddress='' />
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
