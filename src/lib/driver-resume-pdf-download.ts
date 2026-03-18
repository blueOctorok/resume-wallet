type ResumePdfInput = Record<string, unknown>

/** Client-only: build PDF blob from driver resume builder structured_data */
export async function downloadDriverResumePdfFromStructured(
  structuredData: ResumePdfInput,
  filenameBase: string,
): Promise<void> {
  const { generateStyledResumePDF } = await import('@/lib/resume-pdf-generator')
  const sd = structuredData
  const pi = (sd.personalInfo || {}) as Record<string, string | undefined>
  const ci = (sd.cdlInfo || {}) as Record<string, unknown>
  const resumeData = {
    personalInfo: {
      firstName: pi.firstName ?? '',
      lastName: pi.lastName ?? '',
      email: pi.email ?? '',
      phone: pi.phone ?? '',
      address: pi.address ?? '',
      city: pi.city ?? '',
      state: pi.state ?? '',
      zipCode: pi.zipCode ?? '',
      professionalSummary: pi.professionalSummary ?? '',
    },
    cdlInfo: {
      cdlClass: String(ci.cdlClass ?? ''),
      cdlState: String(ci.cdlState ?? ''),
      cdlExpiration: String(ci.cdlExpiration ?? ci.expirationDate ?? ''),
      expirationDate: String(ci.expirationDate ?? ''),
      endorsements: Array.isArray(ci.endorsements) ? (ci.endorsements as string[]) : [],
      restrictions: Array.isArray(ci.restrictions) ? (ci.restrictions as string[]) : [],
    },
    employments: Array.isArray(sd.employments) ? sd.employments : [],
    educations: Array.isArray(sd.educations) ? sd.educations : [],
    skills: Array.isArray(sd.skills) ? sd.skills : [],
    references: Array.isArray(sd.references) ? sd.references : [],
  }
  const buf = generateStyledResumePDF(resumeData as Parameters<typeof generateStyledResumePDF>[0])
  const blob = new Blob([new Uint8Array(buf)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase.replace(/[^\w\s-]/g, '').slice(0, 60) || 'Resume'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
