/**
 * The recruiter email cannot hold a form. It holds a link to one page,
 * and that page can only ask the driver to finish their own open steps.
 */

import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildEmail, infoBox } from '@/lib/email-template'
import { getAppBaseUrl } from '@/lib/app-url'
import type { DqItemId } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'
import { sendEmail } from '@/lib/messaging'
import { normalizeOutreachEmail, resolveLiveOutreachInvite } from '@/lib/outreach-invite-dedup'

export const RECRUITER_ASK_TASK_IDS = ['consent', 'license', 'dot'] as const
export type RecruiterAskTaskId = (typeof RECRUITER_ASK_TASK_IDS)[number]

export const ASK_TTL_DAYS = 14

const TASK_META: Record<
  RecruiterAskTaskId,
  { label: string; detail: string; driverLabel: string; onboard: string | null }
> = {
  consent: {
    label: 'Sign screening consent',
    detail: 'Lets reports be ordered. They sign one short package.',
    driverLabel: 'Sign your screening consent',
    onboard: null,
  },
  license: {
    label: 'Scan their license',
    detail: 'A barcode read on their phone. No photo is stored.',
    driverLabel: 'Scan your license barcode',
    onboard: 'license',
  },
  dot: {
    label: 'Finish the DOT application',
    detail: 'The federal driver application, in the app.',
    driverLabel: 'Finish your DOT application',
    onboard: 'dotapp',
  },
}

const TASK_ITEM: Record<RecruiterAskTaskId, DqItemId> = {
  consent: 'cdlis_consent',
  license: 'dl_images',
  dot: 'dot_application',
}

export function isAskTaskId(value: string): value is RecruiterAskTaskId {
  return (RECRUITER_ASK_TASK_IDS as readonly string[]).includes(value)
}

/** Steps the driver still has to do. Reports and employment checks stay with HR. */
export function offerableAskTasks(
  items: readonly { id: DqItemId; status: DqItemStatus }[],
): RecruiterAskTaskId[] {
  const status = new Map(items.map((item) => [item.id, item.status]))
  return RECRUITER_ASK_TASK_IDS.filter((task) => {
    const current = status.get(TASK_ITEM[task])
    return current != null && current !== 'complete'
  })
}

export function askTaskLabel(id: RecruiterAskTaskId): string {
  return TASK_META[id].label
}

export function askTaskDetail(id: RecruiterAskTaskId): string {
  return TASK_META[id].detail
}

export function newAskToken(): string {
  return randomBytes(24).toString('base64url')
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function linkButton(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:block;margin:0 0 10px;background:#f15a2b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 18px;border-radius:10px;text-align:center;">${esc(label)}</a>`
}

interface InviteTokenRow {
  id: string
  token: string
  status: string
  created_at: string
}

/** Consent reuses an open invite when one exists, so the driver does not get a second link. */
async function consentApplyUrl(
  supabase: SupabaseClient,
  input: { companyId: string; createdByUserId: string | null; driverUserId: string; email: string; name: string; baseUrl: string },
): Promise<string> {
  const existing = await resolveLiveOutreachInvite<InviteTokenRow>({
    supabase,
    companyId: input.companyId,
    targetBlockType: 'driver-screening-consent',
    email: normalizeOutreachEmail(input.email),
    phone: null,
    select: 'id, token, status, created_at',
    supersede: false,
  })
  if (existing.invite?.token) return `${input.baseUrl}/apply/${existing.invite.token}`

  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + ASK_TTL_DAYS)
  const { error } = await supabase.from('application_invites').insert({
    company_id: input.companyId,
    created_by_user_id: input.createdByUserId,
    token,
    type: 'block',
    target_block_type: 'driver-screening-consent',
    candidate_email: input.email,
    candidate_name: input.name,
    candidate_user_id: input.driverUserId,
    expires_at: expiresAt.toISOString(),
  })
  // Two asks at once can both miss the lookup. The unique index keeps one link.
  if (error?.code === '23505') {
    const again = await resolveLiveOutreachInvite<InviteTokenRow>({
      supabase,
      companyId: input.companyId,
      targetBlockType: 'driver-screening-consent',
      email: normalizeOutreachEmail(input.email),
      phone: null,
      select: 'id, token, status, created_at',
      supersede: false,
    })
    if (again.invite?.token) return `${input.baseUrl}/apply/${again.invite.token}`
  }
  if (error) throw new Error(error.message)
  return `${input.baseUrl}/apply/${token}`
}

export async function sendDriverAskEmail(
  supabase: SupabaseClient,
  input: {
    companyId: string
    companyName: string
    createdByUserId: string | null
    driverUserId: string
    driverName: string
    tasks: RecruiterAskTaskId[]
    recruiterMessage: string
    baseUrl: string
  },
): Promise<void> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('user_id', input.driverUserId)
    .maybeSingle()
  let email = typeof profile?.email === 'string' ? profile.email.trim() : ''
  if (!email) {
    const { data: user } = await supabase.from('users').select('email').eq('id', input.driverUserId).maybeSingle()
    email = typeof user?.email === 'string' ? user.email.trim() : ''
  }
  if (!email) throw new Error('This driver has no email on file.')

  const links: { href: string; label: string }[] = []
  for (const task of input.tasks) {
    const meta = TASK_META[task]
    if (task === 'consent') {
      links.push({
        href: await consentApplyUrl(supabase, {
          companyId: input.companyId,
          createdByUserId: input.createdByUserId,
          driverUserId: input.driverUserId,
          email,
          name: input.driverName,
          baseUrl: input.baseUrl,
        }),
        label: meta.driverLabel,
      })
    } else if (meta.onboard) {
      links.push({ href: `${input.baseUrl}/?onboard=${meta.onboard}`, label: meta.driverLabel })
    }
  }

  const note = input.recruiterMessage.trim()
  const noteHtml = note
    ? infoBox(`<p style="margin:0;font-size:14px;line-height:1.6;color:#173150;">${esc(note).replace(/\n/g, '<br>')}</p>`)
    : ''
  const buttons = links.map((link) => linkButton(link.href, link.label)).join('')
  const html = buildEmail({
    headerEyebrow: input.companyName,
    headerTitle: 'A few things to finish',
    greeting: `Hi ${esc(firstName(input.driverName))},`,
    preheader: `${input.companyName} needs you to finish a step`,
    bodyHtml: `${noteHtml}<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${esc(input.companyName)} asked you to finish the following. Sign in with this email address if a page asks you to.</p>${buttons}`,
    footerNote: 'Sent by Provven for your hiring team. If you were not expecting this, you can ignore it.',
  })

  const result = await sendEmail({
    type: 'driver_ask',
    to: email,
    subject: `${input.companyName}: a few things to finish`,
    html,
  })
  if (!result.ok) throw new Error(result.error || 'Could not email the driver')
}

export function askPageUrl(token: string, baseUrl = getAppBaseUrl()): string {
  return `${baseUrl.replace(/\/$/, '')}/ask/${token}`
}
