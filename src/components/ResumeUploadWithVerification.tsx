'use client'

import React, { useState } from 'react'
import { useAccount, useSmartAccountClient } from '@account-kit/react'
import { encodeFunctionData } from 'viem'
import { calculateFileHash, validateFile } from '@/lib/hash-utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAssistantBridge } from '@/contexts/AssistantBridgeContext'
import { Paperclip, FileText, X } from 'lucide-react'

interface UploadStep {
  id: string
  name: string
  status: 'pending' | 'loading' | 'success' | 'error'
  data?: any
  error?: string
}

interface ResumeUploadWithVerificationProps {
  user?: any
  onUploadComplete?: (payload: {
    resume: any
    finalResult: {
      ipfsHash: string
      ipfsUrl: string
      databaseId: string
      wasPaid: boolean
      costUSDC: number
      eligibility: any
      blockchainData: any
    }
  }) => void
}

export default function ResumeUploadWithVerification({
  user,
  onUploadComplete,
}: ResumeUploadWithVerificationProps) {
  const { theme } = useTheme()
  const { notifyResumeUploadEvent } = useAssistantBridge()

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
        <h3 className='text-xl sm:text-2xl font-medium text-gray-900 mb-4'>
          📄 Resume Upload
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
      notifyResumeUploadEvent?.({
        type: 'hash_start',
        step: 'hash',
        message: 'Calculating your file hash locally (this is free)...',
      })
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
      notifyResumeUploadEvent?.({
        type: 'hash_complete',
        step: 'hash',
        data: { hash: fileHash.substring(0, 16) + '...', size: file.size },
        message: '✅ File hash calculated! Now uploading to IPFS...',
      })

      // Step 2: Upload & Database Validation (Hash-First Flow)
      updateStep('upload', 'loading')
      notifyResumeUploadEvent?.({
        type: 'upload_start',
        step: 'upload',
        message: '📤 Uploading your resume to IPFS (decentralized storage)...',
      })
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
        
        // Notify T Assistant about the error
        let tMessage = 'Upload failed. '
        if (uploadResponse.status === 429) {
          tMessage = 'You\'ve hit the rate limit (3 uploads/week on free tier). Wait a day or upgrade to premium for unlimited uploads.'
        } else if (uploadResponse.status === 402) {
          tMessage = 'Payment required. This upload costs ~$0.12 (IPFS + blockchain verification).'
        } else if (uploadResponse.status === 409) {
          tMessage = 'This resume is already on file. Want to use the existing one instead?'
        } else {
          tMessage = `Upload failed: ${errorMessage}. Let me know if you need help troubleshooting.`
        }
        
        notifyResumeUploadEvent?.({
          type: 'upload_error',
          step: 'upload',
          error: errorMessage,
          message: tMessage,
        })
        
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
      notifyResumeUploadEvent?.({
        type: 'upload_complete',
        step: 'upload',
        data: {
          resumeId: uploadData.resume.id,
          ipfsHash: uploadData.resume.ipfsHash,
          wasPaid: uploadData.resume.wasPaid,
          costUSDC: uploadData.resume.costUSDC,
        },
        message: '✅ Resume uploaded to IPFS! Now verifying on blockchain...',
      })

      // Step 3: Blockchain Verification (Optional)
      updateStep('blockchain', 'loading')
      notifyResumeUploadEvent?.({
        type: 'blockchain_start',
        step: 'blockchain',
        message: '⛓️ Verifying your resume on the blockchain (almost done!)...',
      })
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
        notifyResumeUploadEvent?.({
          type: 'upload_error',
          step: 'blockchain',
          error: 'Blockchain verification failed',
          message: '⚠️ Blockchain verification failed, but your resume was uploaded successfully. You can verify it later.',
        })
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
        notifyResumeUploadEvent?.({
          type: 'blockchain_complete',
          step: 'blockchain',
          data: {
            transactionHash: blockchainData.transactionHash,
            resumeId: blockchainData.resumeId,
          },
          message: '🎉 All done! Your resume is now verified on the blockchain. Analyzing it now to extract key information...',
        })
      }

      // Set final result
      const resultPayload = {
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
      }

      setFinalResult(resultPayload)
      onUploadComplete?.({
        resume: uploadData.resume,
        finalResult: resultPayload,
      })

      // Trigger analysis after upload completes
      // This will extract data and show insights before prefilling
      if (uploadData.resume.ipfsHash) {
        notifyResumeUploadEvent?.({
          type: 'analysis_ready',
          step: 'analysis',
          data: {
            ipfsHash: uploadData.resume.ipfsHash,
            resumeId: uploadData.resume.id,
          },
          message: '🔍 Analyzing your resume to extract key information...',
        })
      }

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
        notifyResumeUploadEvent?.({
          type: 'upload_error',
          step: currentStep.id,
          error: errorMessage,
          message: `❌ ${errorMessage}. Need help? Ask me anything about the upload process!`,
        })
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
            className={`text-xl sm:text-2xl md:text-3xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Authentication Required
          </h3>
          <p
            className={`text-sm sm:text-base md:text-lg ${
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
      <div className='mb-6'>
        <h3
          className={`text-xl sm:text-2xl md:text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          📄 Resume Upload
        </h3>
      </div>

      {/* File Selection */}
      <div className='mb-6'>
        <label
          className={`block text-sm font-medium mb-3 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Select Resume (PDF only)
        </label>
        
        {/* Custom File Upload Button */}
        <div className='relative'>
          <input
            type='file'
            id='resume-file-input'
            accept='.pdf'
            onChange={handleFileChange}
            className='hidden'
            disabled={uploading}
          />
          
          {!file ? (
            <label
              htmlFor='resume-file-input'
              className={`
                flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl 
                border-2 border-dashed transition-all duration-200 cursor-pointer
                hover:scale-[1.02] active:scale-[0.98]
                ${
                  uploading
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                    ? 'border-brand-mint/50 bg-brand-mint/5 hover:border-brand-mint hover:bg-brand-mint/10 text-white'
                    : 'border-brand-sage/50 bg-brand-sage/5 hover:border-brand-sage hover:bg-brand-sage/10 text-gray-700'
                }
              `}
            >
              <Paperclip
                className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                }`}
              />
              <span className='font-medium text-base'>
                Click to attach PDF resume
              </span>
            </label>
          ) : (
            <div
              className={`
                flex items-center justify-between gap-4 w-full px-6 py-4 rounded-xl
                border-2 transition-all duration-200
                ${
                  theme === 'dark'
                    ? 'border-green-500/50 bg-green-500/10 text-white'
                    : 'border-green-500/50 bg-green-50 text-gray-700'
                }
              `}
            >
              <div className='flex items-center gap-3 flex-1 min-w-0'>
                <FileText
                  className={`w-5 h-5 flex-shrink-0 ${
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  }`}
                />
                <div className='flex-1 min-w-0'>
                  <p className='font-medium text-base truncate'>{file.name}</p>
                  <p
                    className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              {!uploading && (
                <button
                  type='button'
                  onClick={(e) => {
                    e.preventDefault()
                    setFile(null)
                    // Reset file input
                    const input = document.getElementById(
                      'resume-file-input'
                    ) as HTMLInputElement
                    if (input) input.value = ''
                  }}
                  className={`
                    p-2 rounded-lg transition-colors duration-200
                    hover:bg-red-500/20 flex-shrink-0
                    ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}
                  `}
                  aria-label='Remove file'
                >
                  <X className='w-5 h-5' />
                </button>
              )}
            </div>
          )}
        </div>
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
