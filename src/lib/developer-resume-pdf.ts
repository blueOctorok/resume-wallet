/**
 * PDF generation utility for Developer resumes
 * Creates professional PDFs from structured developer resume data
 */

import { jsPDF } from 'jspdf'
import type { DeveloperResumeData } from '@/components/DeveloperResumeBuilder'

// Color scheme
const COLORS = {
  primary: [156,119,64] as [number, number, number], // teal-600 — vault accent
  dark: [17, 24, 39] as [number, number, number], // Gray-900
  text: [55, 65, 81] as [number, number, number], // Gray-700
  light: [107, 114, 128] as [number, number, number], // Gray-500
}

/**
 * Generate a styled PDF resume from developer structured data
 * Returns a Blob for client-side download or Buffer for server-side
 */
export async function generateDeveloperResumePDF(
  data: DeveloperResumeData
): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Helper to check for page break
  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage()
      y = margin
      return true
    }
    return false
  }

  // Helper to add section title
  const addSectionTitle = (title: string) => {
    checkPageBreak(15)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(...COLORS.primary)
    pdf.text(title.toUpperCase(), margin, y)
    y += 2
    pdf.setDrawColor(...COLORS.primary)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  // ============================================================
  // HEADER - Name & Contact
  // ============================================================
  const { personalInfo } = data

  // Name
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(24)
  pdf.setTextColor(...COLORS.dark)
  const fullName = `${personalInfo.firstName} ${personalInfo.lastName}`.trim()
  pdf.text(fullName || 'Developer', margin, y)
  y += 8

  // Headline
  if (personalInfo.headline) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(...COLORS.primary)
    pdf.text(personalInfo.headline, margin, y)
    y += 6
  }

  // Contact info line
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...COLORS.light)
  const contactParts = [
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
  ].filter(Boolean)
  if (contactParts.length > 0) {
    pdf.text(contactParts.join('  •  '), margin, y)
    y += 5
  }

  // Links line
  const links = []
  if (personalInfo.githubUrl) links.push(`GitHub: ${personalInfo.githubUrl}`)
  if (personalInfo.linkedinUrl)
    links.push(`LinkedIn: ${personalInfo.linkedinUrl}`)
  if (personalInfo.portfolioUrl)
    links.push(`Portfolio: ${personalInfo.portfolioUrl}`)
  if (links.length > 0) {
    pdf.setFontSize(8)
    // Split into multiple lines if too long
    links.forEach((link) => {
      if (y + 4 > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(link, margin, y)
      y += 4
    })
  }

  y += 4

  // ============================================================
  // SUMMARY
  // ============================================================
  if (personalInfo.summary) {
    addSectionTitle('Summary')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.text)
    const summaryLines = pdf.splitTextToSize(personalInfo.summary, contentWidth)
    summaryLines.forEach((line: string) => {
      checkPageBreak(5)
      pdf.text(line, margin, y)
      y += 5
    })
    y += 4
  }

  // ============================================================
  // TECHNICAL SKILLS
  // ============================================================
  if (data.skills.length > 0) {
    addSectionTitle('Technical Skills')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.text)

    // Group skills by category
    const categories = [
      'language',
      'framework',
      'database',
      'cloud',
      'tool',
      'other',
    ]
    const categoryLabels: Record<string, string> = {
      language: 'Languages',
      framework: 'Frameworks',
      database: 'Databases',
      cloud: 'Cloud & DevOps',
      tool: 'Tools',
      other: 'Other',
    }

    categories.forEach((cat) => {
      const catSkills = data.skills.filter((s) => s.category === cat)
      if (catSkills.length > 0) {
        checkPageBreak(8)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.text(`${categoryLabels[cat]}: `, margin, y)
        const labelWidth = pdf.getTextWidth(`${categoryLabels[cat]}: `)
        pdf.setFont('helvetica', 'normal')
        const skillsText = catSkills.map((s) => s.name).join(', ')
        const skillLines = pdf.splitTextToSize(
          skillsText,
          contentWidth - labelWidth - 5
        )
        skillLines.forEach((line: string, idx: number) => {
          if (idx === 0) {
            pdf.text(line, margin + labelWidth, y)
          } else {
            y += 4
            checkPageBreak(5)
            pdf.text(line, margin + labelWidth, y)
          }
        })
        y += 5
      }
    })
    y += 2
  }

  // ============================================================
  // WORK EXPERIENCE
  // ============================================================
  if (data.experience.length > 0) {
    addSectionTitle('Work Experience')

    data.experience.forEach((exp) => {
      checkPageBreak(25)

      // Title and company
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...COLORS.dark)
      pdf.text(exp.title || 'Position', margin, y)
      y += 5

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.text)
      const companyLine = [exp.company, exp.location]
        .filter(Boolean)
        .join(' • ')
      pdf.text(companyLine, margin, y)
      y += 4

      // Dates
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.light)
      const dateRange = `${exp.startDate || ''} - ${exp.isCurrent ? 'Present' : exp.endDate || ''}`
      pdf.text(dateRange, margin, y)
      y += 5

      // Description
      if (exp.description) {
        pdf.setFontSize(10)
        pdf.setTextColor(...COLORS.text)
        const descLines = pdf.splitTextToSize(exp.description, contentWidth - 5)
        descLines.forEach((line: string) => {
          checkPageBreak(5)
          pdf.text(line, margin + 3, y)
          y += 4
        })
      }

      // Achievements
      const achievements = exp.achievements.filter(Boolean)
      if (achievements.length > 0) {
        achievements.forEach((achievement) => {
          checkPageBreak(5)
          pdf.setFontSize(10)
          pdf.setTextColor(...COLORS.text)
          const bulletLines = pdf.splitTextToSize(
            `• ${achievement}`,
            contentWidth - 8
          )
          bulletLines.forEach((line: string) => {
            checkPageBreak(5)
            pdf.text(line, margin + 3, y)
            y += 4
          })
        })
      }

      // Technologies
      if (exp.technologies.length > 0) {
        checkPageBreak(5)
        pdf.setFont('helvetica', 'italic')
        pdf.setFontSize(9)
        pdf.setTextColor(...COLORS.light)
        pdf.text(`Technologies: ${exp.technologies.join(', ')}`, margin + 3, y)
        y += 5
      }

      y += 3
    })
  }

  // ============================================================
  // PROJECTS
  // ============================================================
  if (data.projects.length > 0) {
    addSectionTitle('Projects')

    data.projects.forEach((project) => {
      checkPageBreak(20)

      // Project name and role
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...COLORS.dark)
      let projectTitle = project.name || 'Project'
      if (project.role) projectTitle += ` (${project.role})`
      pdf.text(projectTitle, margin, y)
      y += 5

      // Description
      if (project.description) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.setTextColor(...COLORS.text)
        const descLines = pdf.splitTextToSize(
          project.description,
          contentWidth - 5
        )
        descLines.forEach((line: string) => {
          checkPageBreak(5)
          pdf.text(line, margin + 3, y)
          y += 4
        })
      }

      // Highlights
      const highlights = project.highlights.filter(Boolean)
      if (highlights.length > 0) {
        highlights.forEach((highlight) => {
          checkPageBreak(5)
          pdf.setFontSize(10)
          pdf.setTextColor(...COLORS.text)
          const bulletLines = pdf.splitTextToSize(
            `• ${highlight}`,
            contentWidth - 8
          )
          bulletLines.forEach((line: string) => {
            checkPageBreak(5)
            pdf.text(line, margin + 3, y)
            y += 4
          })
        })
      }

      // Technologies
      if (project.technologies.length > 0) {
        checkPageBreak(5)
        pdf.setFont('helvetica', 'italic')
        pdf.setFontSize(9)
        pdf.setTextColor(...COLORS.light)
        pdf.text(`Tech: ${project.technologies.join(', ')}`, margin + 3, y)
        y += 4
      }

      // Links
      const projectLinks = []
      if (project.liveUrl) projectLinks.push(`Live: ${project.liveUrl}`)
      if (project.repoUrl) projectLinks.push(`Repo: ${project.repoUrl}`)
      if (projectLinks.length > 0) {
        checkPageBreak(5)
        pdf.setFontSize(8)
        pdf.setTextColor(...COLORS.primary)
        pdf.text(projectLinks.join('  |  '), margin + 3, y)
        y += 5
      }

      y += 3
    })
  }

  // ============================================================
  // EDUCATION
  // ============================================================
  if (data.education.length > 0) {
    addSectionTitle('Education')

    data.education.forEach((edu) => {
      checkPageBreak(15)

      // Degree and field
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...COLORS.dark)
      let degreeText = edu.degree || ''
      if (edu.field) degreeText += ` in ${edu.field}`
      pdf.text(degreeText || 'Education', margin, y)
      y += 5

      // Institution
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.text)
      pdf.text(edu.institution || '', margin, y)
      y += 4

      // Dates and GPA
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.light)
      let dateGpa = `${edu.startDate || ''} - ${edu.endDate || ''}`
      if (edu.gpa) dateGpa += ` • GPA: ${edu.gpa}`
      pdf.text(dateGpa, margin, y)
      y += 6
    })
  }

  // ============================================================
  // CERTIFICATIONS
  // ============================================================
  if (data.certifications.length > 0) {
    addSectionTitle('Certifications')

    data.certifications.forEach((cert) => {
      checkPageBreak(10)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.dark)
      pdf.text(cert.name || 'Certification', margin, y)
      y += 4

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.light)
      const certInfo = [cert.issuer, cert.date].filter(Boolean).join(' • ')
      pdf.text(certInfo, margin, y)
      y += 5
    })
  }

  // Return as Blob
  return pdf.output('blob')
}

/**
 * Server-side version that returns a Buffer
 */
export function generateDeveloperResumePDFBuffer(
  data: DeveloperResumeData
): Buffer {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage()
      y = margin
      return true
    }
    return false
  }

  const addSectionTitle = (title: string) => {
    checkPageBreak(15)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(...COLORS.primary)
    pdf.text(title.toUpperCase(), margin, y)
    y += 2
    pdf.setDrawColor(...COLORS.primary)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  // Same content generation as above (duplicated for server-side Buffer output)
  const { personalInfo } = data

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(24)
  pdf.setTextColor(...COLORS.dark)
  const fullName = `${personalInfo.firstName} ${personalInfo.lastName}`.trim()
  pdf.text(fullName || 'Developer', margin, y)
  y += 8

  if (personalInfo.headline) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(...COLORS.primary)
    pdf.text(personalInfo.headline, margin, y)
    y += 6
  }

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...COLORS.light)
  const contactParts = [
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
  ].filter(Boolean)
  if (contactParts.length > 0) {
    pdf.text(contactParts.join('  •  '), margin, y)
    y += 5
  }

  const links = []
  if (personalInfo.githubUrl) links.push(`GitHub: ${personalInfo.githubUrl}`)
  if (personalInfo.linkedinUrl)
    links.push(`LinkedIn: ${personalInfo.linkedinUrl}`)
  if (personalInfo.portfolioUrl)
    links.push(`Portfolio: ${personalInfo.portfolioUrl}`)
  if (links.length > 0) {
    pdf.setFontSize(8)
    links.forEach((link) => {
      checkPageBreak(4)
      pdf.text(link, margin, y)
      y += 4
    })
  }

  y += 4

  if (personalInfo.summary) {
    addSectionTitle('Summary')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.text)
    const summaryLines = pdf.splitTextToSize(personalInfo.summary, contentWidth)
    summaryLines.forEach((line: string) => {
      checkPageBreak(5)
      pdf.text(line, margin, y)
      y += 5
    })
    y += 4
  }

  if (data.skills.length > 0) {
    addSectionTitle('Technical Skills')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.text)
    const skillsText = data.skills.map((s) => s.name).join(', ')
    const skillLines = pdf.splitTextToSize(skillsText, contentWidth)
    skillLines.forEach((line: string) => {
      checkPageBreak(5)
      pdf.text(line, margin, y)
      y += 5
    })
    y += 2
  }

  if (data.experience.length > 0) {
    addSectionTitle('Work Experience')
    data.experience.forEach((exp) => {
      checkPageBreak(20)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...COLORS.dark)
      pdf.text(exp.title || 'Position', margin, y)
      y += 5
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.text)
      pdf.text(
        [exp.company, exp.location].filter(Boolean).join(' • '),
        margin,
        y
      )
      y += 4
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.light)
      pdf.text(
        `${exp.startDate || ''} - ${exp.isCurrent ? 'Present' : exp.endDate || ''}`,
        margin,
        y
      )
      y += 5
      if (exp.description) {
        pdf.setFontSize(10)
        pdf.setTextColor(...COLORS.text)
        const descLines = pdf.splitTextToSize(exp.description, contentWidth - 5)
        descLines.forEach((line: string) => {
          checkPageBreak(5)
          pdf.text(line, margin + 3, y)
          y += 4
        })
      }
      y += 3
    })
  }

  if (data.projects.length > 0) {
    addSectionTitle('Projects')
    data.projects.forEach((project) => {
      checkPageBreak(15)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...COLORS.dark)
      pdf.text(project.name || 'Project', margin, y)
      y += 5
      if (project.description) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.setTextColor(...COLORS.text)
        const descLines = pdf.splitTextToSize(
          project.description,
          contentWidth - 5
        )
        descLines.forEach((line: string) => {
          checkPageBreak(5)
          pdf.text(line, margin + 3, y)
          y += 4
        })
      }
      y += 3
    })
  }

  if (data.education.length > 0) {
    addSectionTitle('Education')
    data.education.forEach((edu) => {
      checkPageBreak(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...COLORS.dark)
      let degreeText = edu.degree || ''
      if (edu.field) degreeText += ` in ${edu.field}`
      pdf.text(degreeText || 'Education', margin, y)
      y += 5
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.text)
      pdf.text(edu.institution || '', margin, y)
      y += 6
    })
  }

  if (data.certifications.length > 0) {
    addSectionTitle('Certifications')
    data.certifications.forEach((cert) => {
      checkPageBreak(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.dark)
      pdf.text(cert.name || 'Certification', margin, y)
      y += 4
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.light)
      pdf.text([cert.issuer, cert.date].filter(Boolean).join(' • '), margin, y)
      y += 5
    })
  }

  // Return as Buffer
  return Buffer.from(pdf.output('arraybuffer'))
}
