import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

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

    // Get user by wallet address
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, created_at')
      .ilike('wallet_address', walletAddress)
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
          totalSpentUSDC: 0,
        }
      })
    }

    // Fetch all data in parallel for performance
    const [
      profileResult,
      resumesResult,
      dotAppsResult,
      mvrOrdersResult,
      mvrResultsResult,
      jobAppsResult,
      paymentsResult,
    ] = await Promise.all([
      // 1. Driver profile
      supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),

      // 2. All resumes
      supabase
        .from('resumes')
        .select('id, title, filename, ipfs_hash, verification_status, blockchain_tx_hash, created_at, file_size, resume_type, is_paid')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // 3. All DOT applications
      supabase
        .from('driver_applications')
        .select('id, created_at, verification_status, blockchain_tx_hash, blockchain_application_id, is_complete, current_step')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // 4. All MVR orders (include fee info for transaction history)
      supabase
        .from('mvr_orders')
        .select('id, status, dl_state, created_at, completed_at, fee_amount, fee_currency, payment_id, ordered_at')
        .eq('driver_user_id', user.id)
        .order('created_at', { ascending: false }),

      // 5. All MVR results
      supabase
        .from('mvr_results')
        .select('id, mvr_order_id, license_state, license_status, total_points, violation_count, result_status, received_at')
        .eq('driver_user_id', user.id)
        .order('received_at', { ascending: false }),

      // 6. Job applications
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

      // 7. All payments
      supabase
        .from('payments')
        .select('id, type, amount_usdc, tx_hash, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    // Process profile (may not exist yet)
    const profile = profileResult.data || null
    
    console.log('[DRIVER HUB] Profile fetch result:', {
      hasProfile: !!profile,
      profileError: profileResult.error?.message,
      profileId: profile?.id,
      userId: user.id,
    })

    // Process resumes
    const resumes = (resumesResult.data || []).map(resume => ({
      id: resume.id,
      title: resume.title,
      filename: resume.filename,
      ipfsHash: resume.ipfs_hash,
      verificationStatus: resume.verification_status || 'PENDING',
      blockchainTxHash: resume.blockchain_tx_hash,
      createdAt: resume.created_at,
      fileSize: resume.file_size,
      resumeType: resume.resume_type || 'uploaded',
      isPaid: resume.is_paid,
    }))

    // Process DOT applications (submitted ones from database)
    const submittedDotApplications = (dotAppsResult.data || []).map(app => ({
      id: app.id,
      createdAt: app.created_at,
      verificationStatus: app.verification_status || 'PENDING',
      blockchainTxHash: app.blockchain_tx_hash,
      blockchainApplicationId: app.blockchain_application_id,
      isComplete: app.is_complete,
      currentStep: app.current_step,
      applicantName: null as string | null, // Will be filled from profile if needed
      isInProgress: false,
    }))
    
    // Check for in-progress application in profile (saved but not submitted)
    // Parse employment_history safely (it's JSONB so may already be an array)
    const employmentHistory = profile?.employment_history 
      ? (typeof profile.employment_history === 'string' 
          ? JSON.parse(profile.employment_history) 
          : profile.employment_history)
      : []
    
    // An in-progress app exists if profile has meaningful form data
    const hasInProgressApp = profile && (
      profile.first_name || 
      profile.last_name || 
      profile.cdl_number ||
      employmentHistory.length > 0
    )
    
    console.log('[DRIVER HUB] In-progress detection:', {
      hasProfile: !!profile,
      firstName: profile?.first_name,
      lastName: profile?.last_name,
      cdlNumber: profile?.cdl_number,
      employmentHistoryCount: employmentHistory.length,
      hasInProgressApp,
      submittedAppsCount: submittedDotApplications.length,
      // Debug: what does the profile actually contain?
      profileKeys: profile ? Object.keys(profile).filter(k => profile[k] !== null && profile[k] !== '') : [],
    })
    
    // Determine which form they're likely on based on what data exists
    // Note: This is a best guess since profile data can come from multiple sources
    // (DOT app, Resume Builder, AI prefill). We can't know for certain which form they left off on.
    // Logic: Show the NEXT form they need to complete, not the last one with data
    let inProgressCurrentForm = 1
    if (profile) {
      // Form 1 = Personal Info + CDL Info
      // Form 2 = Driving Experience  
      // Form 3 = Employment History
      
      // If they have CDL info, Form 1 is done → show Form 2
      if (profile.cdl_number && profile.cdl_class) {
        inProgressCurrentForm = 2
      }
      
      // If they have driving experience data, Form 2 is done → show Form 3
      // driving_experience is a JSON object, check if it has meaningful content
      const drivingExp = profile.driving_experience
      const hasDrivingExperience = drivingExp && typeof drivingExp === 'object' && (
        drivingExp.equipmentTypes?.straightTruck?.years > 0 ||
        drivingExp.equipmentTypes?.tractorTrailer?.years > 0 ||
        drivingExp.equipmentTypes?.tractorTwoTrailers?.years > 0
      )
      if (hasDrivingExperience) {
        inProgressCurrentForm = 3
      }
      
      // Note: We don't check employment_history here because it might have been
      // prefilled from Resume Builder, not from DOT Form 3
    }
    
    // Build dotApplications list - include in-progress app at the top if profile has form data
    // Users can have both submitted apps AND in-progress work (e.g., started a new app after submitting one)
    const dotApplications = [...submittedDotApplications]
    
    if (hasInProgressApp) {
      // Add the in-progress application to the list
      const applicantName = profile.first_name && profile.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : null
      
      console.log('[DRIVER HUB] Adding in-progress app:', {
        applicantName,
        currentStep: inProgressCurrentForm,
      })
        
      dotApplications.unshift({
        id: 'in-progress',
        createdAt: profile.updated_at || profile.created_at || new Date().toISOString(),
        verificationStatus: 'PENDING',
        blockchainTxHash: null,
        blockchainApplicationId: null,
        isComplete: false,
        currentStep: inProgressCurrentForm,
        applicantName,
        isInProgress: true,
      })
    }

    // Process MVR records (combine orders with results)
    const mvrResults = mvrResultsResult.data || []
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

    // Calculate profile completeness
    const profileCompleteness = calculateProfileCompleteness(profile, resumes, dotApplications, mvrRecords)

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
      viewedApplications: jobApplications.filter(a => a.status === 'viewed' || a.viewCount > 0).length,
      interviewingApplications: jobApplications.filter(a => ['interview', 'interviewing'].includes(a.status)).length,
      totalSpentUSDC: totalSpent,
      totalTransactions: transactions.length,
    }

    return NextResponse.json({
      success: true,
      isNewUser: false,
      profile,
      resumes,
      dotApplications,
      mvrRecords,
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
  mvrRecords: any[]
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

  return Math.min(100, score)
}
