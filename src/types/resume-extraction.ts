/**
 * AI-extracted resume shape (Claude JSON) → merged into block_* tables + resumes.structured_data.
 * Aligns with stormchain_resume_v1 used by Resume Builder / PDF generator.
 */

export interface ParsedResumePersonalInfo {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  city?: string
  state?: string
  zipCode?: string
  professionalSummary?: string
}

export interface ParsedResumeCdlInfo {
  cdlClass?: string
  cdlState?: string
  cdlNumber?: string
  cdlExpiration?: string
  endorsements?: string[]
}

export interface ParsedResumeEmployment {
  companyName?: string
  position?: string
  location?: string
  startDate?: string
  endDate?: string
  isCurrent?: boolean
  responsibilities?: string[]
}

export interface ParsedResumeEducation {
  school?: string
  degree?: string
  field?: string
  year?: string
  certifications?: string[]
}

export interface ParsedResumeSkill {
  name: string
  category?: 'equipment' | 'route' | 'technology' | 'safety' | 'other'
}

export interface ParsedResumeReference {
  name?: string
  phone?: string
  email?: string
  relationship?: string
  title?: string
  company?: string
}

/** Full extraction payload from /api/ai/parse-resume and accepted by apply-extraction */
export interface ParsedResumeExtraction {
  personalInfo?: ParsedResumePersonalInfo
  cdlInfo?: ParsedResumeCdlInfo
  employments?: ParsedResumeEmployment[]
  educations?: ParsedResumeEducation[]
  skills?: ParsedResumeSkill[]
  references?: ParsedResumeReference[]
}
