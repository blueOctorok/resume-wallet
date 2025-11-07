/**
 * API Route: Setup T Backend Knowledge Graph
 * 
 * Seeds the knowledge graph with trucking-specific facts.
 * This should be run once to initialize the knowledge graph.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAccessibleGraphs,
  seedTruckingKnowledgeGraph,
  getGraphFacts,
  getLastSeededFactCount,
} from '@/lib/t-backend-knowledge-graph'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { graphId, action } = await request.json()

    // Get accessible graphs
    const graphs = await getAccessibleGraphs()

    if (!graphs || graphs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No accessible knowledge graphs found. You may need to create one first via T Backend.',
        },
        { status: 404 }
      )
    }

    // Use provided graphId or first available graph
    const targetGraphId = graphId || graphs[0].id

    if (action === 'seed') {
      // Seed the graph with trucking facts
      const addedCount = await seedTruckingKnowledgeGraph(targetGraphId)

      // Get all facts to verify (best effort)
      let facts = []
      try {
        facts = await getGraphFacts(targetGraphId)
      } catch (error: any) {
        console.warn('[KNOWLEDGE GRAPH] Unable to verify facts after seeding:', error.message)
      }

      const cached = getLastSeededFactCount() || 0

      return NextResponse.json({
        success: true,
        graphId: targetGraphId,
        factsCount: Math.max(addedCount, facts.length, cached),
        facts: facts.slice(0, 10), // Return first 10 facts as sample
        message: `Successfully seeded knowledge graph with trucking facts`,
      })
    }

    if (action === 'list') {
      const facts = await getGraphFacts(targetGraphId)

      const cached = getLastSeededFactCount() || 0

      return NextResponse.json({
        success: true,
        graphId: targetGraphId,
        factsCount: Math.max(facts.length, cached),
        facts,
      })
    }

    // Default: return graph info
    return NextResponse.json({
      success: true,
      graphs,
      defaultGraphId: targetGraphId,
      message: 'Knowledge graph information retrieved',
    })
  } catch (error: any) {
    console.error('Error setting up knowledge graph:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to setup knowledge graph',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const graphs = await getAccessibleGraphs()

    if (graphs && graphs.length > 0) {
      const firstGraph = graphs[0]
      let facts = []
      try {
        facts = await getGraphFacts(firstGraph.id)
      } catch (error: any) {
        console.warn('[KNOWLEDGE GRAPH] GET status failed to fetch facts:', error.message)
      }
      const cached = getLastSeededFactCount() || 0

      return NextResponse.json({
        success: true,
        graphs,
        defaultGraphId: firstGraph.id,
        factsCount: Math.max(facts.length, cached),
      })
    }

    return NextResponse.json({
      success: true,
      graphs: [],
      message: 'No accessible knowledge graphs found',
    })
  } catch (error: any) {
    console.error('Error getting knowledge graph:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get knowledge graph',
      },
      { status: 500 }
    )
  }
}

