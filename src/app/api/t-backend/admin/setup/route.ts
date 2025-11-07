/**
 * Admin API Route: Complete T Backend Setup
 * 
 * One-click setup to initialize:
 * 1. Vector store for trucking knowledge
 * 2. Knowledge graph with trucking facts
 * 3. Optional: Upload sample documents
 * 
 * This should be run once to initialize T Backend for trucking-specific guidance.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getOrCreateTruckingVectorStore,
  createTruckingVectorStore,
  uploadFileToVectorStore,
  listVectorStoreFiles,
} from '@/lib/t-backend-vector-store'
import {
  getAccessibleGraphs,
  seedTruckingKnowledgeGraph,
  mapSessionToGraph,
} from '@/lib/t-backend-knowledge-graph'

export const maxDuration = 120 // 2 minutes for full setup

export async function POST(request: NextRequest) {
  try {
    const { 
      setupVectorStore = true,
      setupKnowledgeGraph = true,
      uploadSampleDocs = false,
      sampleDocUrls = [],
    } = await request.json()

    const results: any = {
      vectorStore: null,
      knowledgeGraph: null,
      uploadedFiles: [],
      errors: [],
    }

    // 1. Setup Vector Store
    if (setupVectorStore) {
      try {
        // Try to get or create vector store
        // If listing fails (T Backend validation error), it will fall back to creating a new one
        let vectorStore
        try {
          vectorStore = await getOrCreateTruckingVectorStore()
        } catch (createError: any) {
          // Check if it's a server error (502, 503, 504)
          const isServerError = createError.message?.includes('502') || 
                                createError.message?.includes('503') || 
                                createError.message?.includes('504') ||
                                createError.message?.includes('Bad Gateway')
          
          if (isServerError) {
            throw new Error('T Backend server is currently unavailable (502 Bad Gateway). Please try again later or contact T Backend support.')
          }
          
          // If getOrCreate fails, try creating directly
          console.warn('⚠️ [T BACKEND SETUP] Failed to get/create store, trying direct create:', createError.message)
          try {
            vectorStore = await createTruckingVectorStore()
          } catch (createDirectError: any) {
            const isDirectServerError = createDirectError.message?.includes('502') || 
                                        createDirectError.message?.includes('503') || 
                                        createDirectError.message?.includes('504') ||
                                        createDirectError.message?.includes('Bad Gateway')
            
            if (isDirectServerError) {
              throw new Error('T Backend server is currently unavailable (502 Bad Gateway). Please try again later or contact T Backend support.')
            }
            throw createDirectError
          }
        }
        
        results.vectorStore = {
          id: vectorStore.id,
          name: vectorStore.name,
          description: vectorStore.description,
        }

        // Upload sample documents if requested
        if (uploadSampleDocs && sampleDocUrls && sampleDocUrls.length > 0) {
          const uploadResults = []
          for (const url of sampleDocUrls) {
            try {
              const fileData = await uploadFileToVectorStore(vectorStore.id, url)
              uploadResults.push({
                url,
                success: true,
                fileId: fileData.file_id,
              })
            } catch (error: any) {
              uploadResults.push({
                url,
                success: false,
                error: error.message,
              })
              results.errors.push(`Failed to upload ${url}: ${error.message}`)
            }
          }
          results.uploadedFiles = uploadResults

          // List all files in the vector store (don't fail if this doesn't work)
          try {
            const files = await listVectorStoreFiles(vectorStore.id)
            results.vectorStore.fileCount = files.length
          } catch (error: any) {
            console.warn('⚠️ [T BACKEND SETUP] Failed to list files:', error.message)
            results.vectorStore.fileCount = 0
          }
        } else {
          // List all files in the vector store (don't fail if this doesn't work)
          try {
            const files = await listVectorStoreFiles(vectorStore.id)
            results.vectorStore.fileCount = files.length
          } catch (error: any) {
            console.warn('⚠️ [T BACKEND SETUP] Failed to list files:', error.message)
            results.vectorStore.fileCount = 0
          }
        }
      } catch (error: any) {
        results.errors.push(`Vector store setup failed: ${error.message}`)
      }
    }

    // 2. Setup Knowledge Graph
    if (setupKnowledgeGraph) {
      try {
        const graphs = await getAccessibleGraphs()

        if (!graphs || graphs.length === 0) {
          results.errors.push(
            'No accessible knowledge graphs found. You may need to create one first via T Backend dashboard.'
          )
        } else {
          // Use the first available graph
          const graph = graphs[0]
          results.knowledgeGraph = {
            id: graph.id,
            name: graph.name,
            description: graph.description,
          }

          // Seed with trucking facts
          await seedTruckingKnowledgeGraph(graph.id)

          // Verify facts were added
          const { getGraphFacts } = await import('@/lib/t-backend-knowledge-graph')
          const facts = await getGraphFacts(graph.id)
          results.knowledgeGraph.factCount = facts.length
        }
      } catch (error: any) {
        results.errors.push(`Knowledge graph setup failed: ${error.message}`)
      }
    }

    // Determine overall success
    const hasErrors = results.errors.length > 0
    const hasResults = results.vectorStore || results.knowledgeGraph

    return NextResponse.json({
      success: hasResults && !hasErrors,
      message: hasErrors
        ? 'Setup completed with some errors. Check the errors array for details.'
        : 'T Backend setup completed successfully!',
      ...results,
    })
  } catch (error: any) {
    console.error('❌ [T BACKEND SETUP] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to setup T Backend',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get current status - handle server errors gracefully
    let vectorStore = null
    let vectorStoreError = null
    
    try {
      vectorStore = await getOrCreateTruckingVectorStore()
    } catch (error: any) {
      // Check if it's a server error
      const isServerError = error.message?.includes('502') || 
                            error.message?.includes('503') || 
                            error.message?.includes('504') ||
                            error.message?.includes('Bad Gateway')
      
      if (isServerError) {
        vectorStoreError = 'T Backend server is currently unavailable (502 Bad Gateway). Please try again later.'
      } else {
        // Try creating directly as fallback
        try {
          const { createTruckingVectorStore } = await import('@/lib/t-backend-vector-store')
          vectorStore = await createTruckingVectorStore()
        } catch (createError: any) {
          vectorStoreError = createError.message || 'Failed to connect to T Backend'
        }
      }
    }
    
    let graphs = []
    let knowledgeGraphError = null
    
    try {
      graphs = await getAccessibleGraphs()
    } catch (error: any) {
      const isServerError = error.message?.includes('502') || 
                            error.message?.includes('503') || 
                            error.message?.includes('504') ||
                            error.message?.includes('Bad Gateway')
      
      if (isServerError) {
        knowledgeGraphError = 'T Backend server is currently unavailable (502 Bad Gateway). Please try again later.'
      } else {
        knowledgeGraphError = error.message || 'Failed to access knowledge graphs'
      }
    }

    let graphFacts = 0
    if (graphs && graphs.length > 0) {
      try {
        const { getGraphFacts } = await import('@/lib/t-backend-knowledge-graph')
        graphFacts = (await getGraphFacts(graphs[0].id).catch(() => [])).length
      } catch (error: any) {
        // Ignore errors when getting facts
      }
    }

    let fileCount = 0
    if (vectorStore) {
      try {
        fileCount = (await listVectorStoreFiles(vectorStore.id).catch(() => [])).length
      } catch (error: any) {
        // Ignore errors when listing files
      }
    }

    return NextResponse.json({
      success: true,
      status: {
        vectorStore: vectorStore
          ? {
              id: vectorStore.id,
              name: vectorStore.name,
              fileCount,
            }
          : null,
        vectorStoreError,
        knowledgeGraph:
          graphs && graphs.length > 0
            ? {
                id: graphs[0].id,
                name: graphs[0].name,
                factCount: graphFacts,
              }
            : null,
        knowledgeGraphError,
      },
    })
  } catch (error: any) {
    console.error('❌ [T BACKEND SETUP] Error getting status:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get setup status',
      },
      { status: 500 }
    )
  }
}

