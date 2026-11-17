/**
 * Provven resume PDF — mirrors ResumeSheetDocument / example_resume.png.
 * A driver packet is converted to a sheet first, so this drawer stays one path.
 * Dual QR codes encode the sheet's public URL.
 */

import { jsPDF } from 'jspdf'
import { resumeProofRank, type DriverResumePacket } from '@/lib/driver-resume-packet'
import { driverPacketToSheet, type ResumeSheet, type ResumeSheetSection } from '@/lib/resume-sheet'

/** Disk reads for the print script. The browser fetches the same files instead. */
export interface ResumeSheetAssets {
  markDataUrl: string | null
  paperDataUrl: string | null
}

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
    const { PROVVEN_QR_OPTS } = await import('@/lib/provven-qr')
    const QRCode = (await import('qrcode')).default
    // Plain modules. The mark is drawn on top in the PDF so Node and the browser match.
    return await QRCode.toDataURL(verifyUrl, { ...PROVVEN_QR_OPTS, width: size * 4 })
  } catch {
    return null
  }
}

/** Driver download entry. The sheet drawer does the drawing. */
export async function generateDriverResumePacketPDF(
  packet: DriverResumePacket,
): Promise<Buffer> {
  return generateResumeSheetPDF(driverPacketToSheet(packet))
}

/**
 * Generate a Buffer for a Provven resume PDF.
 * Async because QR generation is async.
 */
export async function generateResumeSheetPDF(
  sheet: ResumeSheet,
  assets?: ResumeSheetAssets,
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

  const [qrTop, fetchedMark, fetchedPaper] = await Promise.all([
    qrPngDataUrl(sheet.verifyUrl, 128),
    assets ? Promise.resolve(assets.markDataUrl) : publicPngDataUrl('/brand/provven-mark.png'),
    assets ? Promise.resolve(assets.paperDataUrl) : publicPngDataUrl('/brand/resume-paper.png?v=2'),
  ])
  const provvenMark = fetchedMark
  const paper = fetchedPaper
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

  // A Provven career card wears the wordmark. A portfolio print does not:
  // the name is the head, and the file is not a record on the Provven site.
  const showProvven = sheet.letterhead === 'provven'
  const letterY = 11
  if (showProvven) {
    if (provvenMark) pdf.addImage(provvenMark, 'PNG', MARGIN, letterY, 4, 4.3)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(23, 49, 80)
    pdf.text('PROVVEN', MARGIN + (provvenMark ? 5.4 : 0), letterY + 3.1)
    y = letterY + 9
  } else {
    y = letterY
  }

  // === HEADER ===
  pdf.setFont('times', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor(...textDark)
  const nameLines = pdf.splitTextToSize(sheet.fullName, contentRight - MARGIN)
  pdf.text(nameLines, MARGIN, y + 6)
  let nameBottom = y + 6 + nameLines.length * 8

  // White pad + mark, same idea as the on-screen QR. Drawn here so a Node print gets it too.
  const drawQr = (dataUrl: string | null, x: number, yPos: number, size: number) => {
    if (dataUrl) {
      pdf.addImage(dataUrl, 'PNG', x, yPos, size, size)
    } else {
      pdf.setDrawColor(...textDark)
      pdf.rect(x, yPos, size, size)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...greenDot)
      pdf.text('ZK', x + size / 2, yPos + size / 2 + 1.5, { align: 'center' })
    }
    if (!showProvven || !dataUrl || !provvenMark) return
    const box = size * 0.32
    const pad = box * 0.16
    const ox = x + (size - box) / 2
    const oy = yPos + (size - box) / 2
    pdf.setFillColor(255, 255, 255)
    pdf.rect(ox, oy, box, box, 'F')
    pdf.addImage(provvenMark, 'PNG', ox + pad, oy + pad, box - pad * 2, box - pad * 2)
  }

  // Top-right QR
  const qrX = pageWidth - MARGIN - QR_TOP
  drawQr(qrTop, qrX, y, QR_TOP)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(...textMuted)
  const qrLabelLines = pdf.splitTextToSize(sheet.qrLabelTop, QR_TOP + 6)
  pdf.text(qrLabelLines, qrX + QR_TOP / 2, y + QR_TOP + 3.5, { align: 'center' })

  y = nameBottom + 2
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...textMid)
  const headerWidth = contentRight - MARGIN
  if (sheet.tagline) {
    const taglineLines = pdf.splitTextToSize(sheet.tagline, headerWidth) as string[]
    pdf.text(taglineLines, MARGIN, y)
    y += taglineLines.length * 4.5
  }
  if (sheet.contactLine) {
    const contactLines = pdf.splitTextToSize(sheet.contactLine, headerWidth) as string[]
    pdf.text(contactLines, MARGIN, y)
    y += contactLines.length * 4.5
  }

  // Clear past QR block
  y = Math.max(y, MARGIN + QR_TOP + 10)

  if (sheet.freshnessNote) {
    checkPage(16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(23, 49, 80)
    const lines = pdf.splitTextToSize(sheet.freshnessNote, pageWidth - MARGIN * 2) as string[]
    pdf.text(lines, MARGIN, y)
    y += lines.length * 4.2 + 3
  }

  if (sheet.summary) {
    checkPage(16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...textMid)
    const summaryLines = pdf.splitTextToSize(sheet.summary, pageWidth - MARGIN * 2) as string[]
    pdf.text(summaryLines, MARGIN, y)
    y += summaryLines.length * 4.2 + 3
  }

  // Midnight, then Accio facts it has not replaced, then the barcode.
  const proofs = sheet.proofChips
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

  if (sheet.thinStateHint) {
    checkPage(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.setTextColor(...textMuted)
    const hintLines = pdf.splitTextToSize(sheet.thinStateHint, pageWidth - MARGIN * 2)
    pdf.text(hintLines, MARGIN, y)
    y += hintLines.length * 4 + 2
  }

  const drawSection = (section: ResumeSheetSection) => {
    drawSectionHeader(section.title)
    if (section.kind === 'lines') {
      if (section.note) {
        pdf.setFont('helvetica', 'italic')
        pdf.setFontSize(8)
        pdf.setTextColor(...textMuted)
        pdf.text(section.note, MARGIN, y)
        y += 5
      }
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(...textDark)
      for (const line of section.lines) {
        checkPage(6)
        const wrapped = pdf.splitTextToSize(`•  ${line}`, pageWidth - MARGIN * 2 - 2)
        pdf.text(wrapped, MARGIN + 1, y)
        y += wrapped.length * 4.5 + 1
      }
      y += 2
      return
    }
    if (section.kind === 'roles') {
      for (const row of section.roles) {
        checkPage(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.setTextColor(...textDark)
        const titleMax = pageWidth - MARGIN * 2 - 36
        const titleLines = pdf.splitTextToSize(row.title, titleMax)
        pdf.text(titleLines, MARGIN, y)
        if (row.date) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.setTextColor(...textMid)
          pdf.text(row.date, pageWidth - MARGIN, y, { align: 'right' })
        }
        y += titleLines.length * 4.5 + 1
        if (row.meta) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.setTextColor(...textMid)
          const metaLines = pdf.splitTextToSize(row.meta, pageWidth - MARGIN * 2) as string[]
          pdf.text(metaLines, MARGIN, y)
          y += metaLines.length * 4 + 0.5
        }
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(...textMid)
        for (const bullet of row.bullets) {
          checkPage(6)
          const bl = pdf.splitTextToSize(`•  ${bullet}`, pageWidth - MARGIN * 2 - 2)
          pdf.text(bl, MARGIN + 1, y)
          y += bl.length * 4 + 0.5
        }
        y += 3
      }
      return
    }
    if (section.kind === 'prose') {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(...textDark)
      const proseLines = pdf.splitTextToSize(section.text, pageWidth - MARGIN * 2)
      pdf.text(proseLines, MARGIN, y)
      y += proseLines.length * 4.5 + 2
      return
    }
    const labelW = 58
    for (const pair of section.pairs) {
      checkPage(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(...textDark)
      const labelLines = pdf.splitTextToSize(pair.label, labelW) as string[]
      pdf.text(labelLines, MARGIN, y)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...textMid)
      const detailLines = pdf.splitTextToSize(
        pair.detail,
        pageWidth - MARGIN * 2 - labelW - 3,
      ) as string[]
      pdf.text(detailLines, MARGIN + labelW + 3, y)
      y += Math.max(labelLines.length, detailLines.length) * 4 + 1.2
    }
  }

  for (const section of sheet.sections) drawSection(section)

  // FOOTER — pin near bottom when room, else flow
  const footerBlockH = QR_FOOTER + 18
  if (y + footerBlockH + 8 > pageHeight - MARGIN) {
    pdf.addPage()
    paintPage()
    y = MARGIN
  } else {
    y = Math.max(y + 6, pageHeight - MARGIN - footerBlockH - 4)
  }

  drawDiamondRule(y, [168, 162, 158])
  y += 5

  const footQrX = MARGIN
  drawQr(qrFoot, footQrX, y, QR_FOOTER)

  const textX = footQrX + QR_FOOTER + 4
  const textW = pageWidth - MARGIN - textX
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...textDark)
  pdf.text(sheet.footerTitle, textX, y + 3.5)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...textMuted)
  const bodyLines = pdf.splitTextToSize(sheet.footerBody, textW)
  pdf.text(bodyLines, textX, y + 8)

  let footMetaY = y + 8 + bodyLines.length * 3.5 + 1.5
  pdf.setFontSize(8)
  pdf.setTextColor(...linkAmber)
  pdf.text(sheet.verifyDisplayPath, textX, footMetaY)
  if (sheet.hasVerifiedClaims) {
    const pathW = pdf.getTextWidth(sheet.verifyDisplayPath)
    pdf.setTextColor(...textMuted)
    pdf.text(` • proofs expire ${sheet.expiresLabel}`, textX + pathW, footMetaY)
  }

  const pdfOutput = pdf.output('arraybuffer')
  return Buffer.from(pdfOutput)
}
