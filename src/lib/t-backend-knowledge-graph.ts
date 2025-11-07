/**
 * T Backend Knowledge Graph Management
 * 
 * Utilities for managing knowledge graphs with trucking-specific entities and facts.
 * All operations are key-scoped to your API key.
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
 */
export async function addFactToGraph(
  graphId: string,
  fact: string
): Promise<Fact> {
  const apiKey = getApiKey()
  const response = await fetch(`${T_BACKEND_BASE_URL}/graph/${graphId}/facts`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fact,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to add fact to graph: ${response.status} ${error}`)
  }

  return response.json()
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
export async function seedTruckingKnowledgeGraph(graphId: string): Promise<void> {
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
  ]

  console.log(`Seeding ${truckingFacts.length} facts into knowledge graph ${graphId}...`)

  for (const fact of truckingFacts) {
    try {
      await addFactToGraph(graphId, fact)
      console.log(`✅ Added fact: ${fact.substring(0, 50)}...`)
    } catch (error) {
      console.error(`❌ Failed to add fact: ${fact}`, error)
      // Continue with next fact even if one fails
    }
  }

  console.log(`✅ Finished seeding knowledge graph`)
}

