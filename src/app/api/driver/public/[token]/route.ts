import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * Normalizes resume structured_data from different formats (old uploaded vs new builder)
 * into a consistent format that the career card can display.
 * Same logic as DriverHub.tsx uses for preview.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeResumeStructuredData(raw: any): any {
  if (!raw) return undefined

  // Detect format: new builder uses 'companyName', old format uses 'company'
  const isResumeBuilderFormat =
    Array.isArray(raw.employments) &&
    raw.employments.length > 0 &&
    'companyName' in (raw.employments[0] || {})

  // Detect skills format: new builder uses objects with 'name', old uses grouped { category, items }
  const hasResumeBuilderSkillsFormat =
    Array.isArray(raw.skills) &&
    raw.skills.length > 0 &&
    typeof raw.skills[0] === 'object' &&
    'name' in (raw.skills[0] || {})

  if (isResumeBuilderFormat) {
    // New builder format — already normalized, just pass through with clean structure
    return {
      personalInfo: {
        firstName: raw.personalInfo?.firstName,
        lastName: raw.personalInfo?.lastName,
        email: raw.personalInfo?.email,
        phone: raw.personalInfo?.phone,
        address: raw.personalInfo?.address,
        city: raw.personalInfo?.city,
        state: raw.personalInfo?.state,
        zipCode: raw.personalInfo?.zipCode,
        professionalSummary: raw.personalInfo?.professionalSummary,
      },
      cdlInfo: {
        cdlClass: raw.cdlInfo?.cdlClass,
        cdlState: raw.cdlInfo?.cdlState,
        expirationDate: raw.cdlInfo?.expirationDate,
        endorsements: raw.cdlInfo?.endorsements || [],
        restrictions: raw.cdlInfo?.restrictions || [],
      },
      employments: (raw.employments || []).map((emp: Record<string, unknown>) => ({
        companyName: emp.companyName,
        position: emp.position,
        location: emp.location,
        startDate: emp.startDate,
        endDate: emp.endDate,
        isCurrent: emp.isCurrent,
        responsibilities: emp.responsibilities || [],
      })),
      educations: (raw.educations || []).map((edu: Record<string, unknown>) => ({
        school: edu.school,
        degree: edu.degree,
        field: edu.field,
        year: edu.year,
        certifications: edu.certifications || [],
      })),
      skills: hasResumeBuilderSkillsFormat
        ? (raw.skills || []).map((skill: Record<string, unknown>) => ({
            name: skill.name,
            category: skill.category || 'other',
          }))
        : [],
      references: (raw.references || []).map((ref: Record<string, unknown>) => ({
        name: ref.name,
        title: ref.title,
        company: ref.company,
        phone: ref.phone,
        email: ref.email,
        relationship: ref.relationship,
      })),
    }
  } else {
    // Old uploaded/analyzed format — map to normalized structure
    return {
      personalInfo: {
        firstName: raw.personalInfo?.firstName,
        lastName: raw.personalInfo?.lastName,
        email: raw.personalInfo?.email,
        phone: raw.personalInfo?.phone,
        address: raw.personalInfo?.address,
        city: raw.personalInfo?.city,
        state: raw.personalInfo?.state,
        zipCode: raw.personalInfo?.zipCode,
        professionalSummary: raw.personalInfo?.summary || raw.personalInfo?.professionalSummary,
      },
      cdlInfo: {
        cdlClass: raw.cdlInfo?.cdlClass,
        cdlState: raw.cdlInfo?.cdlState,
        expirationDate: raw.cdlInfo?.cdlExpiration || raw.cdlInfo?.expirationDate,
        endorsements: raw.cdlInfo?.endorsements || [],
        restrictions: raw.cdlInfo?.restrictions || [],
      },
      // Old format: employments[].company → companyName, .current → .isCurrent, .description → responsibilities
      employments: (raw.employments || []).map((emp: Record<string, unknown>) => ({
        companyName: emp.company || emp.companyName,
        position: emp.position,
        location: emp.location,
        startDate: emp.startDate,
        endDate: emp.endDate,
        isCurrent: emp.current ?? emp.isCurrent,
        responsibilities: emp.description
          ? [emp.description]
          : (emp.responsibilities as string[]) || [],
      })),
      educations: (raw.educations || []).map((edu: Record<string, unknown>) => ({
        school: edu.school,
        degree: edu.degree,
        field: edu.field,
        year: edu.graduationDate || edu.year,
        certifications: (edu.certifications as string[]) || [],
      })),
      // Old format: skills is array of { category, items: string[] } — flatten to { name, category }
      skills: Array.isArray(raw.skills)
        ? raw.skills.flatMap((skillGroup: unknown) => {
            if (typeof skillGroup === 'string') {
              return [{ name: skillGroup, category: 'other' }]
            }
            const group = skillGroup as Record<string, unknown>
            if (Array.isArray(group.items)) {
              return (group.items as string[]).map((item) => ({
                name: item,
                category: (group.category as string) || 'other',
              }))
            }
            if (group.name) {
              return [{ name: group.name, category: (group.category as string) || 'other' }]
            }
            return []
          })
        : [],
      references: (raw.references || []).map((ref: Record<string, unknown>) => ({
        name: ref.name,
        title: ref.title || ref.relationship,
        company: ref.company,
        phone: ref.phone,
        email: ref.email,
        relationship: ref.relationship,
      })),
    }
  }
}

/**
 * GET /api/driver/public/[token]
 * 
 * Fetches a driver's public profile by their share token.
 * No authentication required - this is the public view for employers.
 * Respects the driver's share_settings for privacy.
 * 
 * Returns:
 *   - profile: Driver's public profile data (filtered by share_settings)
 *   - resume: Latest verified resume (if showResume enabled)
 *   - dotApp: DOT application summary (if showDotApp enabled)
 *   - mvr: MVR summary (if showMvr enabled)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token || token.length < 8) {
      return NextResponse.json(
        { error: 'Invalid share token' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Find the driver profile by share token
    const { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select(`
        id,
        user_id,
        professional_summary,
        cdl_number,
        cdl_class,
        cdl_state,
        cdl_expiration,
        endorsements,
        experience_years,
        employment_history,
        education,
        skills,
        share_settings,
        share_views_count,
        mvr_license_status,
        mvr_total_points,
        mvr_violation_count,
        mvr_last_ordered_at,
        created_at,
        updated_at
      `)
      .eq('share_token', token)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found or sharing is disabled' },
        { status: 404 }
      )
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email, phone, city, state')
      .eq('user_id', profile.user_id)
      .maybeSingle()

    // Parse share settings
    const settings = profile.share_settings as {
      showResume?: boolean
      showDotApp?: boolean
      showMvr?: boolean
      showContact?: boolean
      allowConnect?: boolean
    } || {
      showResume: true,
      showDotApp: true,
      showMvr: true,
      showContact: false,
      allowConnect: true,
    }

    // Increment view count (fire and forget)
    void supabase
      .from('driver_profiles')
      .update({ share_views_count: (profile.share_views_count || 0) + 1 })
      .eq('id', profile.id)
      .then(() => {}, () => {})

    // Build the public profile based on settings
    const publicProfile: Record<string, any> = {
      id: profile.id,
      firstName: userProfile?.first_name ?? null,
      lastName: userProfile?.last_name ?? null,
      location: userProfile?.city && userProfile?.state
        ? `${userProfile.city}, ${userProfile.state}`
        : null,
      summary: profile.professional_summary,
      experienceYears: profile.experience_years,
      // CDL info is always shown (core to trucking)
      cdl: {
        class: profile.cdl_class,
        state: profile.cdl_state,
        expiration: profile.cdl_expiration,
        endorsements: profile.endorsements || [],
        // Don't show CDL number for privacy
      },
    }

    // Contact info only if enabled
    if (settings.showContact) {
      publicProfile.contact = {
        email: userProfile?.email ?? null,
        phone: userProfile?.phone ?? null,
      }
    }

    // Fetch resume if enabled — show latest DRIVER resume (exclude developer_built)
    let resume = null
    if (settings.showResume) {
      const { data: resumeData } = await supabase
        .from('resumes')
        .select('id, title, filename, ipfs_hash, verification_status, blockchain_tx_hash, created_at, resume_type, structured_data')
        .eq('user_id', profile.user_id)
        .or('resume_type.neq.developer_built,resume_type.is.null') // Exclude developer resumes
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (resumeData) {
        // Normalize structured_data to a consistent format (handles old uploaded vs new builder format)
        const normalizedData = normalizeResumeStructuredData(resumeData.structured_data)
        
        resume = {
          id: resumeData.id,
          title: resumeData.title,
          filename: resumeData.filename,
          verified: resumeData.verification_status === 'VERIFIED',
          blockchainVerified: !!resumeData.blockchain_tx_hash,
          type: resumeData.resume_type,
          createdAt: resumeData.created_at,
          ipfsHash: resumeData.ipfs_hash,
          structuredData: normalizedData,
        }
      }
    }

    // Fetch DOT application summary if enabled
    let dotApp = null
    if (settings.showDotApp) {
      const { data: dotAppData } = await supabase
        .from('driver_applications')
        .select('id, verification_status, blockchain_tx_hash, is_complete, current_step, created_at')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (dotAppData) {
        // Calculate completion percentage (6 total steps)
        const totalSteps = 6
        const completionPct = dotAppData.is_complete 
          ? 100 
          : Math.round((dotAppData.current_step / totalSteps) * 100)

        dotApp = {
          id: dotAppData.id,
          verified: dotAppData.verification_status === 'VERIFIED',
          blockchainVerified: !!dotAppData.blockchain_tx_hash,
          isComplete: dotAppData.is_complete,
          completionPercentage: completionPct,
          createdAt: dotAppData.created_at,
        }
      }
    }

    // MVR summary if enabled
    let mvr = null
    if (settings.showMvr && profile.mvr_license_status) {
      mvr = {
        licenseStatus: profile.mvr_license_status,
        totalPoints: profile.mvr_total_points,
        violationCount: profile.mvr_violation_count,
        lastOrdered: profile.mvr_last_ordered_at,
        // Summary status for quick view
        status: profile.mvr_license_status === 'Valid' && (profile.mvr_violation_count || 0) === 0
          ? 'clean'
          : profile.mvr_license_status === 'Valid'
            ? 'valid_with_violations'
            : 'review_needed',
      }
    }

    // Employment history from profile (unverified — for resume/display only, not "Verified Employment")
    let employmentSummary = null
    if (settings.showResume && profile.employment_history) {
      const history = profile.employment_history as Array<{
        companyName?: string
        position?: string
        startDate?: string
        endDate?: string
        isCurrent?: boolean
      }>
      if (Array.isArray(history) && history.length > 0) {
        employmentSummary = history.slice(0, 3).map(emp => ({
          company: emp.companyName,
          position: emp.position,
          startDate: emp.startDate,
          endDate: emp.isCurrent ? 'Present' : emp.endDate,
        }))
      }
    }

    // Verified employment only from verification flow (employer responded via email)
    const { data: verifiedRows } = await supabase
      .from('employment_verification_requests')
      .select('previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, status')
      .eq('driver_id', profile.user_id)
      .eq('applicant_type', 'driver')
      .in('status', ['VERIFIED', 'PARTIALLY_VERIFIED'])
      .order('verified_at', { ascending: false })

    const verifiedEmployments = (verifiedRows ?? []).map((r) => ({
      companyName: r.previous_employer_name,
      position: r.claimed_position,
      startDate: r.claimed_start_date ?? null,
      endDate: r.claimed_end_date ?? null,
      status: r.status,
    }))

    // Prevent caching so career card always shows current state (e.g. after resume delete)
    return NextResponse.json(
      {
        success: true,
        profile: publicProfile,
        resume,
        dotApp,
        mvr,
        employmentSummary,
        verifiedEmployments,
        settings: {
          allowConnect: settings.allowConnect,
        },
        viewCount: (profile.share_views_count || 0) + 1,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )

  } catch (error) {
    console.error('[PUBLIC PROFILE] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/driver/public/[token]
 * 
 * Creates a "lead" - employer connecting with driver after viewing profile.
 * This is the "I'm Hiring" / "Connect" action from the public profile.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()

    const {
      employerName,
      employerEmail,
      employerPhone,
      employerCompanyName,
      eventName,
      notes,
      source = 'qr_scan',
    } = body

    if (!token || token.length < 8) {
      return NextResponse.json(
        { error: 'Invalid share token' },
        { status: 400 }
      )
    }

    // At least email or phone required for anonymous employers
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress && !employerEmail && !employerPhone) {
      return NextResponse.json(
        { error: 'Contact information required (email or phone)' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Find the driver profile
    const { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('id, user_id, share_settings')
      .eq('share_token', token)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Check if connections are allowed
    const settings = profile.share_settings as { allowConnect?: boolean } || {}
    if (settings.allowConnect === false) {
      return NextResponse.json(
        { error: 'This driver has disabled connection requests' },
        { status: 403 }
      )
    }

    // Get employer user and company if logged in
    let employerUserId = null
    let companyId = null

    if (walletAddress) {
      const { data: employerUser } = await supabase
        .from('users')
        .select('id')
        .ilike('wallet_address', walletAddress)
        .single()

      if (employerUser) {
        employerUserId = employerUser.id

        // Check if employer has a company
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('employer_user_id', employerUser.id)
          .single()

        if (company) {
          companyId = company.id
        }
      }
    }

    // Check for duplicate lead (same employer-driver pair)
    if (employerUserId) {
      const { data: existingLead } = await supabase
        .from('driver_leads')
        .select('id')
        .eq('driver_user_id', profile.user_id)
        .eq('employer_user_id', employerUserId)
        .single()

      if (existingLead) {
        return NextResponse.json({
          success: true,
          message: 'You have already connected with this driver',
          leadId: existingLead.id,
          isExisting: true,
        })
      }
    }

    // Create the lead
    const { data: lead, error: leadError } = await supabase
      .from('driver_leads')
      .insert({
        driver_user_id: profile.user_id,
        driver_profile_id: profile.id,
        employer_user_id: employerUserId,
        company_id: companyId,
        employer_name: employerName,
        employer_email: employerEmail,
        employer_phone: employerPhone,
        employer_company_name: employerCompanyName,
        event_name: eventName,
        notes,
        source,
        status: 'new',
      })
      .select('id')
      .single()

    if (leadError) {
      console.error('[PUBLIC PROFILE] Lead creation error:', leadError)
      return NextResponse.json(
        { error: 'Failed to create connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Connection request sent! The driver will be notified.',
      leadId: lead.id,
    })

  } catch (error) {
    console.error('[PUBLIC PROFILE] Error creating lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
