import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { generateDotApplicationPDF } from '@/lib/dot-application-pdf'

/**
 * GET /api/employer/applications/[id]/export
 * Export a DOT application as PDF for employers
 * 
 * Employers can only export applications for candidates who:
 * - Applied to one of their company's jobs
 * - Were recruited via their company's invite
 * 
 * Query params:
 *   format - 'pdf' (default) or 'json'
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pdf'

    const supabase = await getAdminSupabaseClient()

    // Get employer's company
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .single()
      companyId = legacyCompany?.id
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    // Get company name
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    // Fetch the application - verify employer has access via:
    // 1. Application is for one of their jobs
    // 2. Application came from their invite
    const { data: app, error } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Check access: Did this application come from an invite by this company?
    const { data: invite } = await supabase
      .from('application_invites')
      .select('id')
      .eq('driver_application_id', id)
      .eq('company_id', companyId)
      .single()

    // Also check: Is there a job application linking this to the company?
    const { data: jobApplication } = await supabase
      .from('applications')
      .select('id, job_postings!inner(company_id)')
      .eq('driver_application_id', id)
      .single()

    const hasAccessViaInvite = !!invite
    const hasAccessViaJobApp = jobApplication && 
      (jobApplication.job_postings as any)?.company_id === companyId

    if (!hasAccessViaInvite && !hasAccessViaJobApp) {
      // Fallback: Check if the applicant's user applied to any of this company's jobs
      const { data: anyCompanyApp } = await supabase
        .from('applications')
        .select('id, job_postings!inner(company_id)')
        .eq('applicant_user_id', app.user_id)
        .limit(1)

      const hasAnyAccess = anyCompanyApp?.some(
        a => (a.job_postings as any)?.company_id === companyId
      )

      if (!hasAnyAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Get candidate info
    const { data: candidateUser } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', app.user_id)
      .single()

    const { data: profile } = await supabase
      .from('driver_profiles')
      .select('first_name, last_name')
      .eq('user_id', app.user_id)
      .single()

    const candidateName = profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : candidateUser?.name || 'Applicant'

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        application: {
          id: app.id,
          candidateName,
          companyName: company?.name,
          applicationData: app.application_data,
          isComplete: app.is_complete,
          verificationStatus: app.verification_status,
          blockchainTxHash: app.blockchain_tx_hash,
          createdAt: app.created_at,
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
        companyName: company?.name,
        candidateName,
      }
    )

    const safeName = candidateName.replace(/[^a-zA-Z0-9]/g, '_')
    const date = new Date().toISOString().split('T')[0]
    const filename = `DOT_Application_${safeName}_${date}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('[EMPLOYER DOT EXPORT] Error:', error)
    return NextResponse.json({ error: 'Failed to export application' }, { status: 500 })
  }
}
