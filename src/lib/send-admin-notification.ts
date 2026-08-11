import { buildEmail, detailsBox, detailRow, infoBox } from './email-template'
import { isMessagingConfigured, sendEmail } from './messaging'

const ADMIN_EMAILS = process.env.ADMIN_NOTIFICATION_EMAILS?.split(',').map(e => e.trim()) || []
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://provven.com'

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
  if (!isMessagingConfigured()) {
    console.warn('[ADMIN NOTIFICATION] PINGRAM_API_KEY not set, skipping send')
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
    footerNote: 'This is an automated notification from Provven admin systems.',
  })

  console.log('[ADMIN NOTIFICATION] Sending new company email via Pingram')
  const result = await sendEmail({
    type: 'admin_new_company',
    to: ADMIN_EMAILS,
    subject: `[Provven Admin] New Company: ${companyName}`,
    html,
  })
  if (!result.ok) {
    console.error('[ADMIN NOTIFICATION] Send failed:', result.error)
    return { ok: false, error: result.error }
  }
  console.log('[ADMIN NOTIFICATION] New company email sent. Pingram id:', result.id)
  return { ok: true }
}

// ─── Employer: Owner Provisioning Invite ──────────────────────────────────────

export interface EmployerOwnerInviteParams {
  companyName: string
  /** The designated owner address. Must be the same value stored on the company row. */
  ownerEmail: string
  dotNumber?: string | null
  /** Domains their team must use, or [] for a company with no corporate domain. */
  allowedEmailDomains?: string[]
}

/**
 * Tells a designated owner their company is ready to claim.
 *
 * This is the only invitation into an employer account. There is no link or
 * token to steal: the owner signs in with THIS address and the server matches
 * the verified session email against companies.designated_owner_email. An email
 * forwarded to someone else grants nothing.
 */
export async function sendEmployerOwnerInvite(
  params: EmployerOwnerInviteParams
): Promise<{ ok: boolean; error?: string }> {
  if (!isMessagingConfigured()) {
    console.warn('[EMPLOYER OWNER INVITE] PINGRAM_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const { companyName, ownerEmail, dotNumber, allowedEmailDomains } = params

  const domainNote =
    allowedEmailDomains && allowedEmailDomains.length > 0
      ? `<p style="margin:0;font-size:14px;color:#334155;">Your team members must sign up with an email on ${allowedEmailDomains
          .map((d) => `<strong>@${d}</strong>`)
          .join(' or ')}.</p>`
      : ''

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      Provven has set up an employer account for <strong>${companyName}</strong> and named you its owner.
    </p>
    ${detailsBox(`
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Your Company</p>
      ${detailRow('Company', companyName)}
      ${detailRow('Owner', ownerEmail)}
      ${dotNumber ? detailRow('DOT Number', dotNumber) : ''}
    `)}
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      Sign in with <strong>${ownerEmail}</strong> to finish setting up your company profile. Your
      access is tied to that address — there is nothing to activate and no password to create.
    </p>
    ${infoBox(`
      <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>Once you are in, you can invite your team.</strong></p>
      ${domainNote}
    `)}
  `

  const html = buildEmail({
    preheader: `Your Provven employer account for ${companyName} is ready`,
    headerEyebrow: companyName,
    headerTitle: 'Your employer account is ready',
    bodyHtml,
    ctaLabel: 'Sign in to Provven',
    ctaUrl: `${APP_URL}/sign-in`,
    footerNote: `Sent to ${ownerEmail} because Provven set up an employer account for ${companyName}. If you weren't expecting this, you can ignore it — no access is granted until you sign in with this address.`,
  })

  console.log(`[EMPLOYER OWNER INVITE] Sending owner invite for "${companyName}" to ${ownerEmail}`)
  const result = await sendEmail({
    type: 'employer_owner_invite',
    to: [ownerEmail],
    subject: `Your Provven employer account for ${companyName} is ready`,
    html,
  })
  if (!result.ok) {
    console.error('[EMPLOYER OWNER INVITE] Send failed:', result.error)
    return { ok: false, error: result.error }
  }
  console.log('[EMPLOYER OWNER INVITE] Sent. Pingram id:', result.id)
  return { ok: true }
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
    'They would like to order your Motor Vehicle Record (MVR). Log in to Provven to review and sign the required FCRA disclosure before the MVR can be ordered.',
  psp_order: () =>
    'They would like to order an FMCSA PSP (crash and inspection history) for you. Log in to Provven to review and sign the required FCRA disclosure before the PSP can be ordered.',
  document_upload: (p) =>
    p.documentType === 'resume'
      ? 'They are requesting your resume. Log in to Provven to upload or create one.'
      : `They are requesting you upload your ${p.documentType || 'document'}.`,
  verification: () => 'They are requesting employment verification for your work history.',
  profile_completion: (p) =>
    p.documentType === 'dot_application'
      ? 'They are requesting you complete your DOT Driver Application on Provven. A completed application strengthens your profile and speeds up the hiring process.'
      : 'They are requesting you complete additional sections of your profile.',
  custom: (p) => p.message || 'They have a request for you.',
  block_request: (p) =>
    `They are requesting your ${p.blockLabel || 'data'}. Log in to Provven to complete it.`,
}

/**
 * Notifies a candidate when an employer makes a request.
 */
export async function sendCandidateRequestNotification(
  params: CandidateRequestNotificationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!isMessagingConfigured()) {
    console.warn('[CANDIDATE NOTIFICATION] PINGRAM_API_KEY not set, skipping send')
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
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#7d5e33;">${requestLabel}</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${actionText}</p>
      ${message && requestType !== 'custom' ? `<p style="margin:10px 0 0;font-size:13px;font-style:italic;color:#64748b;">"${message}"</p>` : ''}
    `)}
    <p style="margin:0 0 4px;color:#64748b;font-size:14px;line-height:1.6;">
      Log in to your Provven account to view and respond to this request.
    </p>
  `

  const html = buildEmail({
    preheader: `${companyName} has a new request for you on Provven`,
    headerEyebrow: companyName,
    headerTitle: `You have a new request`,
    greeting: `Hi ${firstName},`,
    bodyHtml,
    ctaLabel: 'View Request',
    ctaUrl: APP_URL,
    footerNote: `You're receiving this because an employer on Provven is interested in your profile. Reply to this email with any questions.`,
  })

  console.log('[CANDIDATE NOTIFICATION] Sending request notification to:', candidateEmail)
  const result = await sendEmail({
    type: 'candidate_request',
    to: candidateEmail,
    subject: `${companyName} has a request for you on Provven`,
    html,
  })
  if (!result.ok) {
    console.error('[CANDIDATE NOTIFICATION] Send failed:', result.error)
    return { ok: false, error: result.error }
  }
  console.log('[CANDIDATE NOTIFICATION] Sent successfully. Pingram id:', result.id)
  return { ok: true }
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
    body: "The employer has moved your application forward and marked you as contacted. Check Provven for messages or follow up in your usual channels.",
    accentColor: '#9c7740',
  },
}

/**
 * Notifies a candidate when their application status changes.
 */
export async function sendApplicationStatusNotification(
  params: ApplicationStatusNotificationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!isMessagingConfigured()) {
    console.warn('[STATUS NOTIFICATION] PINGRAM_API_KEY not set, skipping send')
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
    <p style="margin:0;color:#64748b;font-size:14px;">Log in to your Provven account to view your full application status.</p>
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
    footerNote: `You're receiving this because you applied to a job on Provven. Reply to this email with any questions.`,
  })

  console.log(`[STATUS NOTIFICATION] Sending ${newStatus} notification to:`, candidateEmail)
  const result = await sendEmail({
    type: 'application_status',
    to: candidateEmail,
    subject: `[${companyName}] ${config.subject}`,
    html,
  })
  if (!result.ok) {
    console.error('[STATUS NOTIFICATION] Send failed:', result.error)
    return { ok: false, error: result.error }
  }
  console.log('[STATUS NOTIFICATION] Sent successfully. Pingram id:', result.id)
  return { ok: true }
}

// ─── Screening complete (MVR / PSP) — candidate + employer ───────────────────

const SCREENING_READY_COPY = {
  mvr: {
    candidateTitle: 'Your MVR is ready',
    candidatePreheader: 'Your motor vehicle record has arrived on Provven',
    candidateLead:
      'Your <strong>Motor Vehicle Record (MVR)</strong> has been processed and is available in your Provven account.',
    employerTitle: (candidateName: string) => `MVR ready: ${candidateName}`,
    employerPreheader: 'A requested motor vehicle record is available on Provven',
    employerLead: (candidateName: string, companyName: string) =>
      `The <strong>MVR</strong> you requested for <strong>${candidateName}</strong> (${companyName}) has finished processing and is available in Provven.`,
  },
  psp: {
    candidateTitle: 'Your PSP report is ready',
    candidatePreheader: 'Your FMCSA PSP screening has arrived on Provven',
    candidateLead:
      'Your <strong>FMCSA PSP</strong> (crash and inspection history) report has been processed and is available in your Provven account.',
    employerTitle: (candidateName: string) => `PSP report ready: ${candidateName}`,
    employerPreheader: 'A requested FMCSA PSP report is available on Provven',
    employerLead: (candidateName: string, companyName: string) =>
      `The <strong>FMCSA PSP</strong> report you requested for <strong>${candidateName}</strong> (${companyName}) has finished processing and is available in Provven.`,
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
  if (!isMessagingConfigured()) {
    console.warn('[SCREENING READY] PINGRAM_API_KEY not set, skipping candidate email')
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
        Log in to review the result in your screening block. If anything looks incorrect, contact support through Provven.
      </p>
    `)}
  `

  const html = buildEmail({
    preheader: copy.candidatePreheader,
    headerEyebrow: 'Provven',
    headerTitle: copy.candidateTitle,
    greeting: `Hi ${first},`,
    bodyHtml,
    ctaLabel: kind === 'mvr' ? 'View MVR' : 'View PSP report',
    ctaUrl,
    footerNote: `You're receiving this because a motor vehicle or FMCSA screening tied to your account completed. Reply to this email with questions.`,
  })

  const result = await sendEmail({
    type: 'screening_ready_candidate',
    to: candidateEmail,
    subject: `[Provven] ${copy.candidateTitle}`,
    html,
  })
  if (!result.ok) {
    console.error('[SCREENING READY] Candidate send failed:', result.error)
    return { ok: false, error: result.error }
  }
  console.log('[SCREENING READY] Candidate email sent. Pingram id:', result.id)
  return { ok: true }
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
  if (!isMessagingConfigured()) {
    console.warn('[SCREENING READY] PINGRAM_API_KEY not set, skipping employer email')
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
        Open Provven to view the report in your hiring workflow. Full report details stay inside Provven — we never send the screening document by email.
      </p>
    `)}
  `

  const html = buildEmail({
    preheader: copy.employerPreheader,
    headerEyebrow: companyName,
    headerTitle: copy.employerTitle(candidateDisplayName),
    greeting: `Hi ${first},`,
    bodyHtml,
    ctaLabel: 'Open Provven',
    ctaUrl,
    footerNote: `You're receiving this because your company requested this screening on Provven.`,
  })

  const result = await sendEmail({
    type: 'screening_ready_employer',
    to: employerEmail,
    subject: `[Provven] ${copy.employerTitle(candidateDisplayName)}`,
    html,
  })
  if (!result.ok) {
    console.error('[SCREENING READY] Employer send failed:', result.error)
    return { ok: false, error: result.error }
  }
  console.log('[SCREENING READY] Employer email sent. Pingram id:', result.id)
  return { ok: true }
}

// ─── Employer: candidate completed a major action ────────────────────────────

export type EmployerCandidateActionEmailKind =
  | 'screening_consent'
  | 'bgcheck_consent'
  | 'psp_consent'
  | 'block_completed'
  | 'invite_completed'

const EMPLOYER_ACTION_EMAIL_COPY: Record<
  EmployerCandidateActionEmailKind,
  {
    subject: (candidateName: string) => string
    title: (candidateName: string) => string
    preheader: string
    lead: (candidateName: string, companyName: string, blockLabel: string | null) => string
    ctaLabel: string
  }
> = {
  screening_consent: {
    subject: (n) => `${n} completed screening consent`,
    title: (n) => `Screening consent complete`,
    preheader: 'FCRA, FMCSA, and CDLIS package signed — ready to order MVR/PSP',
    lead: (n, c) =>
      `<strong>${n}</strong> completed the full screening consent package (FCRA background check authorization, FMCSA PSP disclosure, and CDLIS written consent) for <strong>${c}</strong>. You can now place MVR and PSP orders from Outreach without sending another invite.`,
    ctaLabel: 'Open Provven',
  },
  bgcheck_consent: {
    subject: (n) => `${n} signed background check consent`,
    title: () => `Background check consent signed`,
    preheader: 'A candidate signed your FCRA authorization',
    lead: (n, c) =>
      `<strong>${n}</strong> signed the background check authorization for <strong>${c}</strong>.`,
    ctaLabel: 'Open Provven',
  },
  psp_consent: {
    subject: (n) => `${n} signed PSP disclosure`,
    title: () => `PSP disclosure signed`,
    preheader: 'FMCSA PSP disclosure recorded on Provven',
    lead: (n, c) =>
      `<strong>${n}</strong> signed the FMCSA PSP Disclosure &amp; Authorization for <strong>${c}</strong>.`,
    ctaLabel: 'Open Provven',
  },
  block_completed: {
    subject: (n) => `${n} completed your request`,
    title: () => `Request fulfilled`,
    preheader: 'A candidate finished something you requested on Provven',
    lead: (n, c, block) =>
      block
        ? `<strong>${n}</strong> completed your <strong>${block}</strong> request for <strong>${c}</strong>.`
        : `<strong>${n}</strong> fulfilled a request for <strong>${c}</strong>.`,
    ctaLabel: 'View in Provven',
  },
  invite_completed: {
    subject: (n) => `${n} completed your invite`,
    title: () => `Outreach invite completed`,
    preheader: 'A candidate finished the step from your invite link',
    lead: (n, c, block) =>
      block
        ? `<strong>${n}</strong> completed <strong>${block}</strong> from your outreach invite for <strong>${c}</strong>.`
        : `<strong>${n}</strong> completed the step from your outreach invite for <strong>${c}</strong>.`,
    ctaLabel: 'View Outreach',
  },
}

/**
 * Confirmation email to the employer when a candidate completes a major action
 * (consent package, block request, invite step, etc.).
 */
export async function sendEmployerCandidateActionCompleteEmail(params: {
  kind: EmployerCandidateActionEmailKind
  employerEmail: string
  employerFirstName: string
  companyName: string
  candidateDisplayName: string
  blockLabel?: string | null
  ctaUrl: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!isMessagingConfigured()) {
    console.warn('[EMPLOYER ACTION EMAIL] PINGRAM_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const {
    kind,
    employerEmail,
    employerFirstName,
    companyName,
    candidateDisplayName,
    blockLabel = null,
    ctaUrl,
  } = params
  const copy = EMPLOYER_ACTION_EMAIL_COPY[kind]
  const first = employerFirstName.trim() || 'there'
  const candidate = candidateDisplayName.trim() || 'A candidate'

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
      ${copy.lead(candidate, companyName, blockLabel)}
    </p>
    ${infoBox(`
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">
        Open Provven to review the update in your hiring workflow. Sensitive screening documents are never sent by email — only this confirmation.
      </p>
    `)}
  `

  const html = buildEmail({
    preheader: copy.preheader,
    headerEyebrow: companyName,
    headerTitle: copy.title(candidate),
    greeting: `Hi ${first},`,
    bodyHtml,
    ctaLabel: copy.ctaLabel,
    ctaUrl,
    footerNote: `You're receiving this because a candidate completed an action tied to ${companyName} on Provven.`,
  })

  const result = await sendEmail({
    type: 'employer_candidate_action',
    to: employerEmail,
    subject: `[Provven] ${copy.subject(candidate)}`,
    html,
  })
  if (!result.ok) {
    console.error('[EMPLOYER ACTION EMAIL] Send failed:', result.error)
    return { ok: false, error: result.error }
  }
  console.log('[EMPLOYER ACTION EMAIL] Sent. Pingram id:', result.id, 'kind:', kind)
  return { ok: true }
}
