import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { nanoid } from 'nanoid'
import { sendCandidateRequestNotification } from '@/lib/send-admin-notification'

// Special title used to identify the auto-created talent pool job
const TALENT_POOL_TITLE = '— Talent Pool —'

/**
 * POST /api/employer/talent/[userId]/recruit
 * 
 * Creates an employer-initiated application from a career card.
 * This is when an employer wants to recruit a candidate for a specific job
 * OR save them to a "Talent Pool" for future opportunities.
 * 
 * Body:
 *   - jobPostingId: UUID of the job posting (optional if talentPool = true)
 *   - talentPool: boolean - if true, uses/creates a hidden "Talent Pool" job
 *   - message: Optional message to the candidate
 * 
 * This will:
 *   1. Create an application with initiated_by = 'employer'
 *   2. Capture a snapshot of the candidate's career card
 *   3. Send email notification to the candidate
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { userId: candidateUserId } = await params
    const body = await request.json()

    const { jobPostingId, talentPool, message } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!candidateUserId) {
      return NextResponse.json(
        { error: 'Candidate user ID is required' },
        { status: 400 }
      )
    }

    // Must provide either a specific job OR request talent pool
    if (!jobPostingId && !talentPool) {
      return NextResponse.json(
        { error: 'Job posting ID is required (or set talentPool: true)' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify employer and get company
    const { data: employer } = await supabase
      .from('users')
      .select('id, name, email')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get company membership
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', employer.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employer.id)
        .single()

      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    // Resolve the job posting — either from ID or talent pool
    let jobPosting: { id: string; title: string; company_id: string; is_active: boolean }

    if (talentPool) {
      // Look for existing talent pool job for this company
      const { data: existingPool } = await supabase
        .from('job_postings')
        .select('id, title, company_id, is_active')
        .eq('company_id', companyId)
        .eq('title', TALENT_POOL_TITLE)
        .single()

      if (existingPool) {
        jobPosting = existingPool
      } else {
        // Create a hidden talent pool job for this company
        const { data: newPool, error: createErr } = await supabase
          .from('job_postings')
          .insert({
            company_id: companyId,
            title: TALENT_POOL_TITLE,
            description: 'Auto-created talent pool for saving promising candidates before matching to a specific role.',
            is_active: false, // Hidden from public job board
          })
          .select('id, title, company_id, is_active')
          .single()

        if (createErr || !newPool) {
          console.error('[RECRUIT] Failed to create talent pool job:', createErr)
          return NextResponse.json({ error: 'Failed to create talent pool' }, { status: 500 })
        }
        jobPosting = newPool
        console.log(`[RECRUIT] Created talent pool job ${newPool.id} for company ${companyId}`)
      }
    } else {
      // Verify specific job posting belongs to this company
      const { data: jp, error: jobError } = await supabase
        .from('job_postings')
        .select('id, title, company_id, is_active')
        .eq('id', jobPostingId)
        .single()

      if (jobError || !jp) {
        console.error('[RECRUIT] Job posting lookup error:', jobError)
        return NextResponse.json({ error: 'Job posting not found' }, { status: 404 })
      }

      if (jp.company_id !== companyId) {
        return NextResponse.json(
          { error: 'Job posting does not belong to your company' },
          { status: 403 }
        )
      }

      if (!jp.is_active) {
        return NextResponse.json(
          { error: 'Job posting is not active' },
          { status: 400 }
        )
      }

      jobPosting = jp
    }

    // Verify candidate exists and is a driver/developer
    const { data: candidate } = await supabase
      .from('users')
      .select('id, role, email, name')
      .eq('id', candidateUserId)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (!['driver', 'developer'].includes(candidate.role || '')) {
      return NextResponse.json(
        { error: 'User is not a candidate (driver or developer)' },
        { status: 400 }
      )
    }

    // Check for existing application
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id, status, initiated_by')
      .eq('job_posting_id', jobPostingId)
      .eq('applicant_user_id', candidateUserId)
      .single()

    if (existingApp) {
      return NextResponse.json(
        { 
          error: 'Application already exists',
          existingApplication: {
            id: existingApp.id,
            status: existingApp.status,
            initiatedBy: existingApp.initiated_by,
          }
        },
        { status: 409 }
      )
    }

    // Gather career card snapshot data
    const careerCardSnapshot: Record<string, unknown> = {
      capturedAt: new Date().toISOString(),
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      candidateRole: candidate.role,
    }

    // Get driver profile if applicable
    if (candidate.role === 'driver') {
      const { data: driverProfile } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', candidateUserId)
        .single()

      if (driverProfile) {
        careerCardSnapshot.driverProfile = {
          cdlClass: driverProfile.cdl_class,
          cdlState: driverProfile.cdl_state,
          yearsExperience: driverProfile.years_experience,
          endorsements: driverProfile.endorsements,
        }
      }

      // Get driver application data
      const { data: driverApp } = await supabase
        .from('driver_applications')
        .select('id, verification_status')
        .eq('user_id', candidateUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (driverApp) {
        careerCardSnapshot.driverApplicationId = driverApp.id
        careerCardSnapshot.driverApplicationStatus = driverApp.verification_status
      }

      // Get latest MVR
      const { data: mvr } = await supabase
        .from('mvr_orders')
        .select('id, order_status')
        .eq('driver_user_id', candidateUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (mvr) {
        careerCardSnapshot.hasMvr = true
        careerCardSnapshot.mvrStatus = mvr.order_status
      }
    }

    // Get developer profile if applicable
    if (candidate.role === 'developer') {
      const { data: devProfile } = await supabase
        .from('developer_profiles')
        .select('*')
        .eq('user_id', candidateUserId)
        .single()

      if (devProfile) {
        careerCardSnapshot.developerProfile = {
          skills: devProfile.skills,
          yearsExperience: devProfile.years_experience,
          githubUrl: devProfile.github_url,
          portfolioUrl: devProfile.portfolio_url,
        }
      }
    }

    // Get latest resume
    const { data: resume } = await supabase
      .from('resumes')
      .select('id, title, filename')
      .eq('user_id', candidateUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (resume) {
      careerCardSnapshot.resumeId = resume.id
      careerCardSnapshot.resumeTitle = resume.title
    }

    // Get company name for notification
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    // Create the application
    const shareToken = nanoid(16)
    
    const { data: application, error: insertError } = await supabase
      .from('applications')
      .insert({
        job_posting_id: jobPosting.id,
        applicant_user_id: candidateUserId,
        driver_application_id: careerCardSnapshot.driverApplicationId || null,
        resume_id: resume?.id || null,
        cover_letter: message || null,
        status: 'submitted',
        share_token: shareToken,
        initiated_by: 'employer',
        recruited_by_user_id: employer.id,
        career_card_snapshot: careerCardSnapshot,
        application_data: {
          recruiterMessage: message || null,
          jobTitle: jobPosting.title,
          companyName: company?.name,
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('[RECRUIT] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create application' },
        { status: 500 }
      )
    }

    console.log(`[RECRUIT] Created application ${application.id} for candidate ${candidateUserId} via employer ${employer.id}`)

    // Send email notification to candidate (non-blocking)
    if (candidate.email) {
      sendCandidateRequestNotification({
        candidateEmail: candidate.email,
        candidateName: candidate.name || 'Candidate',
        companyName: company?.name || 'A company',
        requestType: 'custom',
        message: `${company?.name || 'A company'} is interested in you for the position of ${jobPosting.title}! They've created an application on your behalf.${message ? ` Their message: "${message}"` : ''}`,
      }).then(result => {
        if (result.ok) {
          console.log(`[RECRUIT] Email sent to ${candidate.email}`)
        } else {
          console.warn(`[RECRUIT] Email failed: ${result.error}`)
        }
      }).catch(err => {
        console.error('[RECRUIT] Email error:', err)
      })
    }

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        jobPostingId: application.job_posting_id,
        candidateUserId: application.applicant_user_id,
        status: application.status,
        initiatedBy: application.initiated_by,
        shareToken: application.share_token,
        createdAt: application.applied_at,
      },
    })

  } catch (error) {
    console.error('[RECRUIT] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
