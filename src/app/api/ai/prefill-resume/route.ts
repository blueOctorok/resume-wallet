import { NextRequest, NextResponse } from 'next/server'
import {
  mapTBackendToFormData,
  countExtractedFields,
  type TBackendPrefillResponse,
} from '@/lib/ai-prefill-mapper'
import { createClient } from '@/utils/supabase/server'

const T_BACKEND_API_KEY = process.env.T_BACKEND_API_KEY
const T_BACKEND_BASE_URL = process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'

/**
 * POST /api/ai/prefill-resume
 * 
 * Call T Backend AI to extract structured data from a resume
 * Input: IPFS CID or direct URL
 * Output: Mapped form data for all 3 driver application forms
 * 
 * Note: This route may take 20-30 seconds. Requires Vercel Pro plan for 60s timeout.
 * Timeout is configured in vercel.json
 * 
 * CACHING: Extracted data is cached in Supabase to avoid re-processing duplicates
 */
export async function POST(request: NextRequest) {
  try {
    // Check API key is configured
    if (!T_BACKEND_API_KEY) {
      console.error('❌ T Backend API not configured: Missing T_BACKEND_API_KEY')
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

    // Check cache first (Supabase resumes table)
    if (cid) {
      console.log('📦 [AI PREFILL] Checking cache for IPFS hash:', cid)
      const supabase = await createClient()
      const { data: cachedResume, error: cacheError } = await supabase
        .from('resumes')
        .select('extracted_data')
        .eq('ipfs_hash', cid)
        .single()

      if (!cacheError && cachedResume?.extracted_data) {
        console.log('✅ [AI PREFILL] Cache hit! Returning cached data')
        const cached = cachedResume.extracted_data as any
        return NextResponse.json({
          success: true,
          form1Data: cached.form1Data,
          form2Data: cached.form2Data,
          form3Data: cached.form3Data,
          stats: cached.stats,
          metadata: {
            cached: true,
            vectorStoreId: cached.metadata?.vectorStoreId,
            fileId: cached.metadata?.fileId,
          },
        })
      } else {
        console.log('📭 [AI PREFILL] Cache miss - will call T Backend')
      }
    }

    // Prepare request to T Backend
    // Use Pinata gateway instead of public IPFS gateway for faster, more reliable downloads
    const tBackendPayload: any = {}
    if (cid) {
      // Use Pinata's dedicated gateway (much faster than ipfs.io)
      const pinataGateway = `https://gateway.pinata.cloud/ipfs/${cid}`
      tBackendPayload.resume_url = pinataGateway
      console.log('🔗 [AI PREFILL] Using Pinata gateway:', pinataGateway)
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
    let tBackendData: TBackendPrefillResponse = await tBackendResponse.json()
    
    console.log('✅ [AI PREFILL] T Backend response received')
    
    // Helper function to check if application data exists
    const checkHasData = (appData: any) => {
      return appData && (
        appData.fullName || 
        appData.email || 
        appData.phone || 
        appData.address || 
        appData.dateOfBirth || 
        appData.licenseNumber || 
        appData.licenseState || 
        (appData.endorsements && appData.endorsements.length > 0) ||
        (appData.workHistory && appData.workHistory.length > 0)
      )
    }
    
    const app = tBackendData.application
    const hasData = checkHasData(app)
    
    // If first attempt returned no data, check cache again before retrying
    // (Another parallel request may have just cached the data)
    if (!hasData && cid) {
      console.log('🔄 [AI PREFILL] First attempt returned no data, checking cache again...')
      const supabase = await createClient()
      const { data: recheck, error: recheckError } = await supabase
        .from('resumes')
        .select('extracted_data')
        .eq('ipfs_hash', cid)
        .single()
      
      if (!recheckError && recheck?.extracted_data) {
        console.log('✅ [AI PREFILL] Cache hit on recheck! (Another request cached it)')
        const cached = recheck.extracted_data as any
        return NextResponse.json({
          success: true,
          form1Data: cached.form1Data,
          form2Data: cached.form2Data,
          form3Data: cached.form3Data,
          stats: cached.stats,
          metadata: {
            cached: true,
            vectorStoreId: cached.metadata?.vectorStoreId,
            fileId: cached.metadata?.fileId,
          },
        })
      }
      
      // Still no cache hit, try retry with nocache parameter
      console.log('🔄 [AI PREFILL] Cache still empty, retrying with nocache parameter...')
      try {
        const fallbackUrl = `https://gateway.pinata.cloud/ipfs/${cid}?nocache=${Date.now()}`
        const retryResp = await fetch(tBackendUrl, {
          method: 'POST',
          headers: {
            'api-key': T_BACKEND_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ resume_url: fallbackUrl }),
        })
        if (retryResp.ok) {
          const retryData: TBackendPrefillResponse = await retryResp.json()
          const retryHasData = checkHasData(retryData.application)
          if (retryHasData) {
            console.log('✅ [AI PREFILL] Retry successful!')
            tBackendData = retryData
          }
        }
      } catch (retryErr) {
        console.warn('⚠️ [AI PREFILL] Retry attempt failed:', retryErr)
      }
    }

    // Final check: if we still have no data after retry, check cache ONE MORE TIME
    // (A parallel request may have just finished and cached the data)
    const finalHasData = checkHasData(tBackendData.application)
    
    if (!finalHasData && cid) {
      console.log('🔄 [AI PREFILL] Final cache check before error (parallel request may have cached)...')
      const supabase = await createClient()
      const { data: finalRecheck, error: finalRecheckError } = await supabase
        .from('resumes')
        .select('extracted_data')
        .eq('ipfs_hash', cid)
        .single()
      
      if (!finalRecheckError && finalRecheck?.extracted_data) {
        console.log('✅ [AI PREFILL] Final cache hit! Parallel request cached the data')
        const cached = finalRecheck.extracted_data as any
        return NextResponse.json({
          success: true,
          form1Data: cached.form1Data,
          form2Data: cached.form2Data,
          form3Data: cached.form3Data,
          stats: cached.stats,
          metadata: {
            cached: true,
            vectorStoreId: cached.metadata?.vectorStoreId,
            fileId: cached.metadata?.fileId,
          },
        })
      }
      
      // Still no data - this is a real error
      console.error('❌ [AI PREFILL] Failed to extract data after all attempts (including final cache check)')
      console.error('   Raw text available:', !!tBackendData.raw)
      console.error('   Raw text length:', tBackendData.raw?.length || 0)
      console.error('   Vector store:', tBackendData.vector_store_id)
      console.error('   File ID:', tBackendData.file_id)
      
      // Check if raw text exists - if so, it's a parsing issue, not a duplicate
      if (tBackendData.raw && tBackendData.raw.length > 0) {
        return NextResponse.json(
          {
            error: 'Could not extract structured data from resume.',
            detail: 'Text was extracted but parsing failed. The file may be in an unsupported format. Please try a different resume or fill forms manually.',
          },
          { status: 422 }
        )
      }
      // No raw text - could be scanned PDF, duplicate, or empty file
      return NextResponse.json(
        {
          error: 'Could not extract text from resume.',
          detail: 'This may be a scanned PDF (image-based) or empty file. Please ensure your resume is a text-based PDF or DOCX file.',
        },
        { status: 422 }
      )
    } else if (!finalHasData) {
      // No CID provided, can't check cache, and no data extracted
      console.error('❌ [AI PREFILL] Failed to extract data (no CID for cache check)')
      return NextResponse.json(
        {
          error: 'Could not extract text from resume.',
          detail: 'No data was extracted from the resume. Please try again or contact support.',
        },
        { status: 422 }
      )
    }
    
    // Map T Backend response to our form structure
    const { form1Data, form2Data, form3Data } = mapTBackendToFormData(tBackendData)
    
    // Count extracted fields for user feedback
    const stats = countExtractedFields(tBackendData)
    
    console.log(`✅ [AI PREFILL] Extracted ${stats.extracted}/${stats.total} fields:`)
    console.log(`   Fields: ${stats.fieldNames.join(', ')}`)

    const responseData = {
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
    }

    // Cache the extracted data in Supabase (fire-and-forget)
    if (cid) {
      console.log('💾 [AI PREFILL] Caching extracted data for future requests...')
      const supabase = await createClient()
      supabase
        .from('resumes')
        .update({
          extracted_data: {
            form1Data,
            form2Data,
            form3Data,
            stats,
            metadata: {
              vectorStoreId: tBackendData.vector_store_id,
              fileId: tBackendData.file_id,
            },
            extractedAt: new Date().toISOString(),
          },
        })
        .eq('ipfs_hash', cid)
        .then(({ error }) => {
          if (error) {
            console.error('⚠️ [AI PREFILL] Cache save failed (non-fatal):', error)
          } else {
            console.log('✅ [AI PREFILL] Data cached successfully')
          }
        })
    }

    return NextResponse.json(responseData)
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

