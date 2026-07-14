import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getCdlData, getDriverEmployment, getMvrData, getSkills, getEducation } from '@/lib/block-data'
import { resolveResumeDocumentSignedUrl } from '@/lib/document-storage'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

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

    // share_token lives on `users` (migrated in 036)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, share_settings, share_views_count')
      .eq('share_token', token)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Profile not found or sharing is disabled' },
        { status: 404 }
      )
    }

    const userId = user.id

    // Parse share settings
    const settings = user.share_settings as {
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

    // Increment view count on `users` (fire and forget)
    void supabase
      .from('users')
      .update({ share_views_count: (user.share_views_count || 0) + 1 })
      .eq('id', userId)
      .then(() => {}, () => {})

    // Parallel reads: user_profiles + block tables
    const [userProfileResult, cdl, employment, mvrData, skills, education] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('first_name, last_name, email, phone, city, state, professional_summary')
        .eq('user_id', userId)
        .maybeSingle(),
      getCdlData(supabase, userId),
      getDriverEmployment(supabase, userId),
      getMvrData(supabase, userId),
      getSkills(supabase, userId),
      getEducation(supabase, userId),
    ])

    const userProfile = userProfileResult.data

    // Build the public profile based on settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publicProfile: Record<string, any> = {
      id: userId,
      firstName: userProfile?.first_name ?? null,
      lastName: userProfile?.last_name ?? null,
      location: userProfile?.city && userProfile?.state
        ? `${userProfile.city}, ${userProfile.state}`
        : null,
      summary: userProfile?.professional_summary ?? null,
      experienceYears: null,
      cdl: {
        class: cdl?.cdl_class ?? null,
        state: cdl?.cdl_state ?? null,
        expiration: cdl?.cdl_expiration ?? null,
        endorsements: cdl?.endorsements ?? [],
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
        .select('id, title, filename, ipfs_hash, storage_path, verification_status, blockchain_tx_hash, created_at, resume_type, structured_data')
        .eq('user_id', userId)
        .or('resume_type.neq.developer_built,resume_type.is.null')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (resumeData) {
        const normalizedData = normalizeResumeStructuredData(resumeData.structured_data)
        const documentUrl = await resolveResumeDocumentSignedUrl(resumeData)

        resume = {
          id: resumeData.id,
          title: resumeData.title,
          filename: resumeData.filename,
          verified: false, // DEC-2026-05-014: self-reported resume is never chain-verified
          blockchainVerified: false,
          type: resumeData.resume_type,
          createdAt: resumeData.created_at,
          ipfsHash: resumeData.ipfs_hash,
          storagePath: resumeData.storage_path ?? null,
          documentUrl,
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
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (dotAppData) {
        const totalSteps = 6
        const completionPct = dotAppData.is_complete 
          ? 100 
          : Math.round((dotAppData.current_step / totalSteps) * 100)

        dotApp = {
          id: dotAppData.id,
          // DEC-2026-07-001: never surface whole-app VERIFIED / Base tx as verified
          verified: false,
          blockchainVerified: false,
          isComplete: dotAppData.is_complete,
          completionPercentage: completionPct,
          createdAt: dotAppData.created_at,
        }
      }
    }

    // MVR summary from block table
    let mvr = null
    if (settings.showMvr && mvrData?.license_status) {
      mvr = {
        licenseStatus: mvrData.license_status,
        totalPoints: mvrData.total_points,
        violationCount: mvrData.violation_count,
        lastOrdered: mvrData.last_ordered_at,
        status: mvrData.license_status === 'Valid' && mvrData.violation_count === 0
          ? 'clean'
          : mvrData.license_status === 'Valid'
            ? 'valid_with_violations'
            : 'review_needed',
      }
    }

    // Employment history from block table
    let employmentSummary = null
    if (settings.showResume && employment.length > 0) {
      employmentSummary = employment.slice(0, 3).map(emp => ({
        company: emp.companyName,
        position: emp.position,
        startDate: emp.startDate,
        endDate: emp.isCurrent ? 'Present' : emp.endDate,
      }))
    }

    // Verified employment only from verification flow (employer responded via email)
    const { data: verifiedRows } = await supabase
      .from('employment_verification_requests')
      .select('previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, status')
      .eq('driver_id', userId)
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
        viewCount: (user.share_views_count || 0) + 1,
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
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId && !employerEmail && !employerPhone) {
      return NextResponse.json(
        { error: 'Contact information required (email or phone)' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // share_token lives on `users` (migrated in 036)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, share_settings')
      .eq('share_token', token)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const driverUserId = user.id

    // Check if connections are allowed
    const settings = user.share_settings as { allowConnect?: boolean } || {}
    if (settings.allowConnect === false) {
      return NextResponse.json(
        { error: 'This driver has disabled connection requests' },
        { status: 403 }
      )
    }

    // Get employer user and company if logged in
    let employerUserId = null
    let companyId = null

    if (sessionUserId) {
      const { data: employerUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', sessionUserId)
        .single()

      if (employerUser) {
        employerUserId = employerUser.id

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
        .eq('driver_user_id', driverUserId)
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

    // Create the lead (driver_profile_id kept for backward compat — nullable)
    const { data: lead, error: leadError } = await supabase
      .from('driver_leads')
      .insert({
        driver_user_id: driverUserId,
        driver_profile_id: null,
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
