import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export type NotificationType =
  | 'application_status'
  | 'application_follow_up'
  | 'candidate_request'
  | 'employment_verification'
  | 'team_invite'
  | 'new_application'
  | 'consent_signed'
  | 'job_match'
  | 'system'

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  actionUrl?: string
}

/**
 * Creates a persistent in-app notification for a user.
 *
 * Uses the admin Supabase client to bypass RLS — this is always called
 * server-side from API routes, never from the browser.
 *
 * This is intentionally fire-and-forget: email delivery is the primary
 * channel; if the notification write fails we log it but don't throw so
 * we don't block the main operation.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  const { userId, type, title, body, data = {}, actionUrl } = params

  const supabase = await getAdminSupabaseClient()

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    data,
    action_url: actionUrl ?? null,
  })

  if (error) {
    console.error('[NOTIFICATION] Failed to create notification:', error.message, {
      userId,
      type,
      title,
    })
  }
}
