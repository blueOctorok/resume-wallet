import { NextRequest, NextResponse } from 'next/server'
import {
  mapTBackendToFormData,
  countExtractedFields,
  type TBackendPrefillResponse,
} from '@/lib/ai-prefill-mapper'

const T_BACKEND_API_KEY = process.env.T_BACKEND_API_KEY
const T_BACKEND_BASE_URL = process.env.T_BACKEND_BASE_URL

/**
 * POST /api/ai/prefill-resume
 * 
 * Call T Backend AI to extract structured data from a resume
 * Input: IPFS CID or direct URL
 * Output: Mapped form data for all 3 driver application forms
 * 
 * Note: This route may take 20-30 seconds. Requires Vercel Pro plan for 60s timeout.
 */
export const maxDuration = 60 // 60 seconds (Pro plan max)

export async function POST(request: NextRequest) {
  try {
    // Check API key is configured
    if (!T_BACKEND_API_KEY || !T_BACKEND_BASE_URL) {
      console.error('❌ T Backend API not configured')
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { cid, resumeUrl } = body

    if (!cid && !resumeUrl) {
      return NextResponse.json(
        { error: 'Missing required field: cid or resumeUrl' },
        { status: 400 }
      )
    }

    console.log('🤖 [AI PREFILL] Starting resume extraction...')
    console.log(`   Input: ${cid ? `CID=${cid}` : `URL=${resumeUrl}`}`)

    // Prepare request to T Backend
    const tBackendPayload: any = {}
    if (cid) {
      tBackendPayload.cid = cid
    } else {
      tBackendPayload.resume_url = resumeUrl
    }

    // Call T Backend prefill API
    const tBackendUrl = `${T_BACKEND_BASE_URL}/applications/driver/prefill`
    console.log(`   Calling: ${tBackendUrl}`)

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
        console.error('❌ [AI PREFILL] T Backend error JSON:', errorJson)
      } catch {
        // Keep errorText as is
        console.error('❌ [AI PREFILL] T Backend error (non-JSON):', errorText)
      }

      console.error('❌ [AI PREFILL] T Backend error summary:', {
        status: tBackendResponse.status,
        statusText: tBackendResponse.statusText,
        detail: errorDetail,
        url: tBackendUrl,
        payload: tBackendPayload,
      })

      // Map common errors to user-friendly messages
      let userMessage = 'Failed to process resume'
      
      if (tBackendResponse.status === 400) {
        userMessage = 'Invalid resume file or URL'
      } else if (tBackendResponse.status === 404) {
        userMessage = 'Resume file not found'
      } else if (tBackendResponse.status === 415) {
        userMessage = 'Unsupported file format. Please upload a text-based PDF, DOCX, or TXT file.'
      } else if (tBackendResponse.status === 422) {
        if (errorDetail.includes('empty_text')) {
          userMessage = 'Could not extract text from resume. Please ensure it\'s not a scanned image.'
        } else if (errorDetail.includes('ocr_unavailable')) {
          userMessage = 'Scanned PDFs are not supported yet. Please upload a text-based PDF.'
        } else {
          userMessage = 'Could not parse resume. Please try a different format.'
        }
      }

      return NextResponse.json(
        { error: userMessage, detail: errorDetail },
        { status: tBackendResponse.status }
      )
    }

    // Parse successful response
    const tBackendData: TBackendPrefillResponse = await tBackendResponse.json()
    
    console.log('✅ [AI PREFILL] T Backend response received')
    console.log('   Full T Backend response:', JSON.stringify(tBackendData, null, 2))
    console.log('   Vector Store ID:', tBackendData.vector_store_id)
    console.log('   File ID:', tBackendData.file_id)
    console.log('   Application data:', tBackendData.application)
    console.log('   Raw text:', tBackendData.raw)
    
    // Check if application data is all null/empty
    const app = tBackendData.application
    const hasData = app && (
      app.fullName || 
      app.email || 
      app.phone || 
      app.address || 
      app.dateOfBirth || 
      app.licenseNumber || 
      app.licenseState || 
      (app.endorsements && app.endorsements.length > 0) ||
      (app.workHistory && app.workHistory.length > 0)
    )
    
    if (!hasData) {
      console.warn('⚠️ [AI PREFILL] T Backend returned empty application data')
      console.warn('   This might mean: scanned PDF, empty file, or parsing issue')
      console.warn('   Raw response:', JSON.stringify(app, null, 2))
    }

    // Map T Backend response to our form structure
    const { form1Data, form2Data, form3Data } = mapTBackendToFormData(tBackendData)
    
    // Count extracted fields for user feedback
    const stats = countExtractedFields(tBackendData)
    
    console.log(`✅ [AI PREFILL] Extracted ${stats.extracted}/${stats.total} fields:`)
    console.log(`   Fields: ${stats.fieldNames.join(', ')}`)

    return NextResponse.json({
      success: true,
      form1Data,
      form2Data,
      form3Data,
      stats,
      metadata: {
        vectorStoreId: tBackendData.vector_store_id,
        fileId: tBackendData.file_id,
        raw: tBackendData.raw,
      },
    })
  } catch (error: any) {
    console.error('❌ [AI PREFILL] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while processing the resume',
        detail: error.message,
      },
      { status: 500 }
    )
  }
}

