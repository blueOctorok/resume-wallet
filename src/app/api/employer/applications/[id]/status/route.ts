import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendApplicationStatusNotification } from '@/lib/send-admin-notification'
import { createNotification } from '@/lib/create-notification'

const VALID_STATUSES = [
  'submitted',
  'under_review',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const

type ApplicationStatus = typeof VALID_STATUSES[number]

// Statuses that trigger email notifications
const NOTIFICATION_STATUSES = ['under_review', 'interview', 'offer', 'hired', 'rejected'] as const

/**
 * PATCH /api/employer/applications/[id]/status
 * 
 * Updates an application's status. Only employers with access to the
 * job posting's company can update status.
 * 
 * Body:
 *   - status: New status value (required)
 * 
 * Sends email notification to candidate for relevant status changes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { id: applicationId } = await params
    const body = await request.json()
    const { status: newStatus } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!applicationId) {
      return NextResponse.json(
        { error: 'Application ID is required' },
        { status: 400 }
      )
    }

    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify employer
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch the application and its job posting separately to avoid !inner join
    // filtering out rows when a nested FK can't be resolved (e.g. talent pool jobs).
    const { data: application } = await supabase
      .from('applications')
      .select('id, status, applicant_user_id, job_posting_id')
      .eq('id', applicationId)
      .single()

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const { data: jobPosting } = await supabase
      .from('job_postings')
      .select('id, title, company_id')
      .eq('id', application.job_posting_id)
      .single()

    if (!jobPosting) {
      return NextResponse.json({ error: 'Job posting not found' }, { status: 404 })
    }

    // Fetch company name for notifications (optional — won't block update if missing)
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', jobPosting.company_id)
      .single()

    const companyId = jobPosting.company_id

    // Verify employer has access to this company
    const { data: membership } = await supabase
      .from('company_members')
      .select('role')
      .eq('user_id', employer.id)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    let hasAccess = !!membership

    // Fallback to legacy owner check
    if (!hasAccess) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('id', companyId)
        .eq('employer_user_id', employer.id)
        .single()

      hasAccess = !!legacyCompany
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this application' },
        { status: 403 }
      )
    }

    // Don't update if status is the same
    if (application.status === newStatus) {
      return NextResponse.json({
        success: true,
        application: { id: application.id, status: application.status },
        message: 'Status unchanged',
      })
    }

    // Update the application status
    const { data: updatedApp, error: updateError } = await supabase
      .from('applications')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        reviewed_at: newStatus !== 'submitted' ? new Date().toISOString() : undefined,
      })
      .eq('id', applicationId)
      .select()
      .single()

    if (updateError) {
      console.error('[APPLICATION STATUS] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update status' },
        { status: 500 }
      )
    }

    console.log(`[APPLICATION STATUS] Updated ${applicationId} from ${application.status} to ${newStatus}`)

    // Send email + in-app notifications for relevant status changes
    if (NOTIFICATION_STATUSES.includes(newStatus as typeof NOTIFICATION_STATUSES[number])) {
      const { data: candidate } = await supabase
        .from('users')
        .select('email')
        .eq('id', application.applicant_user_id)
        .single()

      const { data: candidateProfile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', application.applicant_user_id)
        .maybeSingle()

      const candidateName = [candidateProfile?.first_name, candidateProfile?.last_name].filter(Boolean).join(' ') || 'Candidate'

      const statusTitles: Record<string, string> = {
        under_review: 'Your application is under review',
        interview:    'Interview requested!',
        offer:        'You have a job offer! 🎉',
        hired:        "You're hired! 🎉",
        rejected:     'Application status update',
      }
      const companyName = company?.name ?? 'The company'

      const statusBodies: Record<string, string> = {
        under_review: `${companyName} is reviewing your application for ${jobPosting.title}.`,
        interview:    `${companyName} would like to interview you for ${jobPosting.title}.`,
        offer:        `${companyName} has extended a job offer for ${jobPosting.title}.`,
        hired:        `Congratulations! ${companyName} has hired you for ${jobPosting.title}.`,
        rejected:     `Your application for ${jobPosting.title} at ${companyName} was not selected.`,
      }

      // In-app notification
      createNotification({
        userId: application.applicant_user_id,
        type: 'application_status',
        title: statusTitles[newStatus] || 'Application update',
        body: statusBodies[newStatus] || `Your application status was updated to ${newStatus}.`,
        data: {
          applicationId,
          companyName,
          jobTitle: jobPosting.title,
          status: newStatus,
        },
      }).catch(err => console.error('[APPLICATION STATUS] Notification error:', err))

      // Email notification
      if (candidate?.email) {
        sendApplicationStatusNotification({
          candidateEmail: candidate.email,
          candidateName: candidateName ?? 'Candidate',
          companyName: companyName,
          jobTitle: jobPosting.title,
          newStatus: newStatus as 'under_review' | 'interview' | 'offer' | 'hired' | 'rejected',
        }).then(result => {
          if (result.ok) {
            console.log(`[APPLICATION STATUS] Email sent to ${candidate.email}`)
          } else {
            console.warn(`[APPLICATION STATUS] Email failed: ${result.error}`)
          }
        }).catch(err => {
          console.error('[APPLICATION STATUS] Email error:', err)
        })
      }
    }

    return NextResponse.json({
      success: true,
      application: {
        id: updatedApp.id,
        status: updatedApp.status,
        updatedAt: updatedApp.updated_at,
      },
    })

  } catch (error) {
    console.error('[APPLICATION STATUS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
