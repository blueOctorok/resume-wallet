import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { generateDotApplicationPDF } from '@/lib/dot-application-pdf'
import { formatCompanyMailingAddress } from '@/lib/dot-application-format'
import type { DotForm1Data, DotForm2Data, DotForm3Data } from '@/lib/dot-form-mapper'

type CompanyStamp = {
  company_name: string
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
}

/**
 * GET /api/admin/dot-apps/[id]/export
 * Export a DOT application as PDF
 * 
 * Query params:
 *   format - 'pdf' (default) or 'json'
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'pdf'

  try {
    const supabase = await getAdminSupabaseClient()

    // Fetch the full application
    const { data: app, error } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Get user info for the application
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', app.user_id)
      .single()

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', app.user_id)
      .maybeSingle()

    const candidateName = userProfile?.first_name && userProfile?.last_name
      ? `${userProfile.first_name} ${userProfile.last_name}`
      : 'Applicant'

    // Check if this came from an invite (to get company name)
    const { data: invite } = await supabase
      .from('application_invites')
      .select('companies(company_name, address_street, address_city, address_state, address_zip)')
      .eq('driver_application_id', id)
      .maybeSingle()
    // PostgREST types a to-one join as an array; pick the first row either way.
    const joinedCompany = invite?.companies as CompanyStamp | CompanyStamp[] | null | undefined
    const company = Array.isArray(joinedCompany) ? joinedCompany[0] : joinedCompany
    const companyName = company?.company_name
    const companyAddress = formatCompanyMailingAddress(company)

    if (format === 'json') {
      // Return raw JSON data
      return NextResponse.json({
        success: true,
        application: {
          id: app.id,
          userId: app.user_id,
          candidateName,
          companyName,
          applicationData: app.application_data,
          isComplete: app.is_complete,
          verificationStatus: app.verification_status,
          blockchainTxHash: app.blockchain_tx_hash,
          createdAt: app.created_at,
          updatedAt: app.updated_at,
        }
      })
    }

    // Generate PDF. Stored shape is { form1, form2, form3 } — the old `form1Data`
    // keys never existed here, which is why admin exports came out blank.
    const applicationData = (app.application_data || {}) as Record<string, unknown>
    const pdfBuffer = generateDotApplicationPDF(
      {
        form1: (applicationData.form1 as DotForm1Data | undefined) ?? null,
        form2: (applicationData.form2 as DotForm2Data | undefined) ?? null,
        form3: (applicationData.form3 as DotForm3Data | undefined) ?? null,
        createdAt: app.created_at,
        isComplete: Boolean(app.is_complete),
      },
      { companyName, companyAddress, candidateName },
    )

    // Create filename
    const safeName = candidateName.replace(/[^a-zA-Z0-9]/g, '_')
    const date = new Date().toISOString().split('T')[0]
    const filename = `DOT_Application_${safeName}_${date}.pdf`

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('[DOT APP EXPORT] Error:', error)
    return NextResponse.json({ error: 'Failed to export application' }, { status: 500 })
  }
}
