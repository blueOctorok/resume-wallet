import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendApplicationStatusNotification } from '@/lib/send-admin-notification'
import { createNotification } from '@/lib/create-notification'

const VALID_STATUSES = ['submitted', 'contacted', 'archived'] as const

/** Notify candidate when employer marks them contacted (reached out). Archiving is silent. */
const NOTIFICATION_STATUSES = ['contacted'] as const

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
    const userId = await getStormUserIdFromRequest(request)
    const { id: applicationId } = await params
    const body = await request.json()
    const { status: newStatus } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
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
      .select('id, company_name')
      .eq('id', jobPosting.company_id)
      .single()

    const companyId = jobPosting.company_id

    // Verify employer has access to this company
    const { data: membership } = await supabase
      .from('company_members')
      .select('role')
      .eq('user_id', userId)
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
        .eq('employer_user_id', userId)
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
        contacted: 'The employer reached out',
      }
      const companyName = company?.company_name ?? 'The company'

      const statusBodies: Record<string, string> = {
        contacted: `${companyName} has updated your application for ${jobPosting.title} — they've marked you as contacted. Check your messages or email for next steps.`,
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
          newStatus: newStatus as 'contacted',
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
