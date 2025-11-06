'use client'

import { useState } from 'react'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Brain,
} from 'lucide-react'
import { uploadToIPFS } from '@/lib/ipfs'
import { useTheme } from '@/contexts/ThemeContext'

interface ResumeUploadWithPrefillProps {
  onPrefillSuccess?: (formData: {
    form1Data: any
    form2Data: any
    form3Data: any
    stats: any
  }) => void
  onPrefillError?: (error: string) => void
}

export default function ResumeUploadWithPrefill({
  onPrefillSuccess,
  onPrefillError,
}: ResumeUploadWithPrefillProps) {
  const { theme } = useTheme()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'extracting' | 'success' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [ipfsHash, setIpfsHash] = useState('')
  const [extractedStats, setExtractedStats] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      if (
        !selectedFile.type.includes('pdf') &&
        !selectedFile.type.includes('doc') &&
        !selectedFile.type.includes('docx') &&
        !selectedFile.type.includes('text')
      ) {
        setErrorMessage('Please select a PDF, DOC, DOCX, or TXT file')
        setFile(null)
        return
      }

      // Validate file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setErrorMessage('File size must be less than 10MB')
        setFile(null)
        return
      }

      setFile(selectedFile)
      setErrorMessage('')
      setUploadStatus('idle')
      setExtractedStats(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setErrorMessage('Please select a file')
      return
    }

    setIsUploading(true)
    setUploadStatus('uploading')
    setErrorMessage('')

    try {
      // Step 1: Upload to IPFS
      console.log('📤 [PREFILL] Step 1: Uploading to IPFS...')
      const result = await uploadToIPFS(file)
      setIpfsHash(result.ipfsHash)

      console.log('✅ [PREFILL] IPFS upload successful:', result.ipfsHash)
      console.log('   Gateway URL:', result.url)

      // Step 2: Call AI prefill API
      setUploadStatus('extracting')
      console.log('🤖 [PREFILL] Step 2: Extracting data with AI...')
      const startTime = Date.now()

      // Try CID first (T Backend can fetch from IPFS directly)
      // Fallback to public gateway URL if needed
      const publicGatewayUrl = `https://ipfs.io/ipfs/${result.ipfsHash}`
      console.log('   Using CID:', result.ipfsHash)
      console.log('   Gateway URL (fallback):', publicGatewayUrl)

      const prefillResponse = await fetch('/api/ai/prefill-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Use CID directly (T Backend handles IPFS fetching)
          cid: result.ipfsHash,
          // Alternative: resumeUrl if CID doesn't work
          // resumeUrl: publicGatewayUrl,
        }),
      })

      const processingTime = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`   ⏱️ Processing time: ${processingTime}s`)

      if (!prefillResponse.ok) {
        let errorData
        const errorText = await prefillResponse.text()
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: 'Server error', detail: errorText }
        }
        console.error('❌ [PREFILL] API Error Response:', errorData)
        console.error('   Status:', prefillResponse.status, prefillResponse.statusText)
        
        // Handle timeout specifically
        if (prefillResponse.status === 504 || prefillResponse.status === 408) {
          throw new Error(
            `AI processing timed out after ${processingTime}s. ` +
            `T Backend processing can take 20-40 seconds depending on resume complexity. ` +
            `Please try again - it may work on the next attempt.`
          )
        }
        
        throw new Error(errorData.error || errorData.detail || 'Failed to extract data from resume')
      }

      const prefillData = await prefillResponse.json()
      console.log('✅ [PREFILL] AI extraction successful')
      console.log('   Full response:', prefillData)
      console.log(`   Extracted ${prefillData.stats.extracted}/${prefillData.stats.total} fields`)
      console.log(`   Fields: ${prefillData.stats.fieldNames.join(', ')}`)
      console.log('   Form1 Data:', prefillData.form1Data)
      console.log('   Form2 Data:', prefillData.form2Data)
      console.log('   Raw text available:', !!prefillData.metadata?.raw)

      // Check if extraction returned empty data
      const hasRawText = prefillData.metadata?.raw && prefillData.metadata.raw.length > 0
      const extractedCount = prefillData.stats?.extracted || 0

      if (extractedCount === 0) {
        if (!hasRawText) {
          // No text extracted - likely duplicate or scanned PDF
          const duplicateWarning = 
            '⚠️ No data extracted. This might be because:\n' +
            '• This resume was already processed (duplicate detection)\n' +
            '• The file is a scanned PDF (no extractable text)\n' +
            '• Try uploading a different file or rename the current one'
          
          console.warn('⚠️ [PREFILL]', duplicateWarning)
          setErrorMessage(duplicateWarning)
          setUploadStatus('error')
          
          if (onPrefillError) {
            onPrefillError(duplicateWarning)
          }
          return
        } else {
          // Text extracted but no fields parsed - parsing issue
          console.warn('⚠️ [PREFILL] Text extracted but no fields parsed - parsing may have failed')
          setErrorMessage(
            'Text extracted but no fields found. The resume format might not be recognized. ' +
            'You can still fill the forms manually.'
          )
        }
      }

      setExtractedStats(prefillData.stats)
      setUploadStatus('success')

      // Notify parent component
      if (onPrefillSuccess) {
        onPrefillSuccess({
          form1Data: prefillData.form1Data,
          form2Data: prefillData.form2Data,
          form3Data: prefillData.form3Data,
          stats: prefillData.stats,
        })
      }
    } catch (error) {
      console.error('❌ [PREFILL] Error:', error)
      setUploadStatus('error')
      const errorMsg =
        error instanceof Error
          ? error.message
          : 'Upload or extraction failed. Please try again.'
      setErrorMessage(errorMsg)

      if (onPrefillError) {
        onPrefillError(errorMsg)
      }
    } finally {
      setIsUploading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setUploadStatus('idle')
    setErrorMessage('')
    setIpfsHash('')
    setExtractedStats(null)
  }

  const getStatusMessage = () => {
    switch (uploadStatus) {
      case 'uploading':
        return {
          icon: <Loader2 className='w-5 h-5 animate-spin' />,
          text: 'Uploading to IPFS...',
          color: 'text-blue-600',
        }
      case 'extracting':
        return {
          icon: <Brain className='w-5 h-5 animate-pulse' />,
          text: '🤖 AI is reading your resume... This may take 20-40 seconds.',
          color: 'text-purple-600',
        }
      case 'success':
        return {
          icon: <Sparkles className='w-5 h-5' />,
          text: extractedStats
            ? `✓ Found ${extractedStats.extracted} fields from your resume!`
            : '✓ Resume processed successfully!',
          color: 'text-green-600',
        }
      default:
        return null
    }
  }

  const status = getStatusMessage()

  return (
    <div
      className={`w-full max-w-2xl mx-auto p-6 rounded-lg shadow-lg border-2 ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 backdrop-blur-xl border-brand-mint'
          : 'bg-white/80 backdrop-blur-xl border-brand-sage/20'
      }`}
    >
      <div className='mb-6'>
        <div className='flex items-center gap-3 mb-2'>
          <Sparkles
            className={`w-6 h-6 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
          />
          <h2
            className={`text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
          >
            AI Resume Prefill
          </h2>
        </div>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
        >
          Upload your resume and let AI automatically fill out your driver
          application. Supports PDF, DOCX, and TXT files.
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* File Upload Area */}
        <div className='space-y-4'>
          <label
            className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Resume File *
          </label>

          <div className='relative'>
            <input
              type='file'
              accept='.pdf,.doc,.docx,.txt'
              onChange={handleFileChange}
              className='hidden'
              id='resume-file-prefill'
              disabled={isUploading}
            />

            <label
              htmlFor='resume-file-prefill'
              className={`
                flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer
                transition-all duration-200
                ${
                  file
                    ? theme === 'dark'
                      ? 'border-brand-mint bg-brand-mint/10'
                      : 'border-green-400 bg-green-50'
                    : theme === 'dark'
                      ? 'border-gray-600 hover:border-brand-mint/50 bg-gray-800/50'
                      : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }
                ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {file ? (
                <div
                  className={`flex flex-col items-center ${
                    theme === 'dark' ? 'text-brand-mint' : 'text-green-700'
                  }`}
                >
                  <CheckCircle className='w-8 h-8 mb-2' />
                  <span className='font-medium'>{file.name}</span>
                  <span
                    className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-green-600'
                    }`}
                  >
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ) : (
                <div
                  className={`flex flex-col items-center ${
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  }`}
                >
                  <Upload className='w-8 h-8 mb-2' />
                  <span className='font-medium'>
                    Click to upload or drag and drop
                  </span>
                  <span
                    className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    PDF, DOC, DOCX, or TXT (max 10MB)
                  </span>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div
            className={`flex items-center p-3 rounded-md border ${
              uploadStatus === 'success'
                ? theme === 'dark'
                  ? 'bg-green-900/20 border-green-500/50'
                  : 'bg-green-50 border-green-200'
                : theme === 'dark'
                  ? 'bg-blue-900/20 border-blue-500/50'
                  : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className={status.color}>{status.icon}</div>
            <span
              className={`ml-2 text-sm font-medium ${
                uploadStatus === 'success'
                  ? theme === 'dark'
                    ? 'text-green-400'
                    : 'text-green-700'
                  : theme === 'dark'
                    ? 'text-blue-400'
                    : 'text-blue-700'
              }`}
            >
              {status.text}
            </span>
          </div>
        )}

        {/* Extracted Fields Preview */}
        {extractedStats && extractedStats.fieldNames.length > 0 && (
          <div
            className={`p-3 rounded-md border ${
              theme === 'dark'
                ? 'bg-purple-900/20 border-purple-500/50'
                : 'bg-purple-50 border-purple-200'
            }`}
          >
            <div className='flex items-start gap-2'>
              <Brain
                className={`w-5 h-5 mt-0.5 ${
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`}
              />
              <div>
                <p
                  className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-700'
                  }`}
                >
                  Extracted Information:
                </p>
                <p
                  className={`text-xs mt-1 ${
                    theme === 'dark' ? 'text-purple-300' : 'text-purple-600'
                  }`}
                >
                  {extractedStats.fieldNames.join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div
            className={`flex items-center p-3 rounded-md border ${
              theme === 'dark'
                ? 'bg-red-900/20 border-red-500/50'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <AlertCircle
              className={`w-5 h-5 mr-2 ${
                theme === 'dark' ? 'text-red-400' : 'text-red-500'
              }`}
            />
            <span
              className={`text-sm ${
                theme === 'dark' ? 'text-red-400' : 'text-red-700'
              }`}
            >
              {errorMessage}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className='flex gap-3'>
          <button
            type='submit'
            disabled={!file || isUploading}
            className={`
              flex-1 flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
              transition-all duration-200
              ${
                !file || isUploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                    : 'bg-brand-sage hover:bg-brand-sage/90'
              }
            `}
          >
            {isUploading ? (
              <>
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                {uploadStatus === 'extracting'
                  ? 'AI Extracting...'
                  : 'Uploading...'}
              </>
            ) : (
              <>
                <Sparkles className='w-4 h-4 mr-2' />
                Upload & Prefill with AI
              </>
            )}
          </button>

          {uploadStatus === 'success' && (
            <button
              type='button'
              onClick={resetForm}
              className={`px-4 py-3 border rounded-md shadow-sm text-sm font-medium transition-all duration-200 ${
                theme === 'dark'
                  ? 'border-brand-mint/30 text-brand-mint bg-transparent hover:bg-brand-mint/10'
                  : 'border-brand-sage/30 text-brand-sage bg-white hover:bg-brand-sage/5'
              }`}
            >
              Upload Another
            </button>
          )}
        </div>
      </form>

      {/* IPFS Hash Display (for debugging) */}
      {ipfsHash && (
        <div className='mt-4 pt-4 border-t border-gray-200'>
          <p
            className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
          >
            IPFS Hash: <code className='font-mono'>{ipfsHash}</code>
          </p>
        </div>
      )}
    </div>
  )
}

