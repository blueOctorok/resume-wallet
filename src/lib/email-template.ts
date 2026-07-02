/**
 * Shared Storm email template builder.
 *
 * Every outgoing email uses this function so they all have the same:
 *   - Logo badge (Storm, teal pill)
 *   - Teal gradient header band with title + subtitle
 *   - White card body with consistent typography
 *   - Teal CTA button
 *   - Consistent footer
 *
 * Callers only supply the content — never the chrome.
 */

export interface EmailTemplateOptions {
  /** Short preview text shown in inbox before opening */
  preheader?: string
  /** Bold text in the teal gradient header */
  headerTitle: string
  /** Smaller text above the title (e.g. company name, "Storm Notification") */
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

const TEAL = '#0d9488'
const TEAL_DARK = '#0f766e'
const TEAL_LIGHT = '#14b8a6'
const TEAL_BG = '#f0fdfa'
const TEAL_BORDER = '#99f6e4'

export function buildEmail(opts: EmailTemplateOptions): string {
  const {
    preheader = '',
    headerTitle,
    headerEyebrow = 'ZKnight',
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
         You're receiving this from ZKnight. If you weren't expecting this email, you can safely ignore it.
       </p>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;">
  ${preheaderHtml}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Logo -->
        <tr>
          <td style="padding-bottom:20px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="display:inline-table;">
              <tr>
                <td style="background:${TEAL};border-radius:10px;padding:8px 18px;">
                  <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">ZKnight</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

            <!-- Header band -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,${TEAL_DARK} 0%,${TEAL} 60%,${TEAL_LIGHT} 100%);padding:32px 40px;">
                  <p style="margin:0 0 4px;color:#99f6e4;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">${headerEyebrow}</p>
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;line-height:1.25;">${headerTitle}</h1>
                </td>
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
