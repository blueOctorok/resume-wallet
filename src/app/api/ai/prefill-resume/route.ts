import { NextRequest, NextResponse } from 'next/server'
import {
  mapTBackendToFormData,
  countExtractedFields,
  type TBackendPrefillResponse,
} from '@/lib/ai-prefill-mapper'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const T_BACKEND_API_KEY = process.env.T_BACKEND_API_KEY
const T_BACKEND_BASE_URL = process.env.T_BACKEND_BASE_URL || 'https://api-v3.fluxpointstudios.com'

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
 * CACHING STRATEGY (Two-Layer):
 * 1. PRIMARY: t_prefill_cache table (persistent, survives resume deletions)
 * 2. FALLBACK: resumes.extracted_data column (deleted when resume is deleted)
 * 
 * Cache checks happen at 3 strategic points to handle parallel requests:
 * - Initial check (before T Backend call)
 * - Mid-flow check (after first attempt fails, before retry)
 * - Final check (after retry fails, before error)
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

    // Use admin client to bypass RLS (called from API route that validates requests)
    const supabase = await getAdminSupabaseClient()

    // Check persistent cache first (t_prefill_cache - survives resume deletions)
    if (cid) {
      console.log('📦 [AI PREFILL] Checking persistent cache for IPFS hash:', cid)
      const { data: persistentCache, error: persistentError } = await supabase
        .from('t_prefill_cache')
        .select('payload')
        .eq('ipfs_hash', cid)
        .single()

      if (!persistentError && persistentCache?.payload) {
        console.log('✅ [AI PREFILL] Persistent cache hit! (t_prefill_cache)')
        const cached = persistentCache.payload as any
        return NextResponse.json({
          success: true,
          form1Data: cached.form1Data,
          form2Data: cached.form2Data,
          form3Data: cached.form3Data,
          stats: cached.stats,
          metadata: {
            cached: true,
            source: 'persistent_cache',
            vectorStoreId: cached.metadata?.vectorStoreId,
            fileId: cached.metadata?.fileId,
          },
        })
      }

      // Fallback: Check resumes table (legacy cache)
      console.log('📦 [AI PREFILL] Checking resumes table cache...')
      const { data: cachedResume, error: cacheError } = await supabase
        .from('resumes')
        .select('extracted_data')
        .eq('ipfs_hash', cid)
        .single()

      if (!cacheError && cachedResume?.extracted_data) {
        console.log('✅ [AI PREFILL] Cache hit in resumes table')
        const cached = cachedResume.extracted_data as any
        return NextResponse.json({
          success: true,
          form1Data: cached.form1Data,
          form2Data: cached.form2Data,
          form3Data: cached.form3Data,
          stats: cached.stats,
          metadata: {
            cached: true,
            source: 'resumes_table',
            vectorStoreId: cached.metadata?.vectorStoreId,
            fileId: cached.metadata?.fileId,
          },
        })
      }
      
      console.log('📭 [AI PREFILL] Cache miss - will call T Backend')
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
      
      // Check persistent cache first
      const { data: persistentRecheck, error: persistentRecheckError } = await supabase
        .from('t_prefill_cache')
        .select('payload')
        .eq('ipfs_hash', cid)
        .single()
      
      if (!persistentRecheckError && persistentRecheck?.payload) {
        console.log('✅ [AI PREFILL] Persistent cache hit on recheck!')
        const cached = persistentRecheck.payload as any
        return NextResponse.json({
          success: true,
          form1Data: cached.form1Data,
          form2Data: cached.form2Data,
          form3Data: cached.form3Data,
          stats: cached.stats,
          metadata: {
            cached: true,
            source: 'persistent_cache_recheck',
            vectorStoreId: cached.metadata?.vectorStoreId,
            fileId: cached.metadata?.fileId,
          },
        })
      }

      // Fallback to resumes table
      const { data: recheck, error: recheckError } = await supabase
        .from('resumes')
        .select('extracted_data')
        .eq('ipfs_hash', cid)
        .single()
      
      if (!recheckError && recheck?.extracted_data) {
        console.log('✅ [AI PREFILL] Cache hit on recheck! (resumes table)')
        const cached = recheck.extracted_data as any
        return NextResponse.json({
          success: true,
          form1Data: cached.form1Data,
          form2Data: cached.form2Data,
          form3Data: cached.form3Data,
          stats: cached.stats,
          metadata: {
            cached: true,
            source: 'resumes_table_recheck',
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
      
      // Check persistent cache first
      const { data: finalPersistentRecheck, error: finalPersistentError } = await supabase
        .from('t_prefill_cache')
        .select('payload')
        .eq('ipfs_hash', cid)
        .single()
      
      if (!finalPersistentError && finalPersistentRecheck?.payload) {
        console.log('✅ [AI PREFILL] Final persistent cache hit!')
        const cached = finalPersistentRecheck.payload as any
        return NextResponse.json({
          success: true,
          form1Data: cached.form1Data,
          form2Data: cached.form2Data,
          form3Data: cached.form3Data,
          stats: cached.stats,
          metadata: {
            cached: true,
            source: 'persistent_cache_final',
            vectorStoreId: cached.metadata?.vectorStoreId,
            fileId: cached.metadata?.fileId,
          },
        })
      }

      // Fallback to resumes table
      const { data: finalRecheck, error: finalRecheckError } = await supabase
        .from('resumes')
        .select('extracted_data')
        .eq('ipfs_hash', cid)
        .single()
      
      if (!finalRecheckError && finalRecheck?.extracted_data) {
        console.log('✅ [AI PREFILL] Final cache hit! (resumes table)')
        const cached = finalRecheck.extracted_data as any
        return NextResponse.json({
          success: true,
          form1Data: cached.form1Data,
          form2Data: cached.form2Data,
          form3Data: cached.form3Data,
          stats: cached.stats,
          metadata: {
            cached: true,
            source: 'resumes_table_final',
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
      
      // SPECIAL CASE: T Backend knows this file but we lost our cache
      // This happens when a resume was previously processed but our cache was deleted
      if (tBackendData.file_id && tBackendData.vector_store_id && !tBackendData.raw) {
        console.error('🔒 [AI PREFILL] T Backend Cache Lock Detected')
        console.error('   This file was previously processed by T Backend (file_id exists)')
        console.error('   But we have no local cache and T Backend won\'t reprocess it')
        console.error('   User needs to upload a modified version of the file')
        
        return NextResponse.json(
          {
            error: 'Resume already processed',
            errorType: 'T_BACKEND_CACHE_LOCK',
            detail: 'This resume was previously analyzed, but we lost the extracted data. To continue, please make a small edit to your resume and save it as a new file.',
            userMessage: 'We\'ve seen this resume before but lost our copy of the analysis.',
            actionRequired: 'Please make any tiny change to your resume (add a space, update a date, fix a typo) and save it as a new PDF file, then upload the new version.',
            technicalDetails: {
              fileId: tBackendData.file_id,
              vectorStore: tBackendData.vector_store_id,
              reason: 'T Backend cache hit with no local cache'
            }
          },
          { status: 409 } // 409 Conflict - resource exists but can't be used
        )
      }
      
      // Check if raw text exists - if so, it's a parsing issue, not a cache lock
      if (tBackendData.raw && tBackendData.raw.length > 0) {
        return NextResponse.json(
          {
            error: 'Could not extract structured data from resume.',
            detail: 'Text was extracted but parsing failed. The file may be in an unsupported format. Please try a different resume or fill forms manually.',
          },
          { status: 422 }
        )
      }
      
      // No raw text and no file_id - could be scanned PDF or empty file
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
      
      const cachePayload = {
        form1Data,
        form2Data,
        form3Data,
        stats,
        metadata: {
          vectorStoreId: tBackendData.vector_store_id,
          fileId: tBackendData.file_id,
        },
        extractedAt: new Date().toISOString(),
      }

      // Save to persistent cache table (PRIMARY - survives resume deletions)
      supabase
        .from('t_prefill_cache')
        .upsert({
          cache_key: tBackendData.file_id, // T Backend's file_id is guaranteed unique
          ipfs_hash: cid,
          file_id: tBackendData.file_id,
          payload: cachePayload,
        })
        .then(({ error }) => {
          if (error) {
            console.error('⚠️ [AI PREFILL] Persistent cache save failed (non-fatal):', error)
          } else {
            console.log('✅ [AI PREFILL] Data cached in persistent cache (t_prefill_cache)')
          }
        })

      // Also save to resumes table for backwards compatibility
      supabase
        .from('resumes')
        .update({
          extracted_data: cachePayload,
        })
        .eq('ipfs_hash', cid)
        .then(({ error }) => {
          if (error) {
            console.error('⚠️ [AI PREFILL] Resumes table cache save failed (non-fatal):', error)
          } else {
            console.log('✅ [AI PREFILL] Data cached in resumes table')
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

