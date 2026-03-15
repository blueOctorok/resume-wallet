import { Resend } from 'resend'
import { buildEmail, infoBox, fallbackLink } from './email-template'
import { getBlockDefinition } from './block-registry'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'stormchain@verify.stormchain.ai'

export interface SendInviteEmailParams {
  to: string
  targetBlockType: string | null
  candidateName?: string
  companyName: string
  jobTitle?: string
  inviteLink: string
  welcomeMessage?: string
}

interface EmailContent {
  subject: string
  headline: string
  intro: string
  checklistTitle: string
  checklist: string[]
  timeEstimate: string
  ctaLabel: string
}

/**
 * Build email content from a block definition (or fall back to general).
 *
 * This is the key insight: instead of a 3-way switch on hardcoded invite types,
 * we use the block registry to dynamically generate email content for ANY block.
 * When a new block is added to the registry in the future, emails work automatically.
 */
function getEmailContent(targetBlockType: string | null, companyName: string, jobTitle?: string): EmailContent {
  const job = jobTitle ? ` for ${jobTitle}` : ''

  // Block-targeted invite — pull label/description from registry
  if (targetBlockType) {
    const block = getBlockDefinition(targetBlockType)
    const label = block?.label ?? 'Application'
    const description = block?.description ?? 'Complete your professional profile'

    return {
      subject: jobTitle
        ? `${companyName} — Complete your ${label} for ${jobTitle}`
        : `${companyName} — Complete your ${label}`,
      headline: `${companyName} wants you on their team${job}`,
      intro: `${companyName} has invited you to complete a ${label} through StormChain — a secure, blockchain-verified platform. ${description}. Your data is stored safely and only shared with companies you authorize.`,
      checklistTitle: "What you'll do:",
      checklist: [
        'Create your free StormChain account',
        `Complete your ${label}`,
        'Review and submit your information',
        `Connect directly with ${companyName}`,
      ],
      timeEstimate: '10–20 minutes',
      ctaLabel: `Start My ${label}`,
    }
  }

  // General invite — no specific block target
  return {
    subject: `You've been invited to StormChain by ${companyName}`,
    headline: `${companyName} invited you to StormChain`,
    intro: `StormChain is a blockchain-verified credential platform for professionals. ${companyName} is using it to find and verify top talent. Joining takes just a few minutes.`,
    checklistTitle: "What you'll do:",
    checklist: [
      'Create your free StormChain account',
      'Set up your professional profile',
      'Add relevant credentials and documents',
      `Connect directly with companies like ${companyName}`,
    ],
    timeEstimate: '5–10 minutes to get started',
    ctaLabel: 'Join StormChain',
  }
}

/**
 * Sends a block-aware outreach invite email to a candidate.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendInviteEmail(
  params: SendInviteEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[INVITE EMAIL] RESEND_API_KEY not set, skipping send')
    return { ok: false, error: 'Email not configured' }
  }

  const { candidateName, companyName, inviteLink, welcomeMessage, targetBlockType } = params
  const content = getEmailContent(targetBlockType, companyName, params.jobTitle)
  const greeting = candidateName ? `Hi ${candidateName.split(' ')[0]},` : 'Hello,'

  const checklistHtml = content.checklist
    .map(item => `<p style="margin:0 0 8px;font-size:14px;color:#374151;padding-left:20px;position:relative;">
      <span style="position:absolute;left:0;color:#0d9488;">✓</span> ${item}
    </p>`)
    .join('')

  const customMessageHtml = welcomeMessage
    ? infoBox(`
        <p style="margin:0 0 4px;font-size:14px;font-style:italic;color:#134e4a;">"${welcomeMessage}"</p>
        <p style="margin:0;font-size:12px;color:#5eead4;">— ${companyName}</p>
      `)
    : ''

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${content.intro}</p>
    ${customMessageHtml}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;">${content.checklistTitle}</p>
      ${checklistHtml}
      <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">⏱ ${content.timeEstimate}</p>
    </div>
    ${infoBox(`<p style="margin:0;font-size:13px;color:#0f766e;line-height:1.5;">
      <strong>🔒 Your data is secure.</strong><br>
      StormChain uses blockchain verification to protect your credentials. Only ${companyName} will have access to your application.
    </p>`)}
    ${fallbackLink(inviteLink)}
  `

  const html = buildEmail({
    preheader: content.subject,
    headerEyebrow: companyName,
    headerTitle: content.headline,
    greeting,
    bodyHtml,
    ctaLabel: `${content.ctaLabel} →`,
    ctaUrl: inviteLink,
    footerNote: `This invitation was sent by <strong>${companyName}</strong> through StormChain. If you weren't expecting this, you can safely ignore it.`,
  })

  try {
    console.log('[INVITE EMAIL] Sending targetBlock=%s to=%s from=%s', targetBlockType ?? 'general', params.to, FROM)
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
