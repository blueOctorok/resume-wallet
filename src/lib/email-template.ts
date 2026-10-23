import { HOT_EMBERS, MIDNIGHT } from '@/lib/brand-colors'
import { getAppBaseUrl } from '@/lib/app-url'

/**
 * Shared Provven email template.
 *
 * Every outgoing email uses this, so the chrome lives in one place:
 *   - Blue Star lockup (ember shield + PROVVEN) on brand paper
 *   - Solid Midnight header, cream type, a 3px Hot Embers rule
 *   - White card, Hot Embers button
 *
 * Callers only supply the content.
 */

const PAPER = '#f3f4f5'
const CREAM = '#f4f1ea'
const TYPE = '#173150'

export interface EmailTemplateOptions {
  /** Short preview text shown in inbox before opening */
  preheader?: string
  /** Bold text in the teal gradient header */
  headerTitle: string
  /** Smaller text above the title (e.g. company name, "Provven Notification") */
  headerEyebrow?: string
  /** First line of body (e.g. "Hi Leon,") */
  greeting?: string
  /** Main body HTML — rendered inside the white card */
  bodyHtml: string
  /** Primary CTA button label */
  ctaLabel?: string
  /** Primary CTA button URL */
  ctaUrl?: string
  /** Small gray footer note (below the divider) */
  footerNote?: string
  /** Accent/highlight color for status boxes etc. Default: teal */
  accentColor?: string
}

const TEAL = HOT_EMBERS
const TEAL_BG = '#fef4f0'
const TEAL_BORDER = HOT_EMBERS

export function buildEmail(opts: EmailTemplateOptions): string {
  const {
    preheader = '',
    headerTitle,
    headerEyebrow = 'Provven',
    greeting,
    bodyHtml,
    ctaLabel,
    ctaUrl,
    footerNote,
    accentColor = TEAL,
  } = opts

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>`
    : ''

  const greetingHtml = greeting
    ? `<p style="margin:0 0 16px;color:#475569;font-size:15px;font-weight:500;">${greeting}</p>`
    : ''

  const ctaHtml = ctaLabel && ctaUrl
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
         <tr>
           <td align="center">
             <a href="${ctaUrl}"
                style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 40px;border-radius:10px;letter-spacing:0.2px;">
               ${ctaLabel} →
             </a>
           </td>
         </tr>
       </table>`
    : ''

  const footerHtml = footerNote
    ? `<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">${footerNote}</p>`
    : `<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
         You're receiving this from Provven. If you weren't expecting this email, you can safely ignore it.
       </p>`

  const markUrl = `${getAppBaseUrl()}/brand/provven-mark.png`
  const sans = "Montserrat,Arial,Helvetica,sans-serif"

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${sans};color:${TYPE};">
  ${preheaderHtml}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Lockup: ember shield + PROVVEN. PNG because inboxes drop SVG. -->
        <tr>
          <td style="padding-bottom:20px;" align="center">
            <table cellpadding="0" cellspacing="0" role="presentation" style="display:inline-table;">
              <tr>
                <td style="padding-right:8px;vertical-align:middle;">
                  <img src="${markUrl}" width="22" height="23" alt="" style="display:block;border:0;height:22px;width:auto;">
                </td>
                <td style="vertical-align:middle;font-family:${sans};font-size:15px;font-weight:700;letter-spacing:0.12em;color:${MIDNIGHT};">
                  PROVVEN
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(23,49,80,0.08);">

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${MIDNIGHT};padding:28px 40px 22px;">
                  <p style="margin:0 0 6px;color:${CREAM};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;font-family:${sans};">${headerEyebrow}</p>
                  <h1 style="margin:0;color:${CREAM};font-size:24px;font-weight:700;line-height:1.25;font-family:${sans};">${headerTitle}</h1>
                </td>
              </tr>
              <tr>
                <td style="background:${HOT_EMBERS};height:3px;font-size:0;line-height:3px;">&nbsp;</td>
              </tr>
            </table>

            <!-- Body -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:36px 40px;">
                  ${greetingHtml}
                  ${bodyHtml}
                  ${ctaHtml}
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 16px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-top:1px solid #e2e8f0;padding-top:20px;">
                  ${footerHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Convenience helper for a teal info/highlight box inside the body.
 */
export function infoBox(content: string, color = TEAL): string {
  const bg = color === TEAL ? TEAL_BG : `${color}10`
  const border = color === TEAL ? TEAL_BORDER : `${color}40`
  return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:16px 20px;margin:20px 0;">
    ${content}
  </div>`
}

/**
 * Convenience helper for a gray details box (e.g. job/company details).
 */
export function detailsBox(content: string): string {
  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin:20px 0;">
    ${content}
  </div>`
}

/**
 * A simple key/value row for use inside detailsBox.
 */
export function detailRow(label: string, value: string): string {
  return `<p style="margin:0 0 8px;font-size:14px;color:#374151;">
    <span style="color:#64748b;">${label}:</span>&nbsp;<strong>${value}</strong>
  </p>`
}

/**
 * A checklist item.
 */
export function checklistItem(text: string): string {
  return `<p style="margin:0 0 8px;font-size:14px;color:#374151;padding-left:20px;position:relative;">
    <span style="position:absolute;left:0;color:${TEAL};">✓</span> ${text}
  </p>`
}

/**
 * A fallback text link block (below CTA button).
 */
export function fallbackLink(url: string): string {
  return `<p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
    If the button doesn't work, copy and paste this URL into your browser:<br>
    <a href="${url}" style="color:${TEAL};word-break:break-all;">${url}</a>
  </p>`
}
