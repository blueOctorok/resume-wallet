/**
 * Shared PDF generation utility for resumes
 * Uses the same styled formatting as ResumeBuilder export
 */

import { jsPDF } from 'jspdf'

// Skill categories matching ResumeBuilder
const SKILL_CATEGORIES: { value: 'equipment' | 'route' | 'technology' | 'safety' | 'other'; label: string }[] = [
  { value: 'equipment', label: 'Equipment' },
  { value: 'route', label: 'Route Knowledge' },
  { value: 'technology', label: 'Technology' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
]

interface PersonalInfo {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  professionalSummary?: string
}

interface CDLInfo {
  cdlClass?: string
  cdlState?: string
  cdlExpiration?: string
  expirationDate?: string
  endorsements?: string[]
  restrictions?: string[]
}

interface Employment {
  id?: string
  companyName?: string
  position?: string
  location?: string
  startDate?: string
  endDate?: string
  isCurrent?: boolean
  responsibilities?: string[]
  equipment?: string[]
  milesDriven?: number
  safetyRecord?: string
}

interface Education {
  id?: string
  school?: string
  degree?: string
  field?: string
  year?: string
  certifications?: string[]
}

interface Skill {
  id?: string
  name?: string
  category?: 'equipment' | 'route' | 'technology' | 'safety' | 'other'
}

interface Reference {
  id?: string
  name?: string
  title?: string
  company?: string
  phone?: string
  email?: string
  relationship?: string
}

interface ResumeData {
  personalInfo: PersonalInfo
  cdlInfo: CDLInfo
  employments: Employment[]
  educations: Education[]
  skills: Skill[]
  references: Reference[]
}

/**
 * Generate a styled PDF resume from structured data
 * Returns a Buffer containing the PDF
 */
export function generateStyledResumePDF(data: ResumeData): Buffer {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let y = margin

  // Color scheme (RGB values for jsPDF)
  const primaryColor = [26, 54, 93] as [number, number, number] // Navy blue
  const accentColor = [43, 108, 176] as [number, number, number] // Medium blue
  const textDark = [26, 32, 44] as [number, number, number]
  const textMedium = [74, 85, 104] as [number, number, number]
  const textLight = [113, 128, 150] as [number, number, number]
  const lightAccentBg = [235, 244, 255] as [number, number, number]

  // Helper to check if we need a new page
  const checkPageBreak = (neededSpace: number) => {
    if (y + neededSpace > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage()
      y = margin
    }
  }

  // Helper to draw a section header with underline
  const drawSectionHeader = (title: string) => {
    checkPageBreak(15)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...primaryColor)
    pdf.text(title.toUpperCase(), margin, y)
    y += 2
    pdf.setDrawColor(...accentColor)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  // === HEADER ===
  const fullName = `${data.personalInfo.firstName || ''} ${data.personalInfo.lastName || ''}`.trim() || 'Your Name'
  
  // Name - centered, large, navy
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...primaryColor)
  pdf.text(fullName, pageWidth / 2, y, { align: 'center' })
  y += 8

  // Contact info - centered, smaller
  const contactParts = [
    data.personalInfo.email,
    data.personalInfo.phone,
    [data.personalInfo.city, data.personalInfo.state].filter(Boolean).join(', ')
  ].filter(Boolean)
  
  if (contactParts.length > 0) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...textMedium)
    pdf.text(contactParts.join('  •  '), pageWidth / 2, y, { align: 'center' })
    y += 6
  }

  // Professional summary
  if (data.personalInfo.professionalSummary) {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(...textMedium)
    const summaryLines = pdf.splitTextToSize(data.personalInfo.professionalSummary, contentWidth - 20)
    pdf.text(summaryLines, pageWidth / 2, y, { align: 'center', maxWidth: contentWidth - 20 })
    y += summaryLines.length * 4 + 4
  }

  // Header underline
  pdf.setDrawColor(...primaryColor)
  pdf.setLineWidth(0.8)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 10

  // === CDL INFORMATION ===
  const cdlClass = data.cdlInfo.cdlClass
  const endorsements = data.cdlInfo.endorsements || []
  const expirationDate = data.cdlInfo.expirationDate || data.cdlInfo.cdlExpiration
  
  if (cdlClass || endorsements.length > 0 || expirationDate) {
    drawSectionHeader('CDL & License Information')
    
    // Light blue background box - make it taller to accommodate wrapped text
    const boxPadding = 4
    const textStartY = y
    pdf.setFillColor(...lightAccentBg)
    
    const cdlParts = []
    if (cdlClass) cdlParts.push(`Class ${cdlClass}`)
    if (data.cdlInfo.cdlState) cdlParts.push(data.cdlInfo.cdlState)
    if (endorsements.length > 0) cdlParts.push(`Endorsements: ${endorsements.join(', ')}`)
    // Format expiration date more compactly (MM/YYYY)
    if (expirationDate) {
      try {
        const expDate = new Date(expirationDate)
        const month = String(expDate.getMonth() + 1).padStart(2, '0')
        const year = expDate.getFullYear()
        cdlParts.push(`Exp: ${month}/${year}`)
      } catch {
        // Fallback to original format if date parsing fails
        cdlParts.push(`Exp: ${expirationDate}`)
      }
    }
    
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...textDark)
    
    // Join parts and use splitTextToSize to handle wrapping
    const cdlText = cdlParts.join('  |  ')
    const cdlLines = pdf.splitTextToSize(cdlText, contentWidth - (boxPadding * 2))
    
    // Draw background box with height based on number of lines
    const boxHeight = Math.max(10, cdlLines.length * 5 + 4)
    pdf.rect(margin, textStartY - 4, contentWidth, boxHeight, 'F')
    
    // Draw text with proper line spacing
    cdlLines.forEach((line: string, index: number) => {
      pdf.text(line, margin + boxPadding, textStartY + 2 + (index * 5))
    })
    
    y = textStartY + boxHeight + 6
  }

  // === EMPLOYMENT HISTORY ===
  if (data.employments.length > 0) {
    drawSectionHeader('Professional Experience')
    
    data.employments.forEach((emp, index) => {
      checkPageBreak(20)
      
      const startDate = emp.startDate ? new Date(emp.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
      const endDate = emp.isCurrent ? 'Present' : emp.endDate ? new Date(emp.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
      const dateRange = `${startDate} – ${endDate}`

      // Line 1: Position (bold, left) and Date (gray, right)
      // This matches the HTML preview layout
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...textDark)
      pdf.text(emp.position || 'Position', margin, y)
      
      // Date range (right aligned on same line as position)
      pdf.setFontSize(9)
      pdf.setTextColor(...textLight)
      pdf.text(dateRange, pageWidth - margin, y, { align: 'right' })
      y += 4.5
      
      // Line 2: Company • Location (smaller, gray)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...textMedium)
      const companyLocation = [emp.companyName, emp.location].filter(Boolean).join(' • ')
      pdf.text(companyLocation || 'Company', margin, y)
      y += 5

      // Responsibilities
      const responsibilities = emp.responsibilities || []
      if (responsibilities.length > 0) {
        pdf.setFontSize(9)
        pdf.setTextColor(...textMedium)
        responsibilities.forEach(resp => {
          checkPageBreak(6)
          const respLines = pdf.splitTextToSize(`• ${resp}`, contentWidth - 10)
          pdf.text(respLines, margin + 4, y)
          y += respLines.length * 4
        })
      }
      
      if (index < data.employments.length - 1) y += 4
    })
    y += 4
  }

  // === EDUCATION ===
  if (data.educations.length > 0) {
    drawSectionHeader('Education & Training')
    
    data.educations.forEach((edu, index) => {
      checkPageBreak(12)
      
      // Line 1: Degree in Field (bold)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...textDark)
      pdf.text(`${edu.degree || 'Degree'}${edu.field ? ` in ${edu.field}` : ''}`, margin, y)
      y += 4
      
      // Line 2: School • Year (gray)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...textMedium)
      const schoolYear = [edu.school, edu.year].filter(Boolean).join(' • ')
      pdf.text(schoolYear, margin, y)
      y += 4

      // Certifications
      const certifications = edu.certifications || []
      if (certifications.length > 0) {
        pdf.setFontSize(9)
        pdf.setTextColor(...accentColor)
        pdf.text(`Certifications: ${certifications.join(', ')}`, margin + 4, y)
        y += 4
      }
      
      if (index < data.educations.length - 1) y += 2
    })
    y += 4
  }

  // === SKILLS ===
  if (data.skills.length > 0) {
    const skillsByCategory = data.skills.reduce(
      (acc, skill) => {
        const category = skill.category || 'other'
        if (!acc[category]) acc[category] = []
        acc[category].push(skill)
        return acc
      },
      {} as Record<string, Skill[]>
    )

    drawSectionHeader('Skills & Equipment')
    
    SKILL_CATEGORIES.forEach((category) => {
      const categorySkills = skillsByCategory[category.value] || []
      if (categorySkills.length > 0) {
        checkPageBreak(8)
        
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(...primaryColor)
        pdf.text(`${category.label}:`, margin, y)
        
        const labelWidth = pdf.getTextWidth(`${category.label}: `)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(...textMedium)
        const skillText = categorySkills.map((s) => s.name || '').filter(Boolean).join('  •  ')
        const skillLines = pdf.splitTextToSize(skillText, contentWidth - labelWidth - 5)
        pdf.text(skillLines, margin + labelWidth, y)
        y += skillLines.length * 4 + 2
      }
    })
    y += 2
  }

  // === REFERENCES ===
  if (data.references.length > 0) {
    drawSectionHeader('Professional References')
    
    const refWidth = (contentWidth - 10) / 2
    let refX = margin
    let refStartY = y
    
    data.references.forEach((ref, index) => {
      checkPageBreak(25)
      
      // Alternate columns
      if (index > 0 && index % 2 === 0) {
        refX = margin
        y = refStartY + 22
        refStartY = y
      } else if (index % 2 === 1) {
        refX = margin + refWidth + 10
        y = refStartY
      }

      // Light blue background with accent border
      pdf.setFillColor(...lightAccentBg)
      pdf.setDrawColor(...accentColor)
      pdf.rect(refX, y - 4, refWidth, 20, 'F')
      pdf.setLineWidth(1)
      pdf.line(refX, y - 4, refX, y + 16)
      
      // Name
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...textDark)
      pdf.text(ref.name || 'Name', refX + 4, y)
      
      // Title and company
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...textMedium)
      pdf.text(`${ref.title || ''}${ref.company ? ` at ${ref.company}` : ''}`, refX + 4, y + 4)
      
      // Contact info
      const contactInfo = [ref.phone, ref.email].filter(Boolean).join('  •  ')
      if (contactInfo) {
        pdf.setFontSize(8)
        pdf.setTextColor(...textLight)
        pdf.text(contactInfo, refX + 4, y + 8)
      }
    })
  }

  // Footer with verification note (if needed, can be added here)
  // pdf.setFontSize(8)
  // pdf.setTextColor(128, 128, 128)
  // pdf.text('This resume has been verified and recorded on the Base blockchain via Veree.', pageWidth / 2, pdf.internal.pageSize.getHeight() - 10, { align: 'center' })

  // Return as Buffer
  const pdfOutput = pdf.output('arraybuffer')
  return Buffer.from(pdfOutput)
}
