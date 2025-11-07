/**
 * T Backend Knowledge Graph Management
 * 
 * Utilities for managing knowledge graphs with trucking-specific entities and facts.
 * All operations are key-scoped to your API key.
 */

const T_BACKEND_BASE_URL = process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'

// Cache the last successful fact count so the UI can display something even if the API takes time to index
let lastSeededFactCount: number | null = null

// Lazy check for API key - only throw when actually needed
function getApiKey(): string {
  const apiKey = process.env.T_BACKEND_API_KEY
  if (!apiKey) {
    throw new Error('T_BACKEND_API_KEY is not set in environment variables')
  }
  return apiKey
}

interface KnowledgeGraph {
  id: string
  name?: string
  description?: string
}

interface Fact {
  id?: string
  fact: string
  created_at?: string
}

/**
 * Get accessible knowledge graphs
 */
export async function getAccessibleGraphs(): Promise<KnowledgeGraph[]> {
  const apiKey = getApiKey()
  const response = await fetch(`${T_BACKEND_BASE_URL}/graph/accessible`, {
    method: 'GET',
    headers: {
      'api-key': apiKey,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get accessible graphs: ${response.status} ${error}`)
  }

  const data = await response.json()
  // Handle both array and object with graphs property
  if (Array.isArray(data)) {
    return data
  }
  return data.graphs || []
}

/**
 * Add a fact to a knowledge graph
 * T Backend expects an array of facts in the request body
 */
export async function addFactToGraph(
  graphId: string,
  fact: string
): Promise<Fact> {
  const apiKey = getApiKey()
  // T Backend expects an array, so wrap the fact in an array
  const response = await fetch(`${T_BACKEND_BASE_URL}/graph/${graphId}/facts`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        fact,
      },
    ]),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to add fact to graph: ${response.status} ${error}`)
  }

  const result = await response.json()
  console.log(`[KNOWLEDGE GRAPH] Added fact response:`, {
    resultType: Array.isArray(result) ? 'array' : typeof result,
    resultLength: Array.isArray(result) ? result.length : 1,
  })
  // If result is an array, return the first item (the fact we just added)
  // Otherwise, return the result as-is
  return Array.isArray(result) ? result[0] : result
}

export function getLastSeededFactCount(): number | null {
  return lastSeededFactCount
}

/**
 * Add multiple facts to a knowledge graph in a single batch request
 * More efficient than adding facts one at a time
 */
export async function addFactsToGraph(
  graphId: string,
  facts: string[]
): Promise<Fact[]> {
  const apiKey = getApiKey()
  // T Backend expects an array of fact objects
  const factObjects = facts.map((fact) => ({ fact }))
  
  console.log(`[KNOWLEDGE GRAPH] Sending ${facts.length} facts in batch to graph ${graphId}`)
  
  const response = await fetch(`${T_BACKEND_BASE_URL}/graph/${graphId}/facts`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(factObjects),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[KNOWLEDGE GRAPH] Batch add failed: ${response.status} ${error}`)
    throw new Error(`Failed to add facts to graph: ${response.status} ${error}`)
  }

  const result = await response.json()
  console.log(`[KNOWLEDGE GRAPH] Batch response:`, { 
    resultType: Array.isArray(result) ? 'array' : typeof result,
    resultLength: Array.isArray(result) ? result.length : 1 
  })
  
  // Return array of facts
  const factsArray = Array.isArray(result) ? result : [result]
  
  // If we only got 1 result back but sent multiple facts, the batch might not be supported
  // Verify by checking the actual facts in the graph
  if (factsArray.length === 1 && facts.length > 1) {
    console.warn(`[KNOWLEDGE GRAPH] Batch returned only 1 fact but ${facts.length} were sent. Batch may not be supported.`)
  }
  
  return factsArray
}

/**
 * Get facts from a knowledge graph
 */
export async function getGraphFacts(graphId: string): Promise<Fact[]> {
  const apiKey = getApiKey()
  const response = await fetch(`${T_BACKEND_BASE_URL}/graph/${graphId}/facts`, {
    method: 'GET',
    headers: {
      'api-key': apiKey,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get graph facts: ${response.status} ${error}`)
  }

  const data = await response.json()
  console.log('[KNOWLEDGE GRAPH] getGraphFacts response:', data)
  return Array.isArray(data) ? data : data.facts || []
}

/**
 * Query a knowledge graph
 */
export async function queryGraph(graphId: string, query: string): Promise<any> {
  const apiKey = getApiKey()
  const response = await fetch(
    `${T_BACKEND_BASE_URL}/graph/${graphId}/query?query=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: {
        'api-key': apiKey,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to query graph: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Map a chat session to a knowledge graph
 * This makes the graph's facts available to that session
 */
export async function mapSessionToGraph(
  sessionId: string,
  graphId: string
): Promise<void> {
  const apiKey = getApiKey()
  const response = await fetch(`${T_BACKEND_BASE_URL}/graph/sessions/map`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      graph_id: graphId,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to map session to graph: ${response.status} ${error}`)
  }
}

/**
 * Consolidate a knowledge graph (removes duplicates, optimizes)
 */
export async function consolidateGraph(graphId: string): Promise<any> {
  const apiKey = getApiKey()
  const response = await fetch(`${T_BACKEND_BASE_URL}/graph/${graphId}/consolidate`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to consolidate graph: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Seed trucking knowledge graph with core facts
 * 
 * This adds structured facts about:
 * - CDL requirements
 * - DOT regulations
 * - State-specific compliance
 * - Endorsement requirements
 */
export async function seedTruckingKnowledgeGraph(graphId: string): Promise<number> {
  const truckingFacts = [
    // CDL-A Requirements
    'CDL-A (Class A Commercial Driver License) requires: 21 years old, valid medical certificate, passing written and skills tests, no DUI in past 3 years',
    
    // CDL-B Requirements
    'CDL-B (Class B Commercial Driver License) allows operation of single vehicles with GVWR of 26,001+ pounds, or towing vehicle under 10,000 pounds',
    
    // DOT Medical Certification
    'DOT medical certification must be renewed every 2 years (or 1 year if over 65) and is required for all CDL holders',
    
    // Endorsements
    'H Endorsement (Hazmat): Requires TSA background check and fingerprinting, valid for 5 years',
    'N Endorsement (Tank Vehicle): Required for operating tank vehicles with capacity of 1,000+ gallons',
    'P Endorsement (Passenger): Required for operating vehicles designed to carry 16+ passengers',
    'S Endorsement (School Bus): Required for operating school buses, includes P endorsement',
    'X Endorsement (Tank + Hazmat): Combination of N and H endorsements',
    
    // Hours of Service
    'FMCSA Hours of Service rule: Maximum 11 hours driving after 10 consecutive hours off duty, maximum 14 hours on duty',
    '34-hour restart: Allows reset of weekly hours after 34 consecutive hours off duty',
    
    // State-Specific (examples)
    'Ohio CDL: Requires Ohio residency, valid Ohio driver license, passing CDL written and skills tests',
    'Pennsylvania CDL: Requires PA residency, valid PA driver license, passing CDL written and skills tests',
    
    // DOT Application Requirements
    'DOT employment application requires: 3 years of residency history, complete driving history, employment verification',
    'DOT application must include: Personal information, license information, driving record, employment history',
    
    // Employment Verification
    'DOT regulations require employers to verify: Last 3 years of employment, 10 years of driving history, drug/alcohol testing history',
    
    // DOT § 383.35 - Notification of Previous Employment
    'DOT § 383.35: Applicants for commercial motor vehicle operator positions must provide employment history information for the 10 years preceding the application date',
    'DOT § 383.35(c): Employment history must include: (1) Names and addresses of previous employers where applicant operated commercial motor vehicles, (2) Dates of employment, (3) Reason for leaving each employer',
    'DOT § 383.35(d): Applicant must certify that all employment history information furnished is true and complete',
    'DOT § 383.35(f): Before submitting application, employer must inform applicant that employment history information may be used and previous employers may be contacted for work history investigation',
    'DOT § 383.35(e): Employers may require applicants to provide additional employment information beyond the minimum required by regulation',
  ]

  console.log(`Seeding ${truckingFacts.length} facts into knowledge graph ${graphId}...`)

  let addedCount = 0

  // Attempt batch insert first
  try {
    const results = await addFactsToGraph(graphId, truckingFacts)
    addedCount = Math.max(addedCount, results.length)
  } catch (batchError: any) {
    console.warn('Batch add failed, will add individually:', batchError.message)
  }

  // Check what currently exists in the graph (if the API returns anything)
  let existingFacts: Fact[] = []
  try {
    existingFacts = await getGraphFacts(graphId)
  } catch (error: any) {
    console.warn('[KNOWLEDGE GRAPH] Unable to list existing facts before individual adds:', error.message)
  }

  const existingFactTexts = new Set(existingFacts.map((fact) => fact.fact))
  addedCount = Math.max(addedCount, existingFactTexts.size)

  const remainingFacts = truckingFacts.filter((fact) => !existingFactTexts.has(fact))

  if (remainingFacts.length > 0) {
    console.log(`Adding ${remainingFacts.length} remaining facts individually...`)
    for (const fact of remainingFacts) {
      try {
        await addFactToGraph(graphId, fact)
        existingFactTexts.add(fact)
        addedCount = Math.min(existingFactTexts.size, truckingFacts.length)
      } catch (error: any) {
        console.error(`❌ Failed to add fact: ${fact.substring(0, 50)}...`, error.message)
      }
    }
  }

  // Run consolidation to make facts queryable, if supported
  try {
    await consolidateGraph(graphId)
  } catch (error: any) {
    console.warn('[KNOWLEDGE GRAPH] Consolidation failed (non-blocking):', error.message)
  }

  // Final verification – if the API returns 0, we fall back to the count we tracked locally
  try {
    const verifiedFacts = await getGraphFacts(graphId)
    console.log(`✅ Verified ${verifiedFacts.length} facts currently stored`)
    addedCount = Math.max(addedCount, verifiedFacts.length)
  } catch (error: any) {
    console.warn('[KNOWLEDGE GRAPH] Verification fetch failed (using tracked count):', error.message)
  }

  const finalCount = Math.min(addedCount, truckingFacts.length)
  lastSeededFactCount = finalCount
  console.log(`✅ Finished seeding knowledge graph (${finalCount}/${truckingFacts.length} facts recorded)`)
  return finalCount
}

