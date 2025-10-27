'use client'

import React, { useState } from 'react'
import { useAccount, useSmartAccountClient } from '@account-kit/react'
import { encodeFunctionData } from 'viem'
import { calculateFileHash, validateFile } from '@/lib/hash-utils'
import { useTheme } from '@/contexts/ThemeContext'

interface UploadStep {
  id: string
  name: string
  status: 'pending' | 'loading' | 'success' | 'error'
  data?: any
  error?: string
}

interface ResumeUploadWithVerificationProps {
  user?: any
}

export default function ResumeUploadWithVerification({
  user,
}: ResumeUploadWithVerificationProps) {
  const { theme } = useTheme()

  // Add error boundary for Alchemy hooks
  let account: any = null
  let hookError = false

  try {
    account = useAccount({ type: 'LightAccount' })
  } catch (error) {
    console.error('❌ Alchemy hook error:', error)
    hookError = true
  }

  // Get smart account client
  const { client: smartAccountClient } = useSmartAccountClient({
    type: 'LightAccount',
  })

  // If hooks fail, show error message
  if (hookError) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>
          📄 Resume Upload with Full Verification
        </h3>
        <div className='bg-red-50 p-4 rounded-lg border border-red-200'>
          <p className='text-red-800'>
            ❌ Alchemy Smart Wallet not available. Please make sure you're
            connected to your wallet.
          </p>
        </div>
      </div>
    )
  }
  const [file, setFile] = useState<File | null>(null)
  const [steps, setSteps] = useState<UploadStep[]>([
    {
      id: 'hash',
      name: '🔢 Calculate File Hash (FREE)',
      status: 'pending',
    },
    {
      id: 'upload',
      name: '📁 Upload & Database Validation',
      status: 'pending',
    },
    {
      id: 'blockchain',
      name: '⛓️ Blockchain Verification (Optional)',
      status: 'pending',
    },
  ])
  const [uploading, setUploading] = useState(false)
  const [finalResult, setFinalResult] = useState<any>(null)

  const updateStep = (
    stepId: string,
    status: UploadStep['status'],
    data?: any,
    error?: string
  ) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status, data, error } : step
      )
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      // Reset steps
      setSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status: 'pending',
          data: undefined,
          error: undefined,
        }))
      )
      setFinalResult(null)
    } else {
      alert('Please select a PDF file')
    }
  }

  const uploadResume = async () => {
    if (!file || !account?.address) {
      alert('Please select a file and connect your wallet')
      return
    }

    setUploading(true)

    try {
      // Step 1: Calculate File Hash Locally (FREE)
      updateStep('hash', 'loading')
      console.log('🔄 Step 1: Calculating file hash locally...')

      // Validate file first
      const validation = validateFile(file)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // Calculate SHA-256 hash locally
      const fileHash = await calculateFileHash(file)
      console.log(
        '✅ Step 1 Complete: File hash calculated:',
        fileHash.substring(0, 16) + '...'
      )

      updateStep('hash', 'success', {
        hash: fileHash.substring(0, 16) + '...',
        algorithm: 'SHA-256',
        size: file.size,
        timestamp: new Date().toISOString(),
      })

      // Step 2: Upload & Database Validation (Hash-First Flow)
      updateStep('upload', 'loading')
      console.log('🔄 Step 2: Uploading file with hash-first validation...')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace('.pdf', ''))
      formData.append('fileHash', fileHash)

      const uploadResponse = await fetch('/api/resumes/upload', {
        method: 'POST',
        headers: {
          'x-wallet-address': account.address,
        },
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()

        // Handle specific error cases gracefully
        let errorMessage = 'Upload failed'

        if (uploadResponse.status === 429) {
          errorMessage = errorData.message || 'Rate limit exceeded'
        } else if (uploadResponse.status === 402) {
          errorMessage = errorData.message || 'Payment required'
        } else if (uploadResponse.status === 409) {
          errorMessage = errorData.message || 'Duplicate file detected'
        } else {
          errorMessage =
            errorData.message || `Upload failed: ${uploadResponse.statusText}`
        }

        // Show error in UI instead of throwing
        console.log('🚨 Upload error (showing in UI):', errorMessage)
        updateStep('upload', 'error', undefined, errorMessage)
        setUploading(false)
        return // Exit gracefully instead of throwing
      }

      const uploadData = await uploadResponse.json()
      console.log('✅ Step 2 Complete: Upload successful:', uploadData)

      updateStep('upload', 'success', {
        resumeId: uploadData.resume.id,
        ipfsHash: uploadData.resume.ipfsHash,
        ipfsUrl: uploadData.resume.ipfsUrl,
        wasPaid: uploadData.resume.wasPaid,
        costUSDC: uploadData.resume.costUSDC,
        eligibility: uploadData.eligibility,
      })

      // Step 3: Blockchain Verification (Optional)
      updateStep('blockchain', 'loading')
      console.log('🔄 Step 3: Blockchain verification...')

      const blockchainResponse = await fetch('/api/blockchain/verify-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeId: uploadData.resume.id,
          ...uploadData.blockchainData,
        }),
      })

      if (!blockchainResponse.ok) {
        console.warn('⚠️ Blockchain verification failed, but upload succeeded')
        updateStep(
          'blockchain',
          'error',
          undefined,
          'Blockchain verification failed, but your resume was uploaded successfully'
        )
      } else {
        const blockchainData = await blockchainResponse.json()
        console.log(
          '✅ Step 3 Complete: Blockchain verification:',
          blockchainData
        )

        updateStep('blockchain', 'success', {
          transactionHash: blockchainData.transactionHash,
          resumeId: blockchainData.resumeId,
          contractAddress: blockchainData.contractAddress,
          explorerUrl: blockchainData.explorerUrl,
        })
      }

      // Set final result
      setFinalResult({
        ipfsHash: uploadData.resume.ipfsHash,
        ipfsUrl: uploadData.resume.ipfsUrl,
        databaseId: uploadData.resume.id,
        wasPaid: uploadData.resume.wasPaid,
        costUSDC: uploadData.resume.costUSDC,
        eligibility: uploadData.eligibility,
        // Blockchain data if available
        blockchainData:
          steps.find((s) => s.id === 'blockchain')?.status === 'success'
            ? steps.find((s) => s.id === 'blockchain')?.data
            : null,
      })

      console.log('🎉 Upload completed successfully!')
    } catch (error) {
      console.error('❌ Upload failed:', error)
      const currentStep = steps.find((step) => step.status === 'loading')

      let errorMessage = 'Upload failed'
      if (error instanceof Error) {
        errorMessage = error.message
      }

      if (currentStep) {
        updateStep(currentStep.id, 'error', undefined, errorMessage)
      }
    } finally {
      setUploading(false)
    }
  }

  const getStatusIcon = (status: UploadStep['status']) => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'loading':
        return '🔄'
      case 'success':
        return '✅'
      case 'error':
        return '❌'
    }
  }

  const getStatusColor = (status: UploadStep['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500'
      case 'loading':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
    }
  }

  // Authentication guard
  if (!user?.address) {
    return (
      <div
        className={`max-w-4xl mx-auto p-6 ${
          theme === 'dark'
            ? 'bg-brand-sage-light/20 backdrop-blur-xl'
            : 'bg-white/80 backdrop-blur-xl'
        } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
          theme === 'dark' ? 'border-brand-mint' : 'border-brand-sage'
        }`}
      >
        <div className='text-center py-8'>
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}
          >
            <svg
              className={`w-8 h-8 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
              />
            </svg>
          </div>
          <h3
            className={`text-3xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Authentication Required
          </h3>
          <p
            className={`text-lg ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            Please sign in to upload and verify your resume.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`max-w-4xl mx-auto p-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 backdrop-blur-xl'
          : 'bg-white/80 backdrop-blur-xl'
      } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
        theme === 'dark' ? 'border-brand-mint' : 'border-brand-sage'
      }`}
    >
      <h3
        className={`text-3xl font-bold mb-6 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        📄 Resume Upload with Full Verification
      </h3>

      {/* File Selection */}
      <div className='mb-6'>
        <label
          className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Select Resume (PDF only)
        </label>
        <input
          type='file'
          accept='.pdf'
          onChange={handleFileChange}
          className={`w-full px-4 py-3 rounded-lg ${
            theme === 'dark'
              ? 'bg-brand-cream border-gray-300 text-gray-900'
              : 'bg-white border-gray-300 text-gray-900'
          } border focus:outline-none focus:ring-2 focus:ring-brand-mint`}
          disabled={uploading}
        />
        {file && (
          <p
            className={`text-sm mt-1 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>

      {/* Upload Button */}
      <button
        onClick={uploadResume}
        disabled={!file || !account?.address || uploading}
        className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed mb-6 ${
          theme === 'dark'
            ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
            : 'bg-brand-sage text-white hover:bg-brand-sage/90'
        }`}
      >
        {uploading ? 'Uploading...' : 'Upload Resume (Hash-First Process)'}
      </button>

      {/* Progress Steps */}
      <div className='space-y-4 mb-6'>
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`rounded-lg p-4 border-2 ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className='flex items-center justify-between mb-2'>
              <div className='flex items-center space-x-2'>
                <span className='text-lg'>{getStatusIcon(step.status)}</span>
                <span
                  className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  } ${getStatusColor(step.status)}`}
                >
                  Step {index + 1}: {step.name}
                </span>
              </div>
              <span
                className={`text-sm font-semibold ${getStatusColor(
                  step.status
                )}`}
              >
                {step.status.toUpperCase()}
              </span>
            </div>

            {/* Step Details */}
            {step.data && (
              <div
                className={`p-3 rounded text-sm ${
                  theme === 'dark'
                    ? 'bg-gray-900 text-gray-300'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <pre className='whitespace-pre-wrap text-xs'>
                  {JSON.stringify(step.data, null, 2)}
                </pre>
              </div>
            )}

            {step.error && (
              <div
                className={`p-3 rounded text-sm ${
                  theme === 'dark'
                    ? 'bg-red-900/20 text-red-400'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                Error: {step.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cost Breakdown */}
      <div
        className={`mt-4 p-4 rounded-lg border-2 mb-6 ${
          theme === 'dark'
            ? 'bg-blue-900/20 border-blue-500/50'
            : 'bg-blue-50 border-blue-200'
        }`}
      >
        <h4
          className={`font-medium mb-2 ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-800'
          }`}
        >
          💰 Cost Breakdown (Hash-First Flow)
        </h4>
        <div
          className={`text-sm space-y-1 ${
            theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
          }`}
        >
          <div>
            🔢 File hash calculation:{' '}
            <span className='font-semibold text-green-600'>FREE</span>
          </div>
          <div>
            🔍 Database validation:{' '}
            <span className='font-semibold text-green-600'>FREE</span>
          </div>
          <div>
            📁 IPFS upload:{' '}
            <span className='font-semibold text-yellow-600'>~$0.10</span>
          </div>
          <div>
            💾 Database save:{' '}
            <span className='font-semibold text-yellow-600'>~$0.001</span>
          </div>
          <div>
            ⛓️ Blockchain verification:{' '}
            <span className='font-semibold text-yellow-600'>~$0.02</span>
          </div>
          <div className='border-t pt-1 mt-2'>
            <strong>Total for legitimate upload: ~$0.121</strong>
          </div>
          <div className='text-xs text-blue-600'>
            💡 Spam attempts cost $0 (stopped before IPFS)
          </div>
        </div>
      </div>

      {/* Final Result */}
      {finalResult && (
        <div
          className={`mt-6 p-4 rounded-lg border-2 mb-6 ${
            theme === 'dark'
              ? 'bg-green-900/20 border-green-500/50'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <h4
            className={`font-medium mb-3 ${
              theme === 'dark' ? 'text-green-400' : 'text-green-800'
            }`}
          >
            🎉 Upload Complete!
          </h4>
          <div
            className={`space-y-2 text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            <div>
              <strong>IPFS:</strong>{' '}
              <a
                href={finalResult.ipfsUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-600 hover:underline'
              >
                View on IPFS
              </a>
            </div>
            <div>
              <strong>Database ID:</strong> {finalResult.databaseId}
            </div>
            <div>
              <strong>Payment:</strong>{' '}
              {finalResult.wasPaid ? `$${finalResult.costUSDC} USDC` : 'Free'}
            </div>
            <div>
              <strong>Uploads This Week:</strong>{' '}
              {finalResult.eligibility?.uploadsThisWeek || 0}
            </div>
            {finalResult.blockchainData && (
              <>
                <div>
                  <strong>Blockchain Resume ID:</strong>{' '}
                  {finalResult.blockchainData.resumeId}
                </div>
                <div>
                  <strong>Transaction:</strong>{' '}
                  <a
                    href={finalResult.blockchainData.explorerUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-blue-600 hover:underline'
                  >
                    View on BaseScan
                  </a>
                </div>
                <div>
                  <strong>Contract:</strong>{' '}
                  <a
                    href={`https://sepolia.basescan.org/address/${finalResult.blockchainData.contractAddress}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-blue-600 hover:underline'
                  >
                    View Contract
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Wallet Status */}
      <div
        className={`mt-4 text-sm ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
        }`}
      >
        {account?.address ? (
          <p>
            ✅ Wallet connected: {account.address.slice(0, 6)}...
            {account.address.slice(-4)}
          </p>
        ) : (
          <p>❌ Please connect your Alchemy Smart Wallet first</p>
        )}
      </div>
    </div>
  )
}
