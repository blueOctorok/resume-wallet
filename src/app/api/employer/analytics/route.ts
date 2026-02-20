import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/analytics
 * 
 * Returns comprehensive hiring analytics for the employer's company.
 * All data is derived from actual database records.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get employer and company
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get company via membership or legacy
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
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
      return NextResponse.json({ 
        success: true,
        analytics: getEmptyAnalytics()
      })
    }

    // Fetch all data in parallel
    const [jobsResult, applicationsResult] = await Promise.all([
      // All job postings
      supabase
        .from('job_postings')
        .select('id, title, is_active, created_at')
        .eq('company_id', companyId),
      
      // All applications to company's jobs
      supabase
        .from('applications')
        .select(`
          id, status, applied_at, initiated_by,
          job_posting_id,
          job_postings!inner (company_id)
        `)
        .eq('job_postings.company_id', companyId)
    ])

    const jobs = jobsResult.data || []
    const applications = applicationsResult.data || []

    // Calculate metrics
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Pipeline breakdown
    const pipeline = {
      new: applications.filter(a => a.status === 'submitted' || a.status === 'new').length,
      reviewing: applications.filter(a => a.status === 'reviewing' || a.status === 'under_review').length,
      interviewing: applications.filter(a => a.status === 'interviewing' || a.status === 'interview').length,
      offer: applications.filter(a => a.status === 'offer' || a.status === 'offer_sent').length,
      hired: applications.filter(a => a.status === 'hired').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
    }

    // Time-to-hire calculation (for hired candidates)
    const hiredApps = applications.filter(a => a.status === 'hired')
    let avgTimeToHire = 0
    if (hiredApps.length > 0) {
      const totalDays = hiredApps.reduce((sum, app) => {
        const appliedDate = new Date(app.applied_at)
        const daysDiff = Math.floor((now.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24))
        return sum + daysDiff
      }, 0)
      avgTimeToHire = Math.round(totalDays / hiredApps.length)
    }

    // Application source breakdown
    const sourceBreakdown = {
      applicantInitiated: applications.filter(a => a.initiated_by === 'applicant' || !a.initiated_by).length,
      employerRecruited: applications.filter(a => a.initiated_by === 'employer').length,
    }

    // Applications over time (last 30 days, grouped by week)
    const applicationsByWeek = getApplicationsByWeek(applications, thirtyDaysAgo)

    // Conversion rates
    const totalApps = applications.length
    const conversionRates = {
      toReview: totalApps > 0 ? Math.round((pipeline.reviewing / totalApps) * 100) : 0,
      toInterview: pipeline.reviewing > 0 ? Math.round((pipeline.interviewing / pipeline.reviewing) * 100) : 0,
      toOffer: pipeline.interviewing > 0 ? Math.round((pipeline.offer / pipeline.interviewing) * 100) : 0,
      toHired: pipeline.offer > 0 ? Math.round((pipeline.hired / pipeline.offer) * 100) : 0,
    }

    // Recent activity
    const recentApps = applications.filter(a => new Date(a.applied_at) >= sevenDaysAgo).length
    const last30DaysApps = applications.filter(a => new Date(a.applied_at) >= thirtyDaysAgo).length

    // Job stats
    const activeJobs = jobs.filter(j => j.is_active).length
    const totalJobs = jobs.length

    return NextResponse.json({
      success: true,
      analytics: {
        // Overview metrics
        overview: {
          totalApplications: totalApps,
          activeJobs,
          totalJobs,
          avgTimeToHire,
          totalHires: pipeline.hired,
        },
        
        // Pipeline funnel
        pipeline,
        
        // Conversion rates (percentages)
        conversionRates,
        
        // Source breakdown
        sourceBreakdown,
        
        // Trends
        trends: {
          applicationsLast7Days: recentApps,
          applicationsLast30Days: last30DaysApps,
          applicationsByWeek,
        },
        
        // Activity summary
        activity: {
          pendingReview: pipeline.new + pipeline.reviewing,
          inProgress: pipeline.interviewing + pipeline.offer,
          completed: pipeline.hired + pipeline.rejected,
        }
      }
    })
  } catch (error) {
    console.error('[ANALYTICS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getEmptyAnalytics() {
  return {
    overview: {
      totalApplications: 0,
      activeJobs: 0,
      totalJobs: 0,
      avgTimeToHire: 0,
      totalHires: 0,
    },
    pipeline: { new: 0, reviewing: 0, interviewing: 0, offer: 0, hired: 0, rejected: 0 },
    conversionRates: { toReview: 0, toInterview: 0, toOffer: 0, toHired: 0 },
    sourceBreakdown: { applicantInitiated: 0, employerRecruited: 0 },
    trends: { applicationsLast7Days: 0, applicationsLast30Days: 0, applicationsByWeek: [] },
    activity: { pendingReview: 0, inProgress: 0, completed: 0 },
  }
}

function getApplicationsByWeek(applications: any[], startDate: Date): { week: string; count: number }[] {
  const weeks: { week: string; count: number }[] = []
  const now = new Date()
  
  // Generate 4 weeks
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    
    const count = applications.filter(a => {
      const date = new Date(a.applied_at)
      return date >= weekStart && date < weekEnd
    }).length
    
    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    weeks.push({ week: weekLabel, count })
  }
  
  return weeks
}
