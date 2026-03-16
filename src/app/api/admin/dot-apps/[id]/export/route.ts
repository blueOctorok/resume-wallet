import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { generateDotApplicationPDF } from '@/lib/dot-application-pdf'

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
  const auth = requireAdmin(request)
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
    let companyName: string | undefined
    const { data: invite } = await supabase
      .from('application_invites')
      .select('companies(name)')
      .eq('driver_application_id', id)
      .single()
    
    if (invite?.companies) {
      companyName = (invite.companies as any).name
    }

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

    // Generate PDF
    const applicationData = app.application_data || {}
    const pdfBuffer = generateDotApplicationPDF(
      {
        form1Data: applicationData.form1Data,
        form2Data: applicationData.form2Data,
        form3Data: applicationData.form3Data,
        createdAt: app.created_at,
        completedAt: app.updated_at,
        verificationStatus: app.verification_status,
        blockchainTxHash: app.blockchain_tx_hash,
      },
      {
        includeBlockchainInfo: true,
        companyName,
        candidateName,
      }
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
