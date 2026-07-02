import { NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { createNotification } from '@/lib/create-notification'

/**
 * POST /api/cron/application-follow-ups
 *
 * Daily cron job: finds applications where:
 *   - status = 'submitted' (employer hasn't touched it)
 *   - candidate_status IS NULL (candidate hasn't self-reported)
 *   - last_followed_up_at IS NULL (haven't nudged yet)
 *   - applied_at < now() - 7 days
 *
 * Creates a Stormi notification asking "Any reply from [company] yet?"
 * and stamps last_followed_up_at so we only ask once.
 *
 * Called by Vercel Cron or similar scheduler.
 */

const FOLLOW_UP_AFTER_DAYS = 7

export async function POST() {
  try {
    const cronSecret = process.env.CRON_SECRET
    // In production, verify the cron secret. In dev, skip the check.
    // For now we just run — add auth when deploying to production cron.

    const supabase = await getAdminSupabaseClient()

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - FOLLOW_UP_AFTER_DAYS)

    // Find stale applications that need a follow-up nudge
    const { data: staleApps, error: queryError } = await supabase
      .from('applications')
      .select(`
        id,
        applicant_user_id,
        applied_at,
        job_postings (
          title,
          companies ( company_name ),
          external_source
        )
      `)
      .eq('status', 'submitted')
      .is('candidate_status', null)
      .is('last_followed_up_at', null)
      .lt('applied_at', cutoffDate.toISOString())
      .limit(100)

    if (queryError) {
      console.error('[FOLLOW-UP CRON] Query error:', queryError)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!staleApps?.length) {
      return NextResponse.json({ success: true, followed_up: 0 })
    }

    let count = 0
    const now = new Date().toISOString()

    for (const app of staleApps) {
      const posting = app.job_postings as {
        title?: string
        companies?: { company_name?: string } | null
        external_source?: string
      } | null

      const jobTitle = posting?.title ?? 'a job'
      const company = posting?.companies?.company_name
        ?? (posting?.external_source ? `via ${posting.external_source}` : 'the employer')

      await createNotification({
        userId: app.applicant_user_id,
        type: 'application_follow_up',
        title: `Any reply from ${company}?`,
        body: `You applied to "${jobTitle}" ${FOLLOW_UP_AFTER_DAYS} days ago. Update your status so the assistant can help with next steps.`,
        actionUrl: '/?page=applications',
        data: { applicationId: app.id },
      })

      // Stamp so we don't re-nudge
      await supabase
        .from('applications')
        .update({ last_followed_up_at: now })
        .eq('id', app.id)

      count++
    }

    console.log(`[FOLLOW-UP CRON] Sent ${count} follow-up notifications`)
    return NextResponse.json({ success: true, followed_up: count })
  } catch (error) {
    console.error('[FOLLOW-UP CRON] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
