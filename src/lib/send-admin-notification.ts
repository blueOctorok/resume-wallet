import { Resend } from 'resend'
import { buildEmail, detailsBox, detailRow, infoBox } from './email-template'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'stormchain@verify.stormchain.ai'
const ADMIN_EMAILS = process.env.ADMIN_NOTIFICATION_EMAILS?.split(',').map(e => e.trim()) || []
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stormchain.ai'

export interface NewCompanyNotificationParams {
  companyName: string
  ownerEmail: string
  ownerWallet: string
  dotNumber?: string | null
}

export interface CandidateRequestNotificationParams {
  candidateEmail: string
  candidateName: string
  companyName: string
  requestType: 'mvr_order' | 'psp_order' | 'document_upload' | 'verification' | 'profile_completion' | 'custom' | 'block_request'
  documentType?: string | null
  message?: string | null
  /** Block label from the registry (e.g. "Driver Resume"). Used for block_request emails. */
  blockLabel?: string | null
}

export interface ApplicationStatusNotificationParams {
  candidateEmail: string
  candidateName: string
  companyName: string
  jobTitle: string
  newStatus: 'contacted'
}

// ─── Admin: New Company ───────────────────────────────────────────────────────

/**
 * Notifies admins when a new company is registered.
 */
export async function sendNewCompanyNotification(
  params: NewCompanyNotificationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[ADMIN NOTIFICATION] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }
  if (ADMIN_EMAILS.length === 0) {
    console.warn('[ADMIN NOTIFICATION] No ADMIN_NOTIFICATION_EMAILS configured')
    return { ok: false, error: 'No admin emails configured' }
  }

  const { companyName, ownerEmail, ownerWallet, dotNumber } = params

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      A new employer company has been registered and is pending review.
    </p>
    ${detailsBox(`
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Company Details</p>
      ${detailRow('Company Name', companyName)}
      ${detailRow('Owner Email', ownerEmail)}
      ${detailRow('Wallet', `<code style="font-size:12px;background:#f1f5f9;padding:2px 6px;border-radius:4px;">${ownerWallet.slice(0, 10)}...${ownerWallet.slice(-6)}</code>`)}
      ${dotNumber ? detailRow('DOT Number', dotNumber) : ''}
    `)}
  `

  const html = buildEmail({
    preheader: `New company registered: ${companyName}`,
    headerEyebrow: 'Admin Alert',
    headerTitle: `New Company: ${companyName}`,
    bodyHtml,
    ctaLabel: 'Review in Admin Panel',
    ctaUrl: `${APP_URL}/admin`,
    footerNote: 'This is an automated notification from Storm admin systems.',
  })

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAILS,
      subject: `[Storm Admin] New Company: ${companyName}`,
      html,
    })
    if (error) {
      console.error('[ADMIN NOTIFICATION] Resend error:', error)
      return { ok: false, error: error.message }
    }
    console.log('[ADMIN NOTIFICATION] New company email sent. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ADMIN NOTIFICATION] Send failed:', err)
    return { ok: false, error: message }
  }
}

// ─── Candidate: Employer Request ──────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<string, string | ((p: CandidateRequestNotificationParams) => string)> = {
  mvr_order: 'Background Check & MVR Request',
  psp_order: 'Background Check & PSP Request',
  document_upload: 'Resume Request',
  verification: 'Employment Verification Request',
  profile_completion: 'DOT Application Request',
  custom: 'New Request',
  block_request: (p) => p.blockLabel ? `${p.blockLabel} Request` : 'New Request',
}

function resolveLabel(requestType: string, params: CandidateRequestNotificationParams): string {
  const entry = REQUEST_TYPE_LABELS[requestType]
  if (!entry) return 'Request'
  return typeof entry === 'function' ? entry(params) : entry
}

const REQUEST_ACTION_TEXT: Record<string, (params: CandidateRequestNotificationParams) => string> = {
  mvr_order: () =>
    'They would like to order your Motor Vehicle Record (MVR). Log in to Storm to review and sign the required FCRA disclosure before the MVR can be ordered.',
  psp_order: () =>
    'They would like to order an FMCSA PSP (crash and inspection history) for you. Log in to Storm to review and sign the required FCRA disclosure before the PSP can be ordered.',
  document_upload: (p) =>
    p.documentType === 'resume'
      ? 'They are requesting your resume. Log in to Storm to upload or create one.'
      : `They are requesting you upload your ${p.documentType || 'document'}.`,
  verification: () => 'They are requesting employment verification for your work history.',
  profile_completion: (p) =>
    p.documentType === 'dot_application'
      ? 'They are requesting you complete your DOT Driver Application on Storm. A completed application strengthens your profile and speeds up the hiring process.'
      : 'They are requesting you complete additional sections of your profile.',
  custom: (p) => p.message || 'They have a request for you.',
  block_request: (p) =>
    `They are requesting your ${p.blockLabel || 'data'}. Log in to Storm to complete it.`,
}

/**
 * Notifies a candidate when an employer makes a request.
 */
export async function sendCandidateRequestNotification(
  params: CandidateRequestNotificationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[CANDIDATE NOTIFICATION] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const { candidateEmail, candidateName, companyName, requestType, message } = params
  const requestLabel = resolveLabel(requestType, params)
  const actionText = REQUEST_ACTION_TEXT[requestType]?.(params) || ''
  const firstName = candidateName.split(' ')[0] || 'there'

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      <strong>${companyName}</strong> is interested in your profile and has sent a new request.
    </p>
    ${infoBox(`
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0f766e;">${requestLabel}</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${actionText}</p>
      ${message && requestType !== 'custom' ? `<p style="margin:10px 0 0;font-size:13px;font-style:italic;color:#64748b;">"${message}"</p>` : ''}
    `)}
    <p style="margin:0 0 4px;color:#64748b;font-size:14px;line-height:1.6;">
      Log in to your Storm account to view and respond to this request.
    </p>
  `

  const html = buildEmail({
    preheader: `${companyName} has a new request for you on Storm`,
    headerEyebrow: companyName,
    headerTitle: `You have a new request`,
    greeting: `Hi ${firstName},`,
    bodyHtml,
    ctaLabel: 'View Request',
    ctaUrl: APP_URL,
    footerNote: `You're receiving this because an employer on Storm is interested in your profile. Reply to this email with any questions.`,
  })

  try {
    console.log('[CANDIDATE NOTIFICATION] Sending request notification to:', candidateEmail)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: candidateEmail,
      subject: `${companyName} has a request for you on Storm`,
      html,
    })
    if (error) {
      console.error('[CANDIDATE NOTIFICATION] Resend error:', error)
      return { ok: false, error: error.message }
    }
    console.log('[CANDIDATE NOTIFICATION] Sent successfully. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[CANDIDATE NOTIFICATION] Send failed:', err)
    return { ok: false, error: message }
  }
}

// ─── Candidate: Application Status ───────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  subject: string
  heading: string
  body: string
  accentColor: string
}> = {
  contacted: {
    subject: 'Employer reached out',
    heading: "They've marked you as contacted",
    body: "The employer has moved your application forward and marked you as contacted. Check Storm for messages or follow up in your usual channels.",
    accentColor: '#0d9488',
  },
}

/**
 * Notifies a candidate when their application status changes.
 */
export async function sendApplicationStatusNotification(
  params: ApplicationStatusNotificationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[STATUS NOTIFICATION] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const { candidateEmail, candidateName, companyName, jobTitle, newStatus } = params
  const config = STATUS_CONFIG[newStatus]

  if (!config) {
    console.warn(`[STATUS NOTIFICATION] Unknown status: ${newStatus}`)
    return { ok: false, error: `Unknown status: ${newStatus}` }
  }

  const firstName = candidateName.split(' ')[0] || 'there'

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      There's an update on your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.
    </p>
    ${infoBox(`
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${config.accentColor};">${config.heading}</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${config.body}</p>
    `, config.accentColor)}
    <p style="margin:0;color:#64748b;font-size:14px;">Log in to your Storm account to view your full application status.</p>
  `

  const html = buildEmail({
    preheader: `${config.subject} — ${companyName}`,
    headerEyebrow: companyName,
    headerTitle: config.heading,
    greeting: `Hi ${firstName},`,
    bodyHtml,
    ctaLabel: 'View Application',
    ctaUrl: APP_URL,
    accentColor: config.accentColor,
    footerNote: `You're receiving this because you applied to a job on Storm. Reply to this email with any questions.`,
  })

  try {
    console.log(`[STATUS NOTIFICATION] Sending ${newStatus} notification to:`, candidateEmail)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: candidateEmail,
      subject: `[${companyName}] ${config.subject}`,
      html,
    })
    if (error) {
      console.error('[STATUS NOTIFICATION] Resend error:', error)
      return { ok: false, error: error.message }
    }
    console.log('[STATUS NOTIFICATION] Sent successfully. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[STATUS NOTIFICATION] Send failed:', err)
    return { ok: false, error: message }
  }
}

// ─── Screening complete (MVR / PSP) — candidate + employer ───────────────────

const SCREENING_READY_COPY = {
  mvr: {
    candidateTitle: 'Your MVR is ready',
    candidatePreheader: 'Your motor vehicle record has arrived on Storm',
    candidateLead:
      'Your <strong>Motor Vehicle Record (MVR)</strong> has been processed and is available in your Storm account.',
    employerTitle: (candidateName: string) => `MVR ready: ${candidateName}`,
    employerPreheader: 'A requested motor vehicle record is available on Storm',
    employerLead: (candidateName: string, companyName: string) =>
      `The <strong>MVR</strong> you requested for <strong>${candidateName}</strong> (${companyName}) has finished processing and is available in Storm.`,
  },
  psp: {
    candidateTitle: 'Your PSP report is ready',
    candidatePreheader: 'Your FMCSA PSP screening has arrived on Storm',
    candidateLead:
      'Your <strong>FMCSA PSP</strong> (crash and inspection history) report has been processed and is available in your Storm account.',
    employerTitle: (candidateName: string) => `PSP report ready: ${candidateName}`,
    employerPreheader: 'A requested FMCSA PSP report is available on Storm',
    employerLead: (candidateName: string, companyName: string) =>
      `The <strong>FMCSA PSP</strong> report you requested for <strong>${candidateName}</strong> (${companyName}) has finished processing and is available in Storm.`,
  },
} as const

/**
 * Email to the candidate when Accio returns a completed MVR or PSP.
 */
export async function sendCandidateScreeningReadyEmail(params: {
  kind: 'mvr' | 'psp'
  candidateEmail: string
  candidateFirstName: string
  ctaUrl: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[SCREENING READY] RESEND_API_KEY not set, skipping candidate email')
    return { ok: false, error: 'Email not configured' }
  }

  const { kind, candidateEmail, candidateFirstName, ctaUrl } = params
  const copy = SCREENING_READY_COPY[kind]
  const first = candidateFirstName.trim() || 'there'

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      ${copy.candidateLead}
    </p>
    ${infoBox(`
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">
        Log in to review the result in your screening block. If anything looks incorrect, contact support through Storm.
      </p>
    `)}
  `

  const html = buildEmail({
    preheader: copy.candidatePreheader,
    headerEyebrow: 'Storm',
    headerTitle: copy.candidateTitle,
    greeting: `Hi ${first},`,
    bodyHtml,
    ctaLabel: kind === 'mvr' ? 'View MVR' : 'View PSP report',
    ctaUrl,
    footerNote: `You're receiving this because a motor vehicle or FMCSA screening tied to your account completed. Reply to this email with questions.`,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: candidateEmail,
      subject: `[Storm] ${copy.candidateTitle}`,
      html,
    })
    if (error) {
      console.error('[SCREENING READY] Candidate Resend error:', error)
      return { ok: false, error: error.message }
    }
    console.log('[SCREENING READY] Candidate email sent. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[SCREENING READY] Candidate send failed:', err)
    return { ok: false, error: message }
  }
}

/**
 * Email to the employer contact when a company-requested MVR or PSP completes.
 * Does not attach report content — only in-app access per FCRA isolation.
 */
export async function sendEmployerScreeningReadyEmail(params: {
  kind: 'mvr' | 'psp'
  employerEmail: string
  employerFirstName: string
  companyName: string
  candidateDisplayName: string
  ctaUrl: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[SCREENING READY] RESEND_API_KEY not set, skipping employer email')
    return { ok: false, error: 'Email not configured' }
  }

  const { kind, employerEmail, employerFirstName, companyName, candidateDisplayName, ctaUrl } = params
  const copy = SCREENING_READY_COPY[kind]
  const first = employerFirstName.trim() || 'there'

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      ${copy.employerLead(candidateDisplayName, companyName)}
    </p>
    ${infoBox(`
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">
        Open Storm to view the report in your hiring workflow. Full report details stay inside Storm — we never send the screening document by email.
      </p>
    `)}
  `

  const html = buildEmail({
    preheader: copy.employerPreheader,
    headerEyebrow: companyName,
    headerTitle: copy.employerTitle(candidateDisplayName),
    greeting: `Hi ${first},`,
    bodyHtml,
    ctaLabel: 'Open Storm',
    ctaUrl,
    footerNote: `You're receiving this because your company requested this screening on Storm.`,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: employerEmail,
      subject: `[Storm] ${copy.employerTitle(candidateDisplayName)}`,
      html,
    })
    if (error) {
      console.error('[SCREENING READY] Employer Resend error:', error)
      return { ok: false, error: error.message }
    }
    console.log('[SCREENING READY] Employer email sent. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[SCREENING READY] Employer send failed:', err)
    return { ok: false, error: message }
  }
}
