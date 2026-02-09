/**
 * T Backend Knowledge Graph Management
 * 
 * Utilities for managing knowledge graphs with trucking-specific entities and facts.
 * All operations are key-scoped to your API key.
 */

const T_BACKEND_BASE_URL = process.env.T_BACKEND_BASE_URL || 'https://api-v3.fluxpointstudios.com'

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

    // DOT § 383.37 - Employer prohibitions
    '49 CFR 383.37(a): Employers must not allow a driver to operate a CMV without a current CLP/CDL of the proper class and endorsements, or if the driver violates any license restriction',
    '49 CFR 383.37(b): Employers must not allow a driver to operate a CMV if the driver has a disqualified or revoked CLP/CDL, or has lost the right to operate a CMV',
    '49 CFR 383.37(c): Employers must not allow a driver who has more than one CLP or CDL to operate a CMV',
    '49 CFR 383.37(d): Employers must not permit operation of a CMV when the driver, vehicle, or carrier is under an out-of-service order',
    '49 CFR 383.37(e): Employers must not require or allow a driver to violate railroad-highway grade crossing laws or regulations',

    // DOT § 383.91 and Subpart G - Vehicle groups and knowledge requirements
    '49 CFR 383.91(a)(1): CDL Group A (Combination Vehicle) covers combinations with GCWR ≥ 26,001 lbs and towed units > 10,000 lbs GVWR',
    '49 CFR 383.91(a)(2): CDL Group B (Heavy Straight Vehicle) covers single vehicles with GVWR ≥ 26,001 lbs or such vehicles towing ≤ 10,000 lbs',
    '49 CFR 383.91(a)(3): CDL Group C (Small Vehicle) covers vehicles not in Group A or B that carry 16+ passengers or transport hazardous materials',
    '49 CFR 383.91(b): A representative vehicle for the driving test must meet the definition of the vehicle group being tested',
    '49 CFR 383.91(c): Drivers moving to a new vehicle group must pass the knowledge and skills tests for that group, except Group A holders may operate Groups B and C, and Group B holders may operate Group C with proper endorsements',
    '49 CFR Part 383 Subpart G: CDL applicants must demonstrate knowledge and skills specific to the vehicle group and required endorsements',

    // DOT § 383.93 - Endorsements
    '49 CFR 383.93(a)(1): Drivers must pass specialized knowledge and skills tests, in addition to Subpart G tests, to obtain each CDL endorsement',
    '49 CFR 383.93(a)(2): CLPs may only carry passenger (P), school bus (S), or tank vehicle (N) endorsements',
    '49 CFR 383.93(a)(3): States must use the endorsement codes defined in 49 CFR 383.153 on CLPs and CDLs',
    '49 CFR 383.93(b): CDL endorsements are required for double/triple trailers, passenger vehicles, tank vehicles, hazardous materials, and school buses',
    '49 CFR 383.93(c): Required tests by endorsement—Doubles/Triples (knowledge), Passenger (knowledge & skills), Tank (knowledge), Hazmat (knowledge), School bus (knowledge & skills)',

    // DOT § 383.95 - Restrictions
    '49 CFR 383.95(a): Failing the air brake knowledge test or testing in a vehicle without air brakes results in an air-brake restriction on the CLP/CDL',
    '49 CFR 383.95(b): Testing in an air-over-hydraulic vehicle triggers a restriction from operating full air-brake CMVs',
    '49 CFR 383.95(c): Testing in an automatic transmission vehicle requires a manual transmission restriction on the CDL',
    '49 CFR 383.95(d): Testing Group A in a pintle-hook/non-fifth-wheel combination restricts the driver from operating fifth-wheel tractor-trailer combinations',
    '49 CFR 383.95(e): Passenger endorsement skills tests in Group B vehicles restrict the driver from Group A passenger vehicles',
    '49 CFR 383.95(f): Passenger endorsement skills tests in Group C vehicles restrict the driver from Group A or B passenger vehicles',
    '49 CFR 383.95(g): Medical variance notifications add restriction code “V” to the CDL indicating a medical variance exists in CDLIS; drivers with code V cannot operate in Canada',

    // 49 CFR 391.11 - General qualifications of drivers
    '49 CFR 391.11(a): A driver and motor carrier must ensure the driver is qualified before operating a commercial motor vehicle',
    '49 CFR 391.11(b)(1): Drivers must be at least 21 years old to operate a commercial motor vehicle in interstate commerce',
    '49 CFR 391.11(b)(2): Drivers must read and speak English sufficiently to converse, understand traffic signs, respond to inquiries, and complete reports',
    '49 CFR 391.11(b)(3): Drivers must have the experience or training necessary to safely operate the type of CMV they drive',
    '49 CFR 391.11(b)(4): Drivers must meet the physical qualification requirements in Subpart E of Part 391',
    '49 CFR 391.11(b)(5): Drivers must hold a single valid CMV operator’s license issued by one State or jurisdiction',
    '49 CFR 391.11(b)(6): Drivers must not be disqualified under 49 CFR 391.15',
    '49 CFR 391.11(b)(7): Drivers must complete and document a road test (or equivalent) under 49 CFR 391.31/391.33',

    // 49 CFR 391.13 - Responsibilities of drivers
    '49 CFR 391.13(a): Drivers must be able to determine whether cargo is properly located, distributed, and secured before operating',
    '49 CFR 391.13(b): Drivers must know the methods and procedures for securing cargo on the commercial motor vehicle they operate',

    // 49 CFR 391.15 - Disqualification of drivers
    '49 CFR 391.15(a): Disqualified drivers may not operate CMVs and motor carriers cannot permit disqualified drivers to drive',
    '49 CFR 391.15(b)(1): Drivers are disqualified while their CDL is revoked, suspended, withdrawn, or denied until privileges are restored',
    '49 CFR 391.15(b)(2): Drivers must notify their motor carrier by the next business day after learning their driving privileges were revoked or suspended',
    '49 CFR 391.15(c)(2): Disqualifying offenses include DUI, controlled substance violations, leaving the scene, and felonies involving a CMV',
    '49 CFR 391.15(d)(2): Violating an out-of-service order triggers 90-day to 5-year disqualification depending on prior offenses and cargo type',
    '49 CFR 391.15(e)-(f): Multiple convictions for texting or hand-held phone use while driving a CMV cause 60- to 120-day disqualifications',
    '49 CFR 391.21(a): Drivers must complete and submit a motor carrier employment application before operating a CMV',
    '49 CFR 391.21(b)(1): Every application must show the employing motor carrier’s name and address',
    '49 CFR 391.21(b)(2)-(5): Applications must capture the applicant’s contact info, 3-year address history, submission date, and license details with issuing authority and expiration',
    '49 CFR 391.21(b)(6)-(8): Applications must list driving experience by equipment type, accidents for the past 3 years, and traffic violations for the past 3 years',
    '49 CFR 391.21(b)(9)-(11): Applications must document license denials or suspensions plus 3- and 10-year employment histories with reasons for leaving and FMCSR/safety-sensitive designations',
    '49 CFR 391.21(b)(12): Application must include the certification statement signed and dated by the applicant',
    '49 CFR 391.21(d): Motor carriers must inform applicants their safety performance history will be investigated and outline their due-process rights under § 391.23(i)',
    '49 CFR 391.23(a): Motor carriers must pull 3-year motor vehicle records and investigate DOT safety performance history within 30 days of a driver’s start date',
    '49 CFR 391.23(b)-(c): Motor vehicle records and safety performance responses (or good-faith attempt documentation) must be filed within 30 days',
    '49 CFR 391.23(d)-(e): Previous employers must provide accident details and drug/alcohol program violations from the prior 3 years, including Clearinghouse compliance',
    '49 CFR 391.23(f): Prospective employers need the driver’s written consent to obtain drug and alcohol history and cannot hire without it',
    '49 CFR 391.23(g): Previous employers must respond within 30 days, ensure accuracy, and retain investigation records for one year',
    '49 CFR 391.23(i)-(j): Drivers have rights to review, correct, and rebut safety performance history data within defined timelines',
    '49 CFR 391.23(m): Carriers must verify medical certification status via CDLIS and retain the medical examiner’s certificate before permitting CMV operation',
    '49 CFR 391.31(a): Drivers must pass a road test and receive a certificate before operating a CMV for a carrier',
    '49 CFR 391.31(c): Road tests must cover pre-trip inspection, coupling, vehicle control, traffic operation, turns, braking, and backing/parking',
    '49 CFR 391.31(d)-(g): Carriers must document road test results, issue a certificate, and retain the signed test form and certificate in the driver’s qualification file',
    '49 CFR 391.33(a): A carrier may accept a valid CDL or a prior road-test certificate (within 3 years) in place of administering a new road test',
    '49 CFR 391.33(b)-(c): Carriers must retain copies of accepted licenses/certificates and may still require a road test at their discretion',
    '49 CFR 391.41(a): Drivers must hold a current medical examiner’s certificate (or qualifying CDL record) and carry required variance documents while on duty',
    '49 CFR 391.41(a)(2): CDL/CLP holders who filed their medical card with the state do not need to carry the paper certificate after the grace period, but variances must always be carried',
    '49 CFR 391.41(b)(1)-(13): Physical qualification standards cover limbs, diabetes, cardiac, respiratory, neurological, vision, hearing, drug use, and alcoholism',
    '49 CFR 391.43(a)-(c): DOT medical exams must be performed by National Registry examiners (with limited specialist exceptions) who follow FMCSA protocols',
    '49 CFR 391.43(e)-(g): Medical examiners must record results on MCSA-5875/5876, provide certificates, and report pending/failed determinations to FMCSA',
    '49 CFR 391.43(f)-(h): Examiners must sign the Medical Examination Report, furnish certificates, and submit examination results electronically via the National Registry',
    '49 CFR 391.51(a)-(b): Carriers must keep a driver qualification file with the application, MVRs, road-test proof or equivalents, annual reviews, and medical documents',
    '49 CFR 391.51(b)(6)-(8): DQ files must include current medical certification evidence, variance documents, and notes verifying examiner registry listing',
    '49 CFR 391.51(c)-(d): DQ files are retained for the employment term plus 3 years, with certain records removable after 3 years',
    '49 CFR 391.53(a): Carriers must maintain a secure driver investigation history file with limited access and hiring-only usage',
    '49 CFR 391.53(b): Investigation history file must contain driver consent and employer responses or documented good-faith attempts',
    '49 CFR 391.53(c)-(d): Investigation history records are retained for employment plus 3 years and must be produced promptly to FMCSA or authorized agents',
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

