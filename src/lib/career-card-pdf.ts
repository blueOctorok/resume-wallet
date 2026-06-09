/**
 * Career Card as PDF — visual “card” page + plain-text ATS page.
 * Used when candidates export for Indeed / ATS uploads.
 */
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import type { ProjectedCareerCard } from '@/types/career-card'

const TEAL: [number, number, number] = [20, 184, 166]
const SLATE: [number, number, number] = [15, 23, 42]
const MUTED: [number, number, number] = [100, 116, 139]

export async function buildCareerCardPdfBuffer(
  card: ProjectedCareerCard,
  publicCardUrl: string,
): Promise<ArrayBuffer> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 14
  let y = margin

  const qrDataUrl = await QRCode.toDataURL(publicCardUrl, { margin: 1, width: 160, color: { dark: '#0d9488', light: '#ffffff' } })

  // ── Page 1: branded card summary ───────────────────────────────────────
  pdf.setFillColor(...SLATE)
  pdf.rect(0, 0, pageW, 42, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(card.name, margin, 22)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  const headline = card.occupation || 'Storm Career Card'
  pdf.text(headline.slice(0, 90), margin, 30)
  pdf.setFontSize(8)
  pdf.setTextColor(...TEAL)
  pdf.text('Verified by Storm — selective disclosure career platform', margin, 37)

  y = 52
  pdf.setTextColor(...SLATE)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Trust signals', margin, y)
  y += 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...MUTED)
  pdf.text(`Career card score: ${card.careerCardScore} / 100`, margin, y)
  y += 6
  pdf.text(`Employer confirmations: ${card.employerConfirmedEmploymentCount}`, margin, y)
  y += 10

  pdf.setTextColor(...SLATE)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Sections on your card', margin, y)
  y += 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(55, 65, 81)
  for (const s of card.sections) {
    if (y > pageH - margin - 40) break
    pdf.text(`• ${s.label}`, margin + 2, y)
    y += 5
  }

  y = pageH - margin - 42
  pdf.addImage(qrDataUrl, 'PNG', margin, y, 32, 32)
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text('Scan for live Career Card on Storm', margin + 36, y + 10)
  pdf.text(publicCardUrl.slice(0, 80), margin + 36, y + 16)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...TEAL)
  pdf.text('stormchain.ai', margin, pageH - 8)

  // ── Page 2: ATS plain text ───────────────────────────────────────────────
  pdf.addPage()
  y = margin
  pdf.setTextColor(...SLATE)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Plain text profile (ATS)', margin, y)
  y += 10
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(30, 41, 59)

  const lines: string[] = [
    `NAME: ${card.name}`,
    card.occupation ? `HEADLINE: ${card.occupation}` : '',
    card.location ? `LOCATION: ${card.location}` : '',
    card.professionalSummary ? `SUMMARY: ${card.professionalSummary}` : '',
    '',
    'SECTIONS:',
    ...card.sections.map((s) => `- ${s.label}`),
    '',
    `EMPLOYER_CONFIRMATIONS: ${card.employerConfirmedEmploymentCount}`,
    `CAREER_CARD_SCORE: ${card.careerCardScore}`,
    '',
    `PUBLIC_CARD_URL: ${publicCardUrl}`,
  ].filter((l) => l !== '')

  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line, pageW - margin * 2)
    for (const wline of wrapped) {
      if (y > pageH - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(wline, margin, y)
      y += 5
    }
  }

  return pdf.output('arraybuffer') as ArrayBuffer
}
