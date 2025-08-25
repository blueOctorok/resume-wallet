'use client'

import { useState } from 'react'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { uploadToIPFS } from '@/lib/ipfs'

export default function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      if (
        !selectedFile.type.includes('pdf') &&
        !selectedFile.type.includes('doc') &&
        !selectedFile.type.includes('docx')
      ) {
        setErrorMessage('Please select a PDF, DOC, or DOCX file')
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

      // Auto-generate title from filename if empty
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file || !title.trim()) {
      setErrorMessage('Please select a file and enter a title')
      return
    }

    setIsUploading(true)
    setUploadStatus('uploading')
    setErrorMessage('')

    try {
      const result = await uploadToIPFS(file)

      setUploadStatus('success')

      // Log the upload result for now
      console.log('Resume uploaded:', {
        ipfsHash: result.ipfsHash,
        url: result.url,
        filename: file.name,
        isPublic,
        title,
      })

      // TODO: Save to database and blockchain
      // This will be implemented in the next phase

      // Reset form after successful upload
      setFile(null)
      setTitle('')
      setIsPublic(false)
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadStatus('error')
      setErrorMessage('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setTitle('')
    setIsPublic(false)
    setUploadStatus('idle')
    setErrorMessage('')
  }

  return (
    <div className='w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200'>
      <div className='mb-6'>
        <h2 className='text-2xl font-semibold text-gray-900 mb-2'>
          Upload Resume
        </h2>
        <p className='text-gray-600'>
          Upload your resume to IPFS for secure, decentralized storage. Your
          file will be cryptographically verified and stored on the blockchain.
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* File Upload Area */}
        <div className='space-y-4'>
          <label className='block text-sm font-medium text-gray-700'>
            Resume File *
          </label>

          <div className='relative'>
            <input
              type='file'
              accept='.pdf,.doc,.docx'
              onChange={handleFileChange}
              className='hidden'
              id='resume-file'
              disabled={isUploading}
            />

            <label
              htmlFor='resume-file'
              className={`
                flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer
                transition-colors duration-200
                ${
                  file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }
                ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {file ? (
                <div className='flex flex-col items-center text-green-700'>
                  <CheckCircle className='w-8 h-8 mb-2' />
                  <span className='font-medium'>{file.name}</span>
                  <span className='text-sm text-green-600'>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ) : (
                <div className='flex flex-col items-center text-green-500'>
                  <Upload className='w-8 h-8 mb-2' />
                  <span className='font-medium'>
                    Click to upload or drag and drop
                  </span>
                  <span className='text-sm'>PDF, DOC, or DOCX (max 10MB)</span>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Title Input */}
        <div>
          <label
            htmlFor='title'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Resume Title *
          </label>
          <input
            type='text'
            id='title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g., Senior CDL Driver Resume'
            className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            disabled={isUploading}
            required
          />
        </div>

        {/* Public/Private Toggle */}
        <div className='flex items-center'>
          <input
            type='checkbox'
            id='isPublic'
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
            disabled={isUploading}
          />
          <label
            htmlFor='isPublic'
            className='ml-2 block text-sm text-gray-700'
          >
            Make this resume public (visible to employers)
          </label>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className='flex items-center p-3 bg-red-50 border border-red-200 rounded-md'>
            <AlertCircle className='w-5 h-5 text-red-400 mr-2' />
            <span className='text-sm text-red-700'>{errorMessage}</span>
          </div>
        )}

        {/* Success Message */}
        {uploadStatus === 'success' && (
          <div className='flex items-center p-3 bg-green-50 border border-green-200 rounded-md'>
            <CheckCircle className='w-5 h-5 text-green-400 mr-2' />
            <span className='text-sm text-green-700'>
              Resume uploaded successfully! Your file is now stored on IPFS.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className='flex gap-3'>
          <button
            type='submit'
            disabled={!file || !title.trim() || isUploading}
            className={`
              flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
              ${
                !file || !title.trim() || isUploading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }
            `}
          >
            {isUploading ? (
              <>
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                Uploading...
              </>
            ) : (
              <>
                <FileText className='w-4 h-4 mr-2' />
                Upload to IPFS
              </>
            )}
          </button>

          {uploadStatus === 'success' && (
            <button
              type='button'
              onClick={resetForm}
              className='px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            >
              Upload Another
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
