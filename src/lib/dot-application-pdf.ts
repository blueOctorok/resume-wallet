/**
 * DOT Application PDF Generator
 * Generates a professional PDF of a completed DOT driver application
 * for export to ATS systems like Bullhorn
 */

import { jsPDF } from 'jspdf'

// Colors
const COLORS = {
  primary: [13, 148, 136] as [number, number, number], // teal-600
  dark: [17, 24, 39] as [number, number, number], // gray-900
  text: [55, 65, 81] as [number, number, number], // gray-700
  light: [107, 114, 128] as [number, number, number], // gray-500
  border: [229, 231, 235] as [number, number, number], // gray-200
}

interface ApplicationData {
  form1Data?: any // Personal info, CDL, residency
  form2Data?: any // Driving record, violations, accidents
  form3Data?: any // Employment history
  createdAt?: string
  completedAt?: string
  verificationStatus?: string
  blockchainTxHash?: string
}

interface ExportOptions {
  includeBlockchainInfo?: boolean
  companyName?: string
  candidateName?: string
}

/**
 * Generate a PDF of a DOT driver application
 */
export function generateDotApplicationPDF(
  applicationData: ApplicationData,
  options: ExportOptions = {}
): Buffer {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const { form1Data, form2Data, form3Data } = applicationData

  // Helper: Check page break
  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - margin) {
      pdf.addPage()
      y = margin
      return true
    }
    return false
  }

  // Helper: Draw section header
  function drawSectionHeader(title: string) {
    checkPageBreak(15)
    y += 5
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(...COLORS.primary)
    pdf.text(title.toUpperCase(), margin, y)
    y += 2
    pdf.setDrawColor(...COLORS.primary)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  // Helper: Draw field
  function drawField(label: string, value: string | undefined | null, width: number = contentWidth) {
    if (!value) return
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...COLORS.light)
    pdf.text(label, margin, y)
    y += 4
    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.dark)
    const lines = pdf.splitTextToSize(value, width)
    for (const line of lines) {
      checkPageBreak(5)
      pdf.text(line, margin, y)
      y += 4
    }
    y += 2
  }

  // Helper: Draw inline fields (side by side)
  function drawInlineFields(fields: Array<{ label: string; value: string | undefined | null }>) {
    const validFields = fields.filter(f => f.value)
    if (validFields.length === 0) return
    
    checkPageBreak(12)
    const fieldWidth = contentWidth / validFields.length
    let x = margin
    
    for (const field of validFields) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.light)
      pdf.text(field.label, x, y)
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.dark)
      pdf.text(field.value || '', x, y + 4)
      x += fieldWidth
    }
    y += 10
  }

  // ===== HEADER =====
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(...COLORS.dark)
  pdf.text('DOT Driver Application', margin, y)
  
  y += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...COLORS.light)
  
  if (options.companyName) {
    pdf.text(`For: ${options.companyName}`, margin, y)
    y += 5
  }
  
  const applicantName = options.candidateName || 
    (form1Data?.firstName && form1Data?.lastName 
      ? `${form1Data.firstName} ${form1Data.lastName}` 
      : 'Applicant')
  pdf.text(`Applicant: ${applicantName}`, margin, y)
  y += 5
  
  if (applicationData.createdAt) {
    pdf.text(`Date: ${new Date(applicationData.createdAt).toLocaleDateString()}`, margin, y)
    y += 5
  }

  // Verification badge
  if (applicationData.verificationStatus === 'VERIFIED' || applicationData.blockchainTxHash) {
    y += 2
    pdf.setFillColor(209, 250, 229) // green-100
    pdf.roundedRect(margin, y, 52, 8, 2, 2, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(22, 101, 52) // green-800
    pdf.text('✓ ON FILE WITH ZKNIGHT', margin + 3, y + 5.5)
    y += 12
  }

  y += 5

  // ===== SECTION 1: PERSONAL INFORMATION =====
  if (form1Data) {
    drawSectionHeader('Personal Information')
    
    drawInlineFields([
      { label: 'First Name', value: form1Data.firstName },
      { label: 'Middle Name', value: form1Data.middleName },
      { label: 'Last Name', value: form1Data.lastName },
    ])
    
    drawInlineFields([
      { label: 'Date of Birth', value: form1Data.dateOfBirth },
      { label: 'SSN (Last 4)', value: form1Data.ssn ? `***-**-${form1Data.ssn.slice(-4)}` : undefined },
      { label: 'Phone', value: form1Data.phone },
    ])
    
    drawField('Email', form1Data.email)
    
    if (form1Data.address) {
      const fullAddress = [
        form1Data.address,
        form1Data.city,
        form1Data.state,
        form1Data.zipCode
      ].filter(Boolean).join(', ')
      drawField('Address', fullAddress)
    }
    
    // Emergency Contact
    if (form1Data.emergencyContact?.name) {
      y += 2
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.text)
      pdf.text('Emergency Contact', margin, y)
      y += 5
      drawInlineFields([
        { label: 'Name', value: form1Data.emergencyContact.name },
        { label: 'Relationship', value: form1Data.emergencyContact.relationship },
        { label: 'Phone', value: form1Data.emergencyContact.phone },
      ])
    }
  }

  // ===== SECTION 2: CDL INFORMATION =====
  if (form1Data?.cdlNumber || form1Data?.cdlClass) {
    drawSectionHeader('Commercial Driver License')
    
    drawInlineFields([
      { label: 'CDL Number', value: form1Data.cdlNumber },
      { label: 'State', value: form1Data.cdlState },
      { label: 'Class', value: form1Data.cdlClass },
    ])
    
    drawInlineFields([
      { label: 'Expiration', value: form1Data.cdlExpiration },
    ])
    
    if (form1Data.endorsements?.length > 0) {
      drawField('Endorsements', form1Data.endorsements.join(', '))
    }
    
    if (form1Data.restrictions?.length > 0) {
      drawField('Restrictions', form1Data.restrictions.join(', '))
    }
  }

  // ===== SECTION 3: DRIVING RECORD =====
  if (form2Data) {
    drawSectionHeader('Driving Record')
    
    // Accidents
    const accidents = form2Data.accidents || []
    if (accidents.length > 0) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.text)
      pdf.text(`Accidents (${accidents.length})`, margin, y)
      y += 5
      
      for (const accident of accidents) {
        checkPageBreak(20)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(...COLORS.dark)
        const accidentLine = [
          accident.date,
          accident.location,
          accident.description
        ].filter(Boolean).join(' - ')
        const lines = pdf.splitTextToSize(`• ${accidentLine}`, contentWidth - 5)
        for (const line of lines) {
          pdf.text(line, margin + 3, y)
          y += 4
        }
        y += 2
      }
    } else {
      drawField('Accidents', 'None reported')
    }
    
    // Violations
    const violations = form2Data.violations || []
    if (violations.length > 0) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.text)
      pdf.text(`Traffic Violations (${violations.length})`, margin, y)
      y += 5
      
      for (const violation of violations) {
        checkPageBreak(20)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(...COLORS.dark)
        const violationLine = [
          violation.date,
          violation.state,
          violation.violation
        ].filter(Boolean).join(' - ')
        const lines = pdf.splitTextToSize(`• ${violationLine}`, contentWidth - 5)
        for (const line of lines) {
          pdf.text(line, margin + 3, y)
          y += 4
        }
        y += 2
      }
    } else {
      drawField('Traffic Violations', 'None reported')
    }
  }

  // ===== SECTION 4: EMPLOYMENT HISTORY =====
  if (form3Data?.employmentHistory?.length > 0) {
    drawSectionHeader('Employment History (Last 10 Years)')
    
    for (const job of form3Data.employmentHistory) {
      checkPageBreak(30)
      
      // Company name and dates
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.dark)
      pdf.text(job.companyName || job.employerName || 'Employer', margin, y)
      
      const dates = [job.startDate, job.endDate || 'Present'].filter(Boolean).join(' - ')
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.light)
      const datesWidth = pdf.getTextWidth(dates)
      pdf.text(dates, pageWidth - margin - datesWidth, y)
      y += 5
      
      // Position and location
      if (job.position || job.title) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(...COLORS.text)
        pdf.text(job.position || job.title, margin, y)
        y += 4
      }
      
      if (job.location || job.city) {
        pdf.setTextColor(...COLORS.light)
        pdf.text(job.location || `${job.city}, ${job.state}`, margin, y)
        y += 4
      }
      
      // Supervisor
      if (job.supervisorName) {
        pdf.setTextColor(...COLORS.light)
        pdf.text(`Supervisor: ${job.supervisorName} ${job.supervisorPhone ? `(${job.supervisorPhone})` : ''}`, margin, y)
        y += 4
      }
      
      // Reason for leaving
      if (job.reasonForLeaving) {
        pdf.setTextColor(...COLORS.light)
        pdf.text(`Reason for leaving: ${job.reasonForLeaving}`, margin, y)
        y += 4
      }
      
      y += 4
    }
  }

  // ===== SECTION 5: MEDICAL CERTIFICATION =====
  if (form1Data?.medicalExamDate || form1Data?.medicalExaminerName) {
    drawSectionHeader('Medical Certification')
    
    drawInlineFields([
      { label: 'Exam Date', value: form1Data.medicalExamDate },
      { label: 'Expiration', value: form1Data.medicalExamExpiration },
    ])
    
    drawInlineFields([
      { label: 'Medical Examiner', value: form1Data.medicalExaminerName },
      { label: 'Examiner Phone', value: form1Data.medicalExaminerPhone },
    ])
  }

  // ===== FOOTER =====
  checkPageBreak(25)
  y = pageHeight - 20
  
  pdf.setDrawColor(...COLORS.border)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 5
  
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...COLORS.light)
  pdf.text('Generated by ZKnight — Driver Qualification Platform', margin, y)
  
  if (options.includeBlockchainInfo && applicationData.blockchainTxHash) {
    y += 4
    pdf.text(`Record ID: ${applicationData.blockchainTxHash}`, margin, y)
  }
  
  const dateStr = new Date().toLocaleDateString()
  const dateWidth = pdf.getTextWidth(dateStr)
  pdf.text(dateStr, pageWidth - margin - dateWidth, pageHeight - 15)

  // Return as buffer
  return Buffer.from(pdf.output('arraybuffer'))
}
