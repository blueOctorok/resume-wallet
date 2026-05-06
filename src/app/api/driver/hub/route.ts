import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getCdlData, getDriverEmployment, getMvrData, getEmergencyContact, getDrivingExperience, getEducation, getSkills, getReferences, getDevPortfolio, getDevGithub } from '@/lib/block-data'

/**
 * GET /api/driver/hub
 * 
 * Aggregates all driver data for the Driver Hub dashboard.
 * Single API call to fetch everything needed for the hub view.
 * 
 * Headers:
 *   x-wallet-address: User's wallet address
 * 
 * Returns:
 *   - profile: Unified driver profile (or null if not created)
 *   - resumes: All user's resumes with verification status
 *   - dotApplications: All DOT application submissions
 *   - mvrRecords: All MVR orders and results
 *   - jobApplications: Summary of job applications
 *   - payments: All payment records
 *   - stats: Computed statistics for quick view
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const normalizedWallet = walletAddress.toLowerCase()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, created_at, wallet_address, share_token, share_settings, share_token_created_at, share_views_count')
      .ilike('wallet_address', normalizedWallet)
      .single()

    if (userError || !user) {
      // User not found - return empty hub (new user state)
      return NextResponse.json({
        success: true,
        isNewUser: true,
        profile: null,
        resumes: [],
        dotApplications: [],
        mvrRecords: [],
        pspRecords: [],
        portfolio: null,
        github: null,
        jobApplications: [],
        payments: [],
        stats: {
          profileCompleteness: 0,
          totalResumes: 0,
          verifiedResumes: 0,
          totalDotApps: 0,
          verifiedDotApps: 0,
          totalMvrRecords: 0,
          validMvrRecords: 0,
          totalJobApplications: 0,
          pendingApplications: 0,
          viewedApplications: 0,
          contactedApplications: 0,
          totalSpentUSDC: 0,
          totalTransactions: 0,
          careerCardViewsThisWeek: 0,
          careerCardViewsTotal: 0,
        }
      })
    }

    // Fetch all data in parallel — block tables
    const [
      userProfileResult,
      cdl,
      employment,
      mvrBlock,
      emergency,
      experience,
      education,
      skills,
      refs,
      resumesResult,
      dotAppsResult,
      mvrOrdersResult,
      mvrResultsResult,
      pspOrdersResult,
      pspResultsResult,
      jobAppsResult,
      paymentsResult,
      portfolioRow,
      githubRow,
    ] = await Promise.all([
      // 1. User profile (identity: name, avatar, contact)
      supabase
        .from('user_profiles')
        .select('first_name, last_name, avatar_url, headline, email, phone, city, state')
        .eq('user_id', user.id)
        .maybeSingle(),

      // 2–9. Block table reads
      getCdlData(supabase, user.id),
      getDriverEmployment(supabase, user.id),
      getMvrData(supabase, user.id),
      getEmergencyContact(supabase, user.id),
      getDrivingExperience(supabase, user.id),
      getEducation(supabase, user.id),
      getSkills(supabase, user.id),
      getReferences(supabase, user.id),

      // 10. Driver resumes only
      supabase
        .from('resumes')
        .select('id, title, filename, ipfs_hash, structured_data, verification_status, blockchain_tx_hash, created_at, file_size, resume_type, source_role, is_paid')
        .eq('user_id', user.id)
        .in('source_role', ['driver', 'developer', 'general'])
        .order('created_at', { ascending: false }),

      // 11. All DOT applications (include application_data to extract applicant name)
      supabase
        .from('driver_applications')
        .select('id, created_at, verification_status, blockchain_tx_hash, blockchain_application_id, is_complete, current_step, application_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // 12. All MVR orders (include fee info for transaction history)
      supabase
        .from('mvr_orders')
        .select('id, status, dl_state, created_at, completed_at, fee_amount, fee_currency, payment_id, ordered_at')
        .eq('driver_user_id', user.id)
        .order('created_at', { ascending: false }),

      // 13. All MVR results
      supabase
        .from('mvr_results')
        .select('id, mvr_order_id, license_state, license_status, total_points, violation_count, result_status, received_at')
        .eq('driver_user_id', user.id)
        .order('received_at', { ascending: false }),

      // 13b. PSP orders
      supabase
        .from('psp_orders')
        .select('id, status, dl_state, created_at, completed_at, fee_amount, fee_currency, payment_id, ordered_at')
        .eq('driver_user_id', user.id)
        .is('ordered_by_company_id', null)
        .order('created_at', { ascending: false }),

      supabase
        .from('psp_results')
        .select('id, psp_order_id, result_status, received_at')
        .eq('driver_user_id', user.id)
        .order('received_at', { ascending: false }),

      // 14. Job applications
      supabase
        .from('applications')
        .select(`
          id, status, applied_at, view_count,
          job_postings (
            title,
            companies (company_name)
          )
        `)
        .eq('driver_user_id', user.id)
        .order('applied_at', { ascending: false }),

      // 15. All payments
      supabase
        .from('payments')
        .select('id, type, amount_usdc, tx_hash, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // 16. Developer portfolio (for My Files when user has developer-portfolio block)
      getDevPortfolio(supabase, user.id),
      // 17. Developer GitHub (for My Files + journey when user has developer-github block)
      getDevGithub(supabase, user.id),
    ])

    const userProfile = userProfileResult.data || null

    // Reconstruct the driver-specific profile from block tables
    const driverProfile = {
      cdl_class: cdl?.cdl_class ?? null,
      cdl_state: cdl?.cdl_state ?? null,
      cdl_number: cdl?.cdl_number ?? null,
      cdl_expiration: cdl?.cdl_expiration ?? null,
      endorsements: cdl?.endorsements ?? [],
      restrictions: cdl?.restrictions ?? [],
      employment_history: employment,
      skills,
      education,
      references: refs,
      driving_experience: experience,
      emergency_contact_name: emergency?.contact_name ?? null,
      emergency_contact_phone: emergency?.contact_phone ?? null,
      emergency_contact_relationship: emergency?.contact_relationship ?? null,
      mvr_order_id: mvrBlock?.order_id ?? null,
      mvr_result_id: mvrBlock?.result_id ?? null,
      mvr_expires_at: mvrBlock?.expires_at ?? null,
      mvr_license_status: mvrBlock?.license_status ?? null,
      mvr_total_points: mvrBlock?.total_points ?? 0,
      mvr_violation_count: mvrBlock?.violation_count ?? 0,
      // Share data now comes from the users table
      share_token: user.share_token ?? null,
      share_settings: user.share_settings ?? null,
      share_token_created_at: user.share_token_created_at ?? null,
      share_views_count: user.share_views_count ?? 0,
    }
    const profile =
      userProfile
        ? { ...userProfile, ...driverProfile }
        : driverProfile

    if (dotAppsResult.error) {
      console.error('[DRIVER HUB] DOT apps query error:', dotAppsResult.error.message)
    }

    // Process resumes
    const resumes = (resumesResult.data || []).map(resume => ({
      id: resume.id,
      title: resume.title,
      filename: resume.filename,
      ipfsHash: resume.ipfs_hash,
      structuredData: resume.structured_data ?? null,
      sourceRole: resume.source_role as 'driver' | 'developer' | 'general',
      verificationStatus: resume.verification_status || 'PENDING',
      blockchainTxHash: resume.blockchain_tx_hash,
      createdAt: resume.created_at,
      fileSize: resume.file_size,
      resumeType: resume.resume_type || 'uploaded',
      isPaid: resume.is_paid,
    }))

    // Extract applicant name from application_data.form1 (DOT form1 first/last name)
    const getApplicantNameFromApp = (app: { application_data?: { form1?: { firstName?: string; lastName?: string } } }): string | null => {
      const form1 = app.application_data?.form1
      if (!form1) return null
      const name = `${form1.firstName ?? ''} ${form1.lastName ?? ''}`.trim()
      return name || null
    }

    const profileFallbackName = profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : null

    // Process DOT applications from database
    // Mark incomplete apps as "in-progress" so users can continue them
    const submittedDotApplications = (dotAppsResult.data || []).map((app: Record<string, unknown>) => {
      const applicantName = getApplicantNameFromApp(app as { application_data?: { form1?: { firstName?: string; lastName?: string } } }) ?? profileFallbackName
      const isComplete = Boolean(app.is_complete)
      return {
        id: app.id,
        createdAt: app.created_at,
        verificationStatus: app.verification_status || 'PENDING',
        blockchainTxHash: app.blockchain_tx_hash,
        blockchainApplicationId: app.blockchain_application_id,
        isComplete,
        currentStep: app.current_step,
        applicantName,
        // If not complete, it's in-progress (user can continue it)
        isInProgress: !isComplete,
      }
    })
    
    // DOT applications list comes directly from database
    // The save-progress API creates/updates records, so database is the source of truth
    // In-progress apps are marked with is_complete=false and isInProgress=true
    const dotApplications = [...submittedDotApplications]

    // Process MVR records (combine orders with results)
    const mvrResults = mvrResultsResult.data || []
    const pspResults = pspResultsResult.data || []
    const pspRecords = (pspOrdersResult.data || []).map((order) => {
      const result = pspResults.find((r) => r.psp_order_id === order.id)
      return {
        id: order.id,
        orderStatus: order.status,
        licenseState: order.dl_state,
        createdAt: order.created_at,
        completedAt: order.completed_at,
        feeAmount: order.fee_amount,
        feeCurrency: order.fee_currency || 'USD',
        orderedAt: order.ordered_at,
        hasResult: !!result,
        resultId: result?.id || null,
        resultStatus: result?.result_status || null,
      }
    })

    const mvrRecords = (mvrOrdersResult.data || []).map(order => {
      const result = mvrResults.find(r => r.mvr_order_id === order.id)
      return {
        id: order.id,
        orderStatus: order.status,
        licenseState: order.dl_state,
        createdAt: order.created_at,
        completedAt: order.completed_at,
        // Fee info for transaction history
        feeAmount: order.fee_amount,
        feeCurrency: order.fee_currency || 'USD',
        orderedAt: order.ordered_at,
        // Result data (if available)
        hasResult: !!result,
        resultId: result?.id || null,
        licenseStatus: result?.license_status || null,
        totalPoints: result?.total_points || null,
        violationCount: result?.violation_count || 0,
        resultStatus: result?.result_status || null,
      }
    })

    // Build transaction history from actual orders/purchases (not just payments table)
    // This is more reliable since payments table may not have been populated
    const transactions: Array<{
      id: string
      type: string
      description: string
      amount: number | null
      currency: string
      status: string
      createdAt: string
    }> = []

    // Add MVR order transactions
    mvrRecords.forEach(mvr => {
      transactions.push({
        id: `mvr-${mvr.id}`,
        type: 'MVR_ORDER',
        description: `MVR Order - ${mvr.licenseState}`,
        amount: mvr.feeAmount ? parseFloat(mvr.feeAmount) : null,
        currency: mvr.feeCurrency,
        status: mvr.orderStatus === 'completed' || mvr.orderStatus === 'needs_review' ? 'COMPLETED' : 'PENDING',
        createdAt: mvr.orderedAt || mvr.createdAt,
      })
    })

    pspRecords.forEach((psp) => {
      transactions.push({
        id: `psp-${psp.id}`,
        type: 'PSP_ORDER',
        description: `PSP Report - ${psp.licenseState}`,
        amount: psp.feeAmount ? parseFloat(String(psp.feeAmount)) : null,
        currency: psp.feeCurrency,
        status: psp.orderStatus === 'completed' || psp.orderStatus === 'needs_review' ? 'COMPLETED' : 'PENDING',
        createdAt: psp.orderedAt || psp.createdAt,
      })
    })

    // Add paid resume transactions
    resumes.filter(r => r.isPaid).forEach(resume => {
      transactions.push({
        id: `resume-${resume.id}`,
        type: 'RESUME_UPLOAD',
        description: `Resume Upload - ${resume.title || resume.filename}`,
        amount: null, // Could add resume pricing if stored
        currency: 'USDC',
        status: 'COMPLETED',
        createdAt: resume.createdAt,
      })
    })

    // Sort by date, newest first
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Process job applications
    const jobApplications = (jobAppsResult.data || []).map(app => ({
      id: app.id,
      status: app.status,
      appliedAt: app.applied_at,
      viewCount: app.view_count || 0,
      jobTitle: (app.job_postings as any)?.title || 'Unknown Position',
      companyName: (app.job_postings as any)?.companies?.company_name || 'Unknown Company',
    }))

    // Process payments
    const payments = (paymentsResult.data || []).map(payment => ({
      id: payment.id,
      type: payment.type,
      amountUSDC: payment.amount_usdc,
      txHash: payment.tx_hash,
      status: payment.status,
      createdAt: payment.created_at,
    }))

    // Fallback display name when profile first/last are missing (e.g. after submit)
    const profileName = profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : null
    const latestAppWithName = dotApplications.find(a => a.applicantName)
    const displayNameFallback = profileName ?? latestAppWithName?.applicantName ?? null

    // Calculate profile completeness
    const profileCompleteness = calculateProfileCompleteness(profile, resumes, dotApplications, mvrRecords, pspRecords)

    const weekAgoIso = new Date(Date.now() - 7 * 86400000).toISOString()
    const [{ count: cardViewsWeek }, { count: cardViewsTotal }] = await Promise.all([
      supabase
        .from('career_card_views')
        .select('*', { count: 'exact', head: true })
        .eq('candidate_user_id', user.id)
        .gte('viewed_at', weekAgoIso),
      supabase
        .from('career_card_views')
        .select('*', { count: 'exact', head: true })
        .eq('candidate_user_id', user.id),
    ])

    // Calculate total spent from transactions (more reliable than payments table)
    const totalSpent = transactions
      .filter(t => t.status === 'COMPLETED' && t.amount !== null)
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    // Calculate stats
    const inProgressApps = dotApplications.filter(a => a.isInProgress)
    const stats = {
      profileCompleteness,
      totalResumes: resumes.length,
      verifiedResumes: resumes.filter(r => r.verificationStatus === 'VERIFIED').length,
      totalDotApps: dotApplications.length,
      verifiedDotApps: dotApplications.filter(a => a.verificationStatus === 'VERIFIED').length,
      completedDotApps: dotApplications.filter(a => a.isComplete).length,
      inProgressDotApps: inProgressApps.length,
      totalMvrRecords: mvrRecords.length,
      validMvrRecords: mvrRecords.filter(m => m.licenseStatus === 'Valid' || m.orderStatus === 'completed').length,
      totalJobApplications: jobApplications.length,
      pendingApplications: jobApplications.filter(a => a.status === 'submitted').length,
      viewedApplications: jobApplications.filter(a => a.viewCount > 0).length,
      /** Employer marked the application as contacted (simplified pipeline). */
      contactedApplications: jobApplications.filter(a => a.status === 'contacted').length,
      totalSpentUSDC: totalSpent,
      totalTransactions: transactions.length,
      careerCardViewsThisWeek: cardViewsWeek ?? 0,
      careerCardViewsTotal: cardViewsTotal ?? 0,
    }

    const portfolio = portfolioRow
      ? { portfolioUrl: portfolioRow.portfolio_url ?? null }
      : null
    const github = githubRow
      ? { username: githubRow.username ?? null }
      : null

    return NextResponse.json({
      success: true,
      isNewUser: false,
      /** Supabase user id — needed for My Files DOT preview (self dot-app API path). */
      userId: user.id,
      profile,
      displayNameFallback, // Use when profile first/last missing (e.g. from submitted app)
      resumes,
      dotApplications,
      mvrRecords,
      pspRecords,
      portfolio,
      github,
      jobApplications,
      payments, // Keep for backwards compatibility
      transactions, // New: derived from actual orders/purchases
      stats,
      memberSince: user.created_at,
    })

  } catch (error) {
    console.error('[DRIVER HUB] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Calculate profile completeness percentage based on what the driver has completed.
 * Weights different components by their importance to employers.
 */
function calculateProfileCompleteness(
  profile: any,
  resumes: any[],
  dotApplications: any[],
  mvrRecords: any[],
  pspRecords: any[] = [],
): number {
  let score = 0
  const weights = {
    basicProfile: 15,      // Has a profile at all
    personalInfo: 15,      // Name, email, phone
    cdlInfo: 20,           // CDL number, class, state
    resume: 20,            // At least one resume
    verifiedResume: 5,     // Bonus for verified resume
    dotApplication: 15,    // Completed DOT application
    verifiedDotApp: 5,     // Bonus for verified DOT app
    mvr: 5,                // Has MVR record
    psp: 3,                // Has PSP record
  }

  // Basic profile exists
  if (profile) {
    score += weights.basicProfile

    // Personal info filled
    if (profile.first_name && profile.last_name && (profile.email || profile.phone)) {
      score += weights.personalInfo
    }

    // CDL info filled
    if (profile.cdl_number && profile.cdl_class && profile.cdl_state) {
      score += weights.cdlInfo
    }
  }

  // Has at least one resume
  if (resumes.length > 0) {
    score += weights.resume
    // Bonus for verified resume
    if (resumes.some(r => r.verificationStatus === 'VERIFIED')) {
      score += weights.verifiedResume
    }
  }

  // Has completed DOT application
  const completedDotApps = dotApplications.filter(a => a.isComplete)
  if (completedDotApps.length > 0) {
    score += weights.dotApplication
    // Bonus for verified DOT app
    if (completedDotApps.some(a => a.verificationStatus === 'VERIFIED')) {
      score += weights.verifiedDotApp
    }
  }

  // Has MVR record
  if (mvrRecords.length > 0 && mvrRecords.some(m => m.hasResult || m.orderStatus === 'completed')) {
    score += weights.mvr
  }

  if (pspRecords.length > 0 && pspRecords.some((p) => p.hasResult || p.orderStatus === 'completed')) {
    score += weights.psp
  }

  return Math.min(100, score)
}
