/**
 * Derive common job-application screener answers from a ProjectedCareerCard.
 *
 * These are the fields 80%+ of ATS forms ask for. The bridge modal renders
 * each one with a copy button so the user can paste them on the destination
 * form instead of retyping.
 */

import type { ProjectedCareerCard, CdlData, WorkHistoryData, SkillsData } from '@/types/career-card'

export interface ScreenerAnswer {
  label: string
  value: string
  /** Group for visual sectioning in the UI */
  group: 'identity' | 'career' | 'credentials'
}

function findSectionData<T>(card: ProjectedCareerCard, prefix: string): T | null {
  const section = card.sections.find((s) => s.blockType.startsWith(prefix))
  return section ? (section.data as T) : null
}

function computeYearsOfExperience(workHistory: WorkHistoryData | null): string | null {
  if (!workHistory?.entries?.length) return null
  const now = new Date()
  let totalMonths = 0
  for (const entry of workHistory.entries) {
    const start = new Date(entry.startDate)
    const end = entry.endDate ? new Date(entry.endDate) : now
    totalMonths += Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth())
  }
  const years = Math.round(totalMonths / 12)
  return years > 0 ? `${years}` : null
}

export function deriveScreenerAnswers(
  card: ProjectedCareerCard,
  origin: string,
): ScreenerAnswer[] {
  const answers: ScreenerAnswer[] = []

  if (card.name) {
    answers.push({ label: 'Full name', value: card.name, group: 'identity' })
  }
  if (card.contact?.email) {
    answers.push({ label: 'Email', value: card.contact.email, group: 'identity' })
  }
  if (card.contact?.phone) {
    answers.push({ label: 'Phone', value: card.contact.phone, group: 'identity' })
  }
  if (card.location) {
    answers.push({ label: 'Location', value: card.location, group: 'identity' })
  }

  if (card.shareToken) {
    answers.push({
      label: 'Portfolio / career card URL',
      value: `${origin}/card/${card.shareToken}`,
      group: 'identity',
    })
  }

  if (card.occupation) {
    answers.push({ label: 'Current title / occupation', value: card.occupation, group: 'career' })
  }

  const workHistory = findSectionData<WorkHistoryData>(card, 'work-history') ??
    findSectionData<WorkHistoryData>(card, 'driver-') ??
    findSectionData<WorkHistoryData>(card, 'developer-')
  const yoe = computeYearsOfExperience(workHistory)
  if (yoe) {
    answers.push({ label: 'Years of experience', value: yoe, group: 'career' })
  }

  if (card.professionalSummary) {
    answers.push({ label: 'Professional summary', value: card.professionalSummary, group: 'career' })
  }

  const skills = findSectionData<SkillsData>(card, 'skills')
  if (skills?.skills?.length) {
    answers.push({
      label: 'Skills',
      value: skills.skills.map((s) => s.name).join(', '),
      group: 'career',
    })
  }

  const cdl = findSectionData<CdlData>(card, 'driver-cdl')
  if (cdl?.cdlClass) {
    answers.push({ label: 'CDL class', value: cdl.cdlClass, group: 'credentials' })
  }
  if (cdl?.endorsements?.length) {
    answers.push({ label: 'CDL endorsements', value: cdl.endorsements.join(', '), group: 'credentials' })
  }

  return answers
}
