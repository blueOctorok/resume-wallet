/**
 * Premium DOT-packet PDF — mirrors DriverResumeDocument / example_resume.png.
 * Dual QR codes encode the public career card URL.
 */

import { jsPDF } from 'jspdf'
import { resumeProofRank, type DriverResumePacket } from '@/lib/driver-resume-packet'

const MARGIN = 18
const QR_TOP = 22
const QR_FOOTER = 18

async function publicPngDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path)
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return `data:image/png;base64,${btoa(binary)}`
  } catch {
    return null
  }
}

async function qrPngDataUrl(verifyUrl: string, size: number): Promise<string | null> {
  try {
    const { qrDataUrlWithProvvenMark } = await import('@/lib/provven-qr')
    return await qrDataUrlWithProvvenMark(verifyUrl, size * 4)
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

  const [qrTop, provvenMark, paper] = await Promise.all([
    qrPngDataUrl(packet.verifyUrl, 128),
    publicPngDataUrl('/brand/provven-mark.png'),
    publicPngDataUrl('/brand/resume-paper.png?v=2'),
  ])
  const qrFoot = qrTop // same URL

  const checkPage = (need: number) => {
    if (y + need > pageHeight - MARGIN - 8) {
      pdf.addPage()
      paintPage()
      y = MARGIN
    }
  }

  const paintPage = () => {
    pdf.setFillColor(246, 246, 246)
    pdf.rect(0, 0, pageWidth, pageHeight, 'F')
    if (paper) {
      // Same cotton tile as the screen. Alias keeps one copy of the image in the file.
      const tileW = 110
      const tileH = tileW * (493 / 740)
      for (let yy = 0; yy < pageHeight; yy += tileH) {
        for (let xx = 0; xx < pageWidth; xx += tileW) {
          pdf.addImage(paper, 'PNG', xx, yy, tileW + 0.4, tileH + 0.4, 'resume-paper', 'FAST')
        }
      }
    }
    pdf.setFillColor(23, 49, 80)
    pdf.rect(0, 0, pageWidth, 2.2, 'F')
  }
  paintPage()

  const drawDiamondRule = (yLine: number, ink: [number, number, number]) => {
    const midX = pageWidth / 2
    pdf.setDrawColor(...ink)
    pdf.setLineWidth(0.2)
    pdf.line(MARGIN, yLine, midX - 3.2, yLine)
    pdf.line(midX + 3.2, yLine, pageWidth - MARGIN, yLine)
    pdf.setFillColor(...ink)
    const s = 0.85
    // Diamond, same mark as the site footer. Vectors walk left → top → right → bottom.
    pdf.lines(
      [
        [s, -s],
        [s, s],
        [-s, s],
        [-s, -s],
      ],
      midX - s,
      yLine,
      [1, 1],
      'F',
      true,
    )
  }

  const drawSectionHeader = (title: string) => {
    checkPage(14)
    y += 4
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...textMuted)
    pdf.text(title.toUpperCase(), MARGIN, y)
    y += 2.5
    drawDiamondRule(y, [168, 162, 158])
    y += 5
  }

  // Letterhead: mark + word, then the driver's name.
  const letterY = 11
  if (provvenMark) pdf.addImage(provvenMark, 'PNG', MARGIN, letterY, 4, 4.3)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(23, 49, 80)
  pdf.text('PROVVEN', MARGIN + (provvenMark ? 5.4 : 0), letterY + 3.1)
  y = letterY + 9

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

  if (packet.freshnessNote) {
    checkPage(16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(23, 49, 80)
    const lines = pdf.splitTextToSize(packet.freshnessNote, pageWidth - MARGIN * 2) as string[]
    pdf.text(lines, MARGIN, y)
    y += lines.length * 4.2 + 3
  }

  if (packet.summary) {
    checkPage(16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...textMid)
    const summaryLines = pdf.splitTextToSize(packet.summary, pageWidth - MARGIN * 2) as string[]
    pdf.text(summaryLines, MARGIN, y)
    y += summaryLines.length * 4.2 + 3
  }

  // Midnight, then Accio facts it has not replaced, then the barcode.
  const proofs = packet.proofChips
    .filter(
      (chip) =>
        chip.tier === 'midnight' ||
        chip.tier === 'accio' ||
        chip.tier === 'employer' ||
        chip.tier === 'dkim' ||
        chip.tier === 'license',
    )
    .sort((a, b) => resumeProofRank(a.tier) - resumeProofRank(b.tier))
  if (proofs.length > 0) {
    checkPage(12)
    const badgeW = 4.2
    const badgeH = 4.5
    let x = MARGIN
    let rowTop = y
    for (const chip of proofs) {
      const tone: {
        kicker: string
        cite: string
        fact: [number, number, number]
        kick: [number, number, number]
      } =
        chip.tier === 'midnight'
          ? { kicker: 'MIDNIGHT PROOF', cite: 'via Accio', fact: [23, 49, 80], kick: [241, 90, 43] }
          : chip.tier === 'accio'
            ? { kicker: 'ACCIO PROOF', cite: 'Driving record', fact: [242, 138, 15], kick: [242, 138, 15] }
          : chip.tier === 'employer'
            ? { kicker: 'EMPLOYER PROOF', cite: chip.cite || 'Employer reply', fact: [63, 138, 140], kick: [63, 138, 140] }
            : chip.tier === 'dkim'
              ? { kicker: 'DKIM PROOF', cite: chip.cite || 'Signed email', fact: [63, 138, 140], kick: [63, 138, 140] }
              : { kicker: 'LICENSE PROOF', cite: 'Barcode read', fact: [0, 96, 139], kick: [0, 96, 139] }
      const citeLine = chip.dateLabel ? `${tone.cite} · ${chip.dateLabel}` : tone.cite
      pdf.setFont('times', 'bold')
      pdf.setFontSize(9)
      const factW = pdf.getTextWidth(chip.label)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6)
      const metaW = pdf.getTextWidth(`${tone.kicker}  ${citeLine}`)
      const blockW = (provvenMark ? badgeW + 1.6 : 0) + Math.max(factW, metaW)
      if (x > MARGIN && x + blockW > pageWidth - MARGIN) {
        x = MARGIN
        rowTop += 8
      }
      if (provvenMark) {
        pdf.addImage(provvenMark, 'PNG', x, rowTop, badgeW, badgeH)
      }
      const textX = x + (provvenMark ? badgeW + 1.6 : 0)
      pdf.setFont('times', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(...tone.fact)
      pdf.text(chip.label, textX, rowTop + 2.2)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6)
      pdf.setTextColor(...tone.kick)
      pdf.text(tone.kicker, textX, rowTop + 4.8)
      const kickW = pdf.getTextWidth(`${tone.kicker}  `)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...textMuted)
      pdf.text(citeLine, textX + kickW, rowTop + 4.8)
      x += blockW + 5
    }
    y = rowTop + 8
  }

  if (packet.thinStateHint) {
    checkPage(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.setTextColor(...textMuted)
    const hintLines = pdf.splitTextToSize(packet.thinStateHint, pageWidth - MARGIN * 2)
    pdf.text(hintLines, MARGIN, y)
    y += hintLines.length * 4 + 2
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
        pdf.setTextColor(...textMid)
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

  drawDiamondRule(y, [168, 162, 158])
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
