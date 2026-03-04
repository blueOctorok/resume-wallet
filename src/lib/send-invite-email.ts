import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

export type InviteType = 'driver_dot' | 'developer_card' | 'general'

export interface SendInviteEmailParams {
  to: string
  type: InviteType
  candidateName?: string
  companyName: string
  jobTitle?: string
  inviteLink: string
  welcomeMessage?: string
}

// ─── Per-type email content ──────────────────────────────────────────────────

interface EmailContent {
  subject: string
  headline: string
  intro: string
  checklistTitle: string
  checklist: string[]
  timeEstimate: string
  ctaLabel: string
}

function getEmailContent(
  type: InviteType,
  companyName: string,
  jobTitle?: string
): EmailContent {
  const job = jobTitle ? ` for ${jobTitle}` : ''

  switch (type) {
    case 'developer_card':
      return {
        subject: `${companyName} wants to connect — set up your StormChain career card`,
        headline: `${companyName} found your profile`,
        intro: `${companyName} is interested in connecting with you${job}. They'd like you to set up your StormChain career card — a verified professional profile that showcases your skills, work history, and credentials.`,
        checklistTitle: "What you'll add to your career card:",
        checklist: [
          'Professional summary and skills',
          'GitHub, LinkedIn, or portfolio links',
          'Work history and experience',
          'Any relevant certifications',
        ],
        timeEstimate: '10–15 minutes to complete',
        ctaLabel: 'Set Up My Career Card',
      }
    case 'general':
      return {
        subject: `You've been invited to StormChain by ${companyName}`,
        headline: `${companyName} invited you to StormChain`,
        intro: `StormChain is a blockchain-verified credential platform for drivers and developers. ${companyName} is using it to find and verify top talent. Joining takes just a few minutes.`,
        checklistTitle: "What you'll do:",
        checklist: [
          'Create your free StormChain account',
          'Choose your role (driver or developer)',
          'Build your verified professional profile',
          'Connect directly with companies like ' + companyName,
        ],
        timeEstimate: '5–10 minutes to get started',
        ctaLabel: 'Join StormChain',
      }
    case 'driver_dot':
    default:
      return {
        subject: jobTitle
          ? `${companyName} — Complete your DOT application for ${jobTitle}`
          : `${companyName} — Complete your DOT application`,
        headline: `${companyName} wants you on their team${job}`,
        intro: `${companyName} has invited you to complete a DOT application through StormChain — a secure, blockchain-verified platform. Your application data is stored safely and only shared with the companies you authorize.`,
        checklistTitle: "What you'll need:",
        checklist: [
          "Driver's license / CDL information",
          'Employment history (last 10 years)',
          'Driving record (accidents, violations)',
          'Medical certificate information',
        ],
        timeEstimate: '15–25 minutes to complete',
        ctaLabel: 'Start My DOT Application',
      }
  }
}

// ─── Email HTML builder ──────────────────────────────────────────────────────

function buildEmailHtml(params: SendInviteEmailParams, content: EmailContent): string {
  const { candidateName, companyName, inviteLink, welcomeMessage } = params
  const greeting = candidateName ? `Hi ${candidateName},` : 'Hello,'

  const customMessageBlock = welcomeMessage
    ? `<div style="background:#f0fdfa;border-left:4px solid #0d9488;padding:14px 18px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;color:#134e4a;font-style:italic;">"${welcomeMessage}"</p>
        <p style="margin:6px 0 0;font-size:13px;color:#5eead4;">— ${companyName}</p>
       </div>`
    : ''

  const checklistItems = content.checklist
    .map(item => `<li style="margin:8px 0;padding-left:4px;">${item}</li>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${content.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Logo header -->
        <tr>
          <td style="padding-bottom:24px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="display:inline-block;">
              <tr>
                <td style="background:#0d9488;border-radius:12px;padding:10px 20px;">
                  <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Storm</span><span style="color:#5eead4;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Chain</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Main card -->
        <tr>
          <td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

            <!-- Colored header band -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 60%,#14b8a6 100%);padding:36px 40px;">
                  <p style="margin:0 0 4px;color:#99f6e4;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${companyName}</p>
                  <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;line-height:1.2;">${content.headline}</h1>
                </td>
              </tr>
            </table>

            <!-- Body -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:36px 40px;">
                  <p style="margin:0 0 16px;color:#475569;font-size:15px;">${greeting}</p>
                  <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.6;">${content.intro}</p>

                  ${customMessageBlock}

                  <!-- Checklist -->
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px 28px;margin:24px 0;">
                    <p style="margin:0 0 14px;font-weight:700;color:#0f172a;font-size:15px;">${content.checklistTitle}</p>
                    <ul style="margin:0;padding-left:18px;color:#475569;font-size:14px;line-height:1.6;">
                      ${checklistItems}
                    </ul>
                    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;display:flex;align-items:center;gap:6px;">
                      ⏱ ${content.timeEstimate}
                    </p>
                  </div>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
                    <tr>
                      <td align="center">
                        <a href="${inviteLink}"
                           style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 40px;border-radius:10px;letter-spacing:0.2px;">
                          ${content.ctaLabel} →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Trust badge -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:16px 20px;">
                        <p style="margin:0;font-size:13px;color:#0f766e;line-height:1.5;">
                          <strong>🔒 Your data is secure.</strong><br>
                          StormChain uses blockchain verification to protect your credentials. Only ${companyName} will have access to your application.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback link -->
                  <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${inviteLink}" style="color:#0d9488;word-break:break-all;">${inviteLink}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              This invitation was sent by <strong>${companyName}</strong> through StormChain.<br>
              If you weren't expecting this, you can safely ignore this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Sends a typed outreach invite email to a candidate.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendInviteEmail(
  params: SendInviteEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[INVITE EMAIL] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const content = getEmailContent(params.type, params.companyName, params.jobTitle)
  const html = buildEmailHtml(params, content)

  try {
    console.log('[INVITE EMAIL] Sending type=%s to=%s from=%s', params.type, params.to, FROM)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: content.subject,
      html,
    })
    if (error) {
      console.error('[INVITE EMAIL] Resend error:', error)
      return { ok: false, error: error.message }
    }
    console.log('[INVITE EMAIL] Sent successfully. Resend id:', data?.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[INVITE EMAIL] Send failed:', err)
    return { ok: false, error: message }
  }
}
