import { NextRequest, NextResponse } from 'next/server'

const T_BACKEND_API_KEY = process.env.T_BACKEND_API_KEY
const T_BACKEND_BASE_URL = process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'

/**
 * POST /api/ai/chat
 * 
 * Proxy to T Backend chat endpoint
 * Input: message, session_id (optional)
 * Output: reply from T Backend
 */
export async function POST(request: NextRequest) {
  try {
    // Check API key is configured
    if (!T_BACKEND_API_KEY) {
      console.error('❌ [AI CHAT] T Backend API not configured: Missing T_BACKEND_API_KEY')
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { message, session_id } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid message field' },
        { status: 400 }
      )
    }

    console.log('💬 [AI CHAT] Sending message to T Backend')
    console.log(`   Message: ${message.substring(0, 100)}...`)
    console.log(`   Session ID: ${session_id || 'none'}`)

    // Call T Backend chat API
    const tBackendUrl = `${T_BACKEND_BASE_URL}/chat`
    const tBackendPayload: any = {
      message,
    }
    
    // Add session_id if provided
    if (session_id) {
      tBackendPayload.session_id = session_id
    }

    const tBackendResponse = await fetch(tBackendUrl, {
      method: 'POST',
      headers: {
        'api-key': T_BACKEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tBackendPayload),
    })

    // Handle T Backend errors
    if (!tBackendResponse.ok) {
      const errorText = await tBackendResponse.text()
      let errorDetail = errorText
      
      try {
        const errorJson = JSON.parse(errorText)
        errorDetail = errorJson.detail || errorJson.error || errorText
        console.error('❌ [AI CHAT] T Backend error JSON:', errorJson)
      } catch {
        console.error('❌ [AI CHAT] T Backend error (non-JSON):', errorText)
      }

      console.error('❌ [AI CHAT] T Backend error summary:', {
        status: tBackendResponse.status,
        statusText: tBackendResponse.statusText,
        detail: errorDetail,
        url: tBackendUrl,
      })

      // Map common errors to user-friendly messages
      let userMessage = 'Failed to get AI response'
      
      if (tBackendResponse.status === 400) {
        userMessage = 'Invalid message format'
      } else if (tBackendResponse.status === 401) {
        userMessage = 'AI service authentication failed'
      } else if (tBackendResponse.status === 429) {
        userMessage = 'Rate limit exceeded. Please try again in a moment.'
      } else if (tBackendResponse.status === 500) {
        userMessage = 'AI service error. Please try again.'
      }

      return NextResponse.json(
        { error: userMessage, detail: errorDetail },
        { status: tBackendResponse.status }
      )
    }

    // Parse successful response
    const tBackendData = await tBackendResponse.json()
    
    console.log('✅ [AI CHAT] T Backend response received')
    console.log(`   Reply length: ${tBackendData.reply?.length || 0} chars`)
    console.log(`   Session ID: ${tBackendData.session_id || 'none'}`)

    return NextResponse.json({
      success: true,
      reply: tBackendData.reply || tBackendData.message || 'No response received',
      session_id: tBackendData.session_id || session_id,
    })
  } catch (error: any) {
    console.error('❌ [AI CHAT] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while processing your message',
        detail: error.message,
      },
      { status: 500 }
    )
  }
}

