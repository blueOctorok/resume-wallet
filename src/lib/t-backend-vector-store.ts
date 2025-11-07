/**
 * T Backend Vector Store Management
 * 
 * Utilities for creating and managing vector stores for trucking knowledge.
 * All operations are key-scoped to your API key and won't affect other clients.
 */

const T_BACKEND_BASE_URL = process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'

// Lazy check for API key - only throw when actually needed
function getApiKey(): string {
  const apiKey = process.env.T_BACKEND_API_KEY
  if (!apiKey) {
    throw new Error('T_BACKEND_API_KEY is not set in environment variables')
  }
  return apiKey
}

interface VectorStore {
  id: string
  name: string
  description?: string
  created_at?: string | number // T Backend returns integer timestamp
  file_counts?: any // T Backend returns FileCounts object
}

interface FileUploadResponse {
  file_id: string
  filename: string
  size?: number
  content_type?: string
}

interface VectorStoreFile {
  file_id: string
  filename: string
  added_at?: string
}

/**
 * Create a new vector store for trucking knowledge
 */
export async function createTruckingVectorStore(): Promise<VectorStore> {
  const apiKey = getApiKey()
  const response = await fetch(`${T_BACKEND_BASE_URL}/files/vector-stores`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'trucking-knowledge',
      description: 'Driving regulations, CDL guides, and employer SOPs for driver employment applications',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create vector store: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Get or create the trucking knowledge vector store
 * Returns existing store if found, creates new one if not
 */
export async function getOrCreateTruckingVectorStore(): Promise<VectorStore> {
  try {
    // Try to find existing store by name
    // listVectorStores() now handles 504/502/503 errors silently (returns [])
    const stores = await listVectorStores()
    const existingStore = stores.find((store) => store.name === 'trucking-knowledge')
    
    if (existingStore) {
      return existingStore
    }
    
    // Create new store if not found (or if listing returned empty due to timeout)
    return await createTruckingVectorStore()
  } catch (error: any) {
    // Check if it's a server error (502, 503, 504)
    const isServerError = error.message?.includes('502') ||
                         error.message?.includes('503') ||
                         error.message?.includes('504') ||
                         error.message?.includes('Gateway Timeout') ||
                         error.message?.includes('Bad Gateway') ||
                         error.message?.includes('Service Unavailable')
    
    // Only log non-server errors
    if (!isServerError) {
      console.error('Error getting or creating vector store:', error)
    }
    throw error
  }
}

/**
 * List all vector stores
 * 
 * Note: T Backend may return data in a format that doesn't match its own validation.
 * This function handles various response formats and normalizes them.
 */
export async function listVectorStores(): Promise<VectorStore[]> {
  try {
    const apiKey = getApiKey()
    const response = await fetch(`${T_BACKEND_BASE_URL}/files/vector-stores`, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      
      // Handle server timeout/availability errors (502, 503, 504)
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        // Don't log as error - these are server availability issues, not app errors
        // Return empty array to allow fallback behavior
        return []
      }
      
      // If it's a validation error on T Backend's side (500 with validation error message)
      if (response.status === 500 && errorText.includes('validation error')) {
        // Don't log - this is a known T Backend issue that we handle gracefully
        return []
      }
      
      // For other errors, throw (but this will be caught by outer catch)
      throw new Error(`Failed to list vector stores: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    
    // Handle different response formats
    let stores: any[] = []
    
    if (Array.isArray(data)) {
      stores = data
    } else if (data.stores && Array.isArray(data.stores)) {
      stores = data.stores
    } else if (data.data && Array.isArray(data.data)) {
      stores = data.data
    } else if (data.results && Array.isArray(data.results)) {
      stores = data.results
    } else {
      // If it's a single object, wrap it in an array
      stores = [data]
    }
    
    // Transform stores to normalize the format
    return stores.map((store: any) => ({
      id: store.id || store.vector_store_id,
      name: store.name,
      description: store.description,
      // Convert created_at from integer timestamp to ISO string if needed
      created_at: store.created_at 
        ? (typeof store.created_at === 'number' 
            ? new Date(store.created_at * 1000).toISOString() 
            : store.created_at)
        : undefined,
      // Keep file_counts as-is (it's an object)
      file_counts: store.file_counts,
    }))
  } catch (error: any) {
    // Check for server timeout/availability errors
    const isServerError = error.message?.includes('502') ||
                         error.message?.includes('503') ||
                         error.message?.includes('504') ||
                         error.message?.includes('Gateway Timeout') ||
                         error.message?.includes('Bad Gateway') ||
                         error.message?.includes('Service Unavailable')
    
    // Check for validation errors
    const isValidationError = error.message?.includes('validation error') || 
                              error.message?.includes('VectorStoreResponse')
    
    // Only log unexpected errors (not server timeouts or validation errors)
    // Server errors are handled silently because they're expected when T Backend is slow/down
    if (!isServerError && !isValidationError) {
      console.warn('Failed to list vector stores:', error.message)
    }
    
    // Return empty array for all errors (allows fallback to create new store)
    return []
  }
}

/**
 * Upload a file from URL to the vector store
 */
export async function uploadFileToVectorStore(
  vectorStoreId: string,
  fileUrl: string
): Promise<FileUploadResponse> {
  const apiKey = getApiKey()
  // First, upload the file from URL
  const uploadResponse = await fetch(`${T_BACKEND_BASE_URL}/files/upload-url`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: fileUrl,
    }),
  })

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text()
    throw new Error(`Failed to upload file: ${uploadResponse.status} ${error}`)
  }

  const fileData: FileUploadResponse = await uploadResponse.json()

  // Then, add the file to the vector store
  const addResponse = await fetch(
    `${T_BACKEND_BASE_URL}/files/vector-stores/${vectorStoreId}/files`,
    {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileData.file_id,
      }),
    }
  )

  if (!addResponse.ok) {
    const error = await addResponse.text()
    throw new Error(`Failed to add file to vector store: ${addResponse.status} ${error}`)
  }

  return fileData
}

/**
 * List files in a vector store
 */
export async function listVectorStoreFiles(vectorStoreId: string): Promise<VectorStoreFile[]> {
  const apiKey = getApiKey()
  const response = await fetch(
    `${T_BACKEND_BASE_URL}/files/vector-stores/${vectorStoreId}/files`,
    {
      method: 'GET',
      headers: {
        'api-key': apiKey,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list vector store files: ${response.status} ${error}`)
  }

  const data = await response.json()
  return Array.isArray(data) ? data : data.files || []
}

/**
 * Delete a vector store
 */
export async function deleteVectorStore(vectorStoreId: string): Promise<void> {
  const apiKey = getApiKey()
  const response = await fetch(
    `${T_BACKEND_BASE_URL}/files/vector-stores/${vectorStoreId}`,
    {
      method: 'DELETE',
      headers: {
        'api-key': apiKey,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to delete vector store: ${response.status} ${error}`)
  }
}

/**
 * Get vector store by name
 */
export async function getVectorStoreByName(name: string): Promise<VectorStore | null> {
  try {
    const apiKey = getApiKey()
    const response = await fetch(
      `${T_BACKEND_BASE_URL}/files/vector-stores/by-name/${name}`,
      {
        method: 'GET',
        headers: {
          'api-key': apiKey,
        },
      }
    )

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get vector store: ${response.status} ${error}`)
    }

    return response.json()
  } catch (error) {
    console.error('Error getting vector store by name:', error)
    return null
  }
}

