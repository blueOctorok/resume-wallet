import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { loadDotAppForViewer } from '@/lib/load-dot-app-for-viewer'
import { generateDotApplicationPDF } from '@/lib/dot-application-pdf'
import type { DotForm1Data, DotForm2Data, DotForm3Data } from '@/lib/dot-form-mapper'

/**
 * GET /api/employer/talent/[userId]/dot-app/pdf?applicationId=
 *
 * The same copy the employer can see on screen, as a PDF stamped with their
 * company name. Goes through `loadDotAppForViewer`, so an employer who can't
 * open the preview can't download it either, and the download is redacted
 * exactly like the preview.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const requesterUserId = await getStormUserIdFromRequest(request)
    if (!requesterUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { userId } = await params
    const applicationId = request.nextUrl.searchParams.get('applicationId')

    const result = await loadDotAppForViewer(supabase, requesterUserId, userId, applicationId)
    if (result.ok === false) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    const { app } = result

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle()
    const candidateName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || undefined

    const pdf = generateDotApplicationPDF(
      {
        form1: app.form1 as unknown as DotForm1Data | null,
        form2: app.form2 as unknown as DotForm2Data | null,
        form3: app.form3 as unknown as DotForm3Data | null,
        createdAt: app.createdAt,
        isComplete: app.isComplete,
      },
      {
        candidateName,
        companyName: app.addressedToCompany,
        withheldNote: app.redactedFields.length
          ? 'Social Security number, date of birth, and street addresses are held by the driver and released only through a consented screening order.'
          : null,
      },
    )

    const safeName = (candidateName ?? 'Driver').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 40)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DQ_File_${safeName}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[DOT APP PDF] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
