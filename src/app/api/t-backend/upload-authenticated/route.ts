/**
 * API Route: Upload Authenticated Document to T Backend Vector Store
 * 
 * Handles documents behind authentication by:
 * 1. Accepting URL + authentication credentials
 * 2. Downloading file server-side with authentication
 * 3. Uploading to T Backend vector store
 * 
 * This allows you to upload documents that require login/authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getOrCreateTruckingVectorStore,
  uploadFileToVectorStore,
} from '@/lib/t-backend-vector-store'

export const maxDuration = 120 // 2 minutes for file download + upload

export async function POST(request: NextRequest) {
  try {
    const {
      url,
      vectorStoreId,
      // Authentication options
      headers = {}, // Custom headers (e.g., Authorization, Cookie)
      cookies = {}, // Cookies to include
      username,
      password, // Basic auth
      bearerToken, // Bearer token auth
    } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    console.log('🔐 [AUTH UPLOAD] Downloading authenticated document:', url)

    // Build headers for authenticated request
    const fetchHeaders: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (compatible; DriverAppChain/1.0)',
      ...headers,
    }

    // Add authentication headers
    if (bearerToken) {
      fetchHeaders['Authorization'] = `Bearer ${bearerToken}`
    } else if (username && password) {
      // Basic auth
      const basicAuth = Buffer.from(`${username}:${password}`).toString('base64')
      fetchHeaders['Authorization'] = `Basic ${basicAuth}`
    }

    // Build cookies string
    if (Object.keys(cookies).length > 0) {
      const cookieString = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')
      fetchHeaders['Cookie'] = cookieString
    }

    // Download the file with authentication
    const fileResponse = await fetch(url, {
      headers: fetchHeaders,
    })

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text().catch(() => 'Unknown error')
      console.error('❌ [AUTH UPLOAD] Failed to download file:', fileResponse.status, errorText)
      return NextResponse.json(
        {
          error: `Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`,
          detail: errorText.substring(0, 500), // First 500 chars of error
        },
        { status: fileResponse.status }
      )
    }

    // Get file content
    const fileBuffer = await fileResponse.arrayBuffer()
    const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream'
    const contentLength = fileResponse.headers.get('content-length')
    
    console.log('✅ [AUTH UPLOAD] File downloaded:', {
      size: fileBuffer.byteLength,
      contentType,
    })

    // Option 1: Upload to IPFS first, then to T Backend (recommended)
    // This makes the file publicly accessible via IPFS
    try {
      const { uploadToIPFS } = await import('@/lib/ipfs')
      
      // Convert ArrayBuffer to Blob
      const blob = new Blob([fileBuffer], { type: contentType })
      const file = new File([blob], url.split('/').pop() || 'document.pdf', { type: contentType })
      
      console.log('📤 [AUTH UPLOAD] Uploading to IPFS...')
      const ipfsResult = await uploadToIPFS(file)
      
      const ipfsHash = ipfsResult.IpfsHash || ipfsResult.ipfsHash
      console.log('✅ [AUTH UPLOAD] Uploaded to IPFS:', ipfsHash)
      
      // Get or create vector store
      const vectorStore = vectorStoreId
        ? { id: vectorStoreId }
        : await getOrCreateTruckingVectorStore()
      
      // Use public IPFS gateway URL (use the URL from IPFS result or construct it)
      const ipfsUrl = ipfsResult.url || `https://ipfs.io/ipfs/${ipfsHash}`
      console.log('🔗 [AUTH UPLOAD] IPFS URL:', ipfsUrl)
      
      // Upload to T Backend vector store
      const fileData = await uploadFileToVectorStore(vectorStore.id, ipfsUrl)
      
      return NextResponse.json({
        success: true,
        fileData,
        ipfsHash,
        ipfsUrl,
        vectorStoreId: vectorStore.id,
        message: 'File uploaded successfully to vector store via IPFS',
      })
    } catch (ipfsError: any) {
      console.error('❌ [AUTH UPLOAD] IPFS upload failed:', ipfsError)
      
      // Option 2: Try direct upload to T Backend (if they support it)
      // This would require checking if T Backend has a direct file upload endpoint
      // For now, return error suggesting manual upload
      return NextResponse.json(
        {
          error: 'Failed to upload file. IPFS upload failed.',
          detail: ipfsError.message,
          suggestion: 'Try uploading the file manually to IPFS first, then use that URL.',
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('❌ [AUTH UPLOAD] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload authenticated document',
        detail: error.message,
      },
      { status: 500 }
    )
  }
}

