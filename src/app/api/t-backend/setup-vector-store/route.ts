/**
 * API Route: Setup T Backend Vector Store
 * 
 * Creates or gets the trucking-knowledge vector store and optionally uploads documents.
 * This should be run once to initialize the vector store.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getOrCreateTruckingVectorStore,
  createTruckingVectorStore,
  uploadFileToVectorStore,
  listVectorStoreFiles,
} from '@/lib/t-backend-vector-store'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { action, fileUrls } = await request.json()

    // Get or create the trucking knowledge vector store
    // If listing fails (T Backend validation error), fall back to creating a new one
    let vectorStore
    try {
      vectorStore = await getOrCreateTruckingVectorStore()
    } catch (error: any) {
      console.warn('⚠️ [VECTOR STORE] Failed to get/create store, trying direct create:', error.message)
      // If getOrCreate fails, try creating directly (this bypasses the list operation)
      vectorStore = await createTruckingVectorStore()
    }

    if (action === 'create-only') {
      return NextResponse.json({
        success: true,
        vectorStore,
        message: 'Vector store created or retrieved successfully',
      })
    }

    if (action === 'upload-files' && fileUrls && Array.isArray(fileUrls)) {
      const uploadResults = []

      for (const fileUrl of fileUrls) {
        try {
          const fileData = await uploadFileToVectorStore(vectorStore.id, fileUrl)
          uploadResults.push({
            url: fileUrl,
            success: true,
            fileData,
          })
        } catch (error: any) {
          uploadResults.push({
            url: fileUrl,
            success: false,
            error: error.message,
          })
        }
      }

      // List all files in the vector store
      const files = await listVectorStoreFiles(vectorStore.id)

      return NextResponse.json({
        success: true,
        vectorStore,
        uploadResults,
        files,
        message: `Uploaded ${uploadResults.filter((r) => r.success).length} files to vector store`,
      })
    }

    // List existing files
    const files = await listVectorStoreFiles(vectorStore.id)

    return NextResponse.json({
      success: true,
      vectorStore,
      files,
      message: 'Vector store retrieved successfully',
    })
  } catch (error: any) {
    console.error('Error setting up vector store:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to setup vector store',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Try to get or create vector store
    // If listing fails, try creating a new one
    let vectorStore
    let error: any = null
    
    try {
      vectorStore = await getOrCreateTruckingVectorStore()
    } catch (getError: any) {
      error = getError
      console.warn('⚠️ [VECTOR STORE] Failed to get/create store, trying direct create:', getError.message)
      
      // Check if it's a server error
      const isServerError = getError.message?.includes('502') || 
                            getError.message?.includes('503') || 
                            getError.message?.includes('504') ||
                            getError.message?.includes('Bad Gateway')
      
      if (isServerError) {
        // Don't try to create if server is down - return helpful error
        return NextResponse.json(
          {
            success: false,
            error: 'T Backend server is currently unavailable (502 Bad Gateway). Please try again later or contact T Backend support.',
            serverError: true,
          },
          { status: 502 }
        )
      }
      
      // Try creating directly as fallback
      try {
        vectorStore = await createTruckingVectorStore()
        error = null // Clear error if creation succeeds
      } catch (createError: any) {
        // Check if creation also failed with server error
        const isCreateServerError = createError.message?.includes('502') || 
                                    createError.message?.includes('503') || 
                                    createError.message?.includes('504') ||
                                    createError.message?.includes('Bad Gateway')
        
        if (isCreateServerError) {
          return NextResponse.json(
            {
              success: false,
              error: 'T Backend server is currently unavailable (502 Bad Gateway). Please try again later or contact T Backend support.',
              serverError: true,
            },
            { status: 502 }
          )
        }
        throw createError
      }
    }
    
    // If we still don't have a vector store, return error
    if (!vectorStore) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || 'Failed to get or create vector store',
        },
        { status: 500 }
      )
    }
    
    // Try to list files, but don't fail if it doesn't work
    let files = []
    try {
      files = await listVectorStoreFiles(vectorStore.id)
    } catch (fileError: any) {
      console.warn('⚠️ [VECTOR STORE] Failed to list files:', fileError.message)
      // Continue with empty files array
    }

    return NextResponse.json({
      success: true,
      vectorStore,
      files,
    })
  } catch (error: any) {
    console.error('❌ [VECTOR STORE] Error getting vector store:', error)
    
    // Check if it's a server error
    const isServerError = error.message?.includes('502') || 
                          error.message?.includes('503') || 
                          error.message?.includes('504') ||
                          error.message?.includes('Bad Gateway')
    
    return NextResponse.json(
      {
        success: false,
        error: isServerError 
          ? 'T Backend server is currently unavailable (502 Bad Gateway). Please try again later or contact T Backend support.'
          : error.message || 'Failed to get vector store',
        serverError: isServerError,
      },
      { status: isServerError ? 502 : 500 }
    )
  }
}

