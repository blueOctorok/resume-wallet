import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { reprojectScreeningOntoApp } from '@/lib/reproject-screening-onto-app'
import { completeDriverApplication } from '@/lib/driver-application-db'
import { completeDotOutreachInvites } from '@/lib/complete-dot-outreach-invites'
import { hashJson } from '@/lib/hash-utils'
import { loadSignatureNameAnchor } from '@/lib/load-signature-name-anchor'
import { signatureFieldError } from '@/lib/signature-name-check'

/**
 * POST — final DOT application submit. Replaces the old `'use server'` submit
 * path, which was unauthenticated and broke whenever a long-lived tab called an
 * action id from a previous deploy. Idempotent: resubmitting the same data just
 * re-stamps the row.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { form1Data, form2Data, form3Data } = await request.json()
    if (!form1Data || !form2Data || !form3Data) {
      return NextResponse.json(
        { error: 'All three application sections are required' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()
    const anchor = await loadSignatureNameAnchor(supabase, userId)
    const form3 = form3Data as { applicantSignature?: unknown; applicantNamePrinted?: unknown }
    const signedName = typeof form3.applicantSignature === 'string' ? form3.applicantSignature : ''
    const printedName = typeof form3.applicantNamePrinted === 'string' ? form3.applicantNamePrinted : ''
    const nameError =
      signatureFieldError(signedName, anchor, 'signature') ||
      signatureFieldError(printedName, anchor, 'printed')
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }

    const applicationData = await reprojectScreeningOntoApp(supabase, userId, {
      form1: form1Data,
      form2: form2Data,
      form3: form3Data,
    })
    const applicationHash = await hashJson(applicationData)
    const application = await completeDriverApplication(
      supabase,
      userId,
      applicationData,
      applicationHash,
    )

    console.log(`[DOT COMPLETE] Application ${application.id} submitted for ${userId}`)

    // Mark the company's open DOT invites completed. The driver sees the
    // confirmation page either way; this is what tells the employer the work is done.
    await completeDotOutreachInvites(supabase, userId, application.id)

    return NextResponse.json({
      success: true,
      application: { id: application.id, isComplete: application.is_complete },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit application'
    console.error('[DOT COMPLETE] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
