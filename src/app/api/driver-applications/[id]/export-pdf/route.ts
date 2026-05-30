import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { generateDotApplicationPDF } from '@/lib/dot-application-pdf'

/**
 * GET /api/driver-applications/[id]/export-pdf
 * Owner-only PDF export (same generator as admin export).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { id } = await params
    const { data: app, error } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const ad = (app.application_data || {}) as Record<string, unknown>
    const form1Data = (ad.form1 ?? ad.form1Data) as Record<string, unknown> | undefined
    const form2Data = (ad.form2 ?? ad.form2Data) as Record<string, unknown> | undefined
    const form3Data = (ad.form3 ?? ad.form3Data) as Record<string, unknown> | undefined

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle()

    const candidateName =
      userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : 'Applicant'

    const pdfBuffer = generateDotApplicationPDF(
      {
        form1Data,
        form2Data,
        form3Data,
        createdAt: app.created_at,
        completedAt: app.updated_at,
        verificationStatus: app.verification_status,
        blockchainTxHash: app.blockchain_tx_hash,
      },
      {
        includeBlockchainInfo: true,
        candidateName,
      },
    )

    const safe = candidateName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 40)
    const filename = `DOT_Application_${safe}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error('[export-pdf]', e)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
