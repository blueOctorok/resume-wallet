import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { generateDotApplicationPDF } from '@/lib/dot-application-pdf'
import type { DotForm1Data, DotForm2Data, DotForm3Data } from '@/lib/dot-form-mapper'

/**
 * GET /api/driver-applications/[id]/export-pdf
 * Owner-only PDF export (same generator as admin and employer exports).
 * No company stamp — this is the driver's own unaddressed copy.
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
        form1: (ad.form1 as DotForm1Data | undefined) ?? null,
        form2: (ad.form2 as DotForm2Data | undefined) ?? null,
        form3: (ad.form3 as DotForm3Data | undefined) ?? null,
        createdAt: app.created_at,
        isComplete: Boolean(app.is_complete),
      },
      { candidateName },
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
