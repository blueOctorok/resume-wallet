/**
 * Premium DOT-packet PDF — mirrors DriverResumeDocument / example_resume.png.
 * Dual QR codes encode the public career card URL.
 */

import { jsPDF } from 'jspdf'
import type { DriverResumePacket } from '@/lib/driver-resume-packet'

const MARGIN = 18
const QR_TOP = 22
const QR_FOOTER = 18

async function qrPngDataUrl(verifyUrl: string, size: number): Promise<string | null> {
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(verifyUrl, {
      width: size * 4,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } catch {
    return null
  }
}

/**
 * Generate a Buffer for the premium driver resume packet PDF.
 * Async because QR generation is async.
 */
export async function generateDriverResumePacketPDF(
  packet: DriverResumePacket,
): Promise<Buffer> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentRight = pageWidth - MARGIN - QR_TOP - 4
  let y = MARGIN

  const textDark: [number, number, number] = [28, 25, 23]
  const textMid: [number, number, number] = [87, 83, 78]
  const textMuted: [number, number, number] = [120, 113, 108]
  const linkAmber: [number, number, number] = [146, 64, 14]
  const greenDot: [number, number, number] = [74, 124, 98]
  const rule: [number, number, number] = [214, 211, 209]

  const qrTop = await qrPngDataUrl(packet.verifyUrl, 128)
  const qrFoot = qrTop // same URL

  const checkPage = (need: number) => {
    if (y + need > pageHeight - MARGIN - 8) {
      pdf.addPage()
      y = MARGIN
    }
  }

  const drawSectionHeader = (title: string) => {
    checkPage(14)
    y += 4
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...textMuted)
    pdf.text(title.toUpperCase(), MARGIN, y)
    y += 2
    pdf.setDrawColor(...rule)
    pdf.setLineWidth(0.3)
    pdf.line(MARGIN, y, pageWidth - MARGIN, y)
    y += 5
  }

  // === HEADER ===
  pdf.setFont('times', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor(...textDark)
  const nameLines = pdf.splitTextToSize(packet.fullName, contentRight - MARGIN)
  pdf.text(nameLines, MARGIN, y + 6)
  let nameBottom = y + 6 + nameLines.length * 8

  // Top-right QR
  const qrX = pageWidth - MARGIN - QR_TOP
  if (qrTop) {
    pdf.addImage(qrTop, 'PNG', qrX, y, QR_TOP, QR_TOP)
  } else {
    pdf.setDrawColor(...textDark)
    pdf.rect(qrX, y, QR_TOP, QR_TOP)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...greenDot)
    pdf.text('ZK', qrX + QR_TOP / 2, y + QR_TOP / 2 + 1.5, { align: 'center' })
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(...textMuted)
  const qrLabelLines = pdf.splitTextToSize(packet.qrLabelTop, QR_TOP + 6)
  pdf.text(qrLabelLines, qrX + QR_TOP / 2, y + QR_TOP + 3.5, { align: 'center' })

  y = nameBottom + 2
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...textMid)
  if (packet.tagline) {
    pdf.text(packet.tagline, MARGIN, y)
    y += 4.5
  }
  if (packet.contactLine) {
    pdf.text(packet.contactLine, MARGIN, y)
    y += 5
  }

  // Clear past QR block
  y = Math.max(y, MARGIN + QR_TOP + 10)

  // === PROOF CHIPS ===
  if (packet.proofChips.length > 0) {
    checkPage(12)
    let chipX = MARGIN
    const chipY = y
    const chipH = 6.5
    pdf.setFontSize(8)
    for (const chip of packet.proofChips) {
      const labelW = pdf.getTextWidth(chip.label) + 8
      if (chipX + labelW > pageWidth - MARGIN) {
        chipX = MARGIN
        y += chipH + 2
      }
      // pill outline
      pdf.setDrawColor(...rule)
      pdf.setFillColor(250, 250, 249)
      pdf.roundedRect(chipX, y, labelW, chipH, 1.5, 1.5, 'FD')
      // green dot
      pdf.setFillColor(...greenDot)
      pdf.circle(chipX + 3, y + chipH / 2, 0.9, 'F')
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...textDark)
      pdf.text(chip.label, chipX + 5.5, y + chipH / 2 + 1.1)
      chipX += labelW + 2.5
    }
    y = Math.max(y, chipY) + chipH + 4
  }

  // Metadata line
  pdf.setDrawColor(...rule)
  pdf.setLineWidth(0.25)
  pdf.line(MARGIN, y, pageWidth - MARGIN, y)
  y += 4.5
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...textMuted)
  if (packet.hasVerifiedClaims) {
    const metaLeft = `Provven-verified • as of ${packet.asOfLabel} • expires ${packet.expiresLabel} • `
    pdf.text(metaLeft, MARGIN, y)
    const leftW = pdf.getTextWidth(metaLeft)
    pdf.setTextColor(...linkAmber)
    pdf.text(packet.verifyDisplayPath, MARGIN + leftW, y)
  } else {
    pdf.text('Candidate packet • ', MARGIN, y)
    const leftW = pdf.getTextWidth('Candidate packet • ')
    pdf.setTextColor(...linkAmber)
    pdf.text(packet.verifyDisplayPath, MARGIN + leftW, y)
  }
  y += 6

  if (packet.thinStateHint) {
    checkPage(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.setTextColor(...textMuted)
    const hintLines = pdf.splitTextToSize(packet.thinStateHint, pageWidth - MARGIN * 2)
    pdf.text(hintLines, MARGIN, y)
    y += hintLines.length * 4 + 2
  }

  // CREDENTIALS
  if (packet.credentials.length > 0) {
    drawSectionHeader('Credentials')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...textDark)
    for (const line of packet.credentials) {
      checkPage(6)
      const lines = pdf.splitTextToSize(line, pageWidth - MARGIN * 2)
      pdf.text(lines, MARGIN, y)
      y += lines.length * 4.5 + 1
    }
  }

  // EXPERIENCE
  if (packet.experience.length > 0) {
    drawSectionHeader('Experience')
    for (const row of packet.experience) {
      checkPage(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...textDark)
      const titleMax = pageWidth - MARGIN * 2 - 28
      const titleLines = pdf.splitTextToSize(row.titleLine, titleMax)
      pdf.text(titleLines, MARGIN, y)
      if (row.dateRange) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(...textMuted)
        pdf.text(row.dateRange, pageWidth - MARGIN, y, { align: 'right' })
      }
      y += titleLines.length * 4.5 + 1
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...textMid)
      for (const b of row.bullets) {
        checkPage(6)
        const bl = pdf.splitTextToSize(`•  ${b}`, pageWidth - MARGIN * 2 - 2)
        pdf.text(bl, MARGIN + 1, y)
        y += bl.length * 4 + 0.5
      }
      y += 3
    }
  }

  // SAFETY
  if (packet.safetySummary) {
    drawSectionHeader('Safety summary (driver-stated)')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...textDark)
    const sLines = pdf.splitTextToSize(packet.safetySummary, pageWidth - MARGIN * 2)
    pdf.text(sLines, MARGIN, y)
    y += sLines.length * 4.5 + 2
  }

  // FOOTER — pin near bottom when room, else flow
  const footerBlockH = QR_FOOTER + 18
  if (y + footerBlockH + 8 > pageHeight - MARGIN) {
    pdf.addPage()
    y = MARGIN
  } else {
    y = Math.max(y + 6, pageHeight - MARGIN - footerBlockH - 4)
  }

  pdf.setDrawColor(...rule)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN, y, pageWidth - MARGIN, y)
  y += 5

  const footQrX = MARGIN
  if (qrFoot) {
    pdf.addImage(qrFoot, 'PNG', footQrX, y, QR_FOOTER, QR_FOOTER)
  } else {
    pdf.setDrawColor(...textDark)
    pdf.rect(footQrX, y, QR_FOOTER, QR_FOOTER)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...greenDot)
    pdf.text('ZK', footQrX + QR_FOOTER / 2, y + QR_FOOTER / 2 + 1, { align: 'center' })
  }

  const textX = footQrX + QR_FOOTER + 4
  const textW = pageWidth - MARGIN - textX
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...textDark)
  pdf.text(packet.footerTitle, textX, y + 3.5)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...textMuted)
  const bodyLines = pdf.splitTextToSize(packet.footerBody, textW)
  pdf.text(bodyLines, textX, y + 8)

  let footMetaY = y + 8 + bodyLines.length * 3.5 + 1.5
  pdf.setFontSize(8)
  pdf.setTextColor(...linkAmber)
  pdf.text(packet.verifyDisplayPath, textX, footMetaY)
  if (packet.hasVerifiedClaims) {
    const pathW = pdf.getTextWidth(packet.verifyDisplayPath)
    pdf.setTextColor(...textMuted)
    pdf.text(` • proofs expire ${packet.expiresLabel}`, textX + pathW, footMetaY)
  }

  const pdfOutput = pdf.output('arraybuffer')
  return Buffer.from(pdfOutput)
}
