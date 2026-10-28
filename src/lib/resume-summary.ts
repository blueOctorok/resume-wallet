/**
 * Two-sentence resume summary. Sonnet, not Haiku: this paragraph is what a
 * carrier reads first, so it gets the drafting model.
 *
 * Voice is the resume default: no "I", and no "this driver". The city stays
 * in the header. Numbers and credentials are passed in as facts. The model
 * is told not to invent miles, rates, or a clean MVR.
 *
 * The in-process cache keeps a second open of the same resume from calling
 * the model again. `voice` is part of the key so a rewritten prompt does
 * not reuse the old paragraph.
 */

import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_MODEL_SONNET } from '@/lib/anthropic-models'

export interface ResumeSummaryJob {
  titleLine: string
  dateRange: string
  bullets: string[]
  miles?: string | null
}

export interface ResumeSummaryMvr {
  violationCount: number
  licenseStatus: string | null
}

export interface ResumeSummaryInput {
  /** Class and state from a confirmed barcode, when one is on file. */
  licenseLabel: string | null
  /** Letters or words saved on the application. Not a Midnight proof. */
  endorsements: string[]
  jobs: ResumeSummaryJob[]
  /** Present only when a parsed motor vehicle report is on file. */
  mvr: ResumeSummaryMvr | null
}

const cache = new Map<string, string>()

const SYSTEM = `You write the two-sentence summary at the top of a truck driver's resume.
Use resume voice. No pronouns. Do not say I, my, he, she, this driver, the driver, or the driver's name.
The city is already in the header. Do not mention the city or the state.
Use a number only when it appears in the facts. Do not invent miles, percentages, on-time rates, or accident-free claims.
When a years line is present, the first sentence must include that figure.
When a license line is present, name that class exactly. Do not call a Class D a CDL.
When an endorsements line is present, name each endorsement. Do not add endorsements that are not listed, and do not call them verified.
When a motor vehicle report line shows 0 violations and the status is not suspended, revoked, or disqualified, you may say clean MVR and include the count. Otherwise state the violation count. When there is no motor vehicle report line, do not mention one.
The license line is a barcode read, not a DMV check.
No bullet points. No quotation marks.`

export function endorsementLabels(raw: string[]): string[] {
  const labels: string[] = []
  const add = (label: string) => {
    if (!labels.includes(label)) labels.push(label)
  }
  for (const entry of raw) {
    const lower = entry.trim().toLowerCase()
    if (!lower) continue
    if (lower === 'x') {
      add('Hazmat')
      add('Tanker')
    } else if (lower === 'h' || lower.includes('hazmat') || lower.includes('hazardous')) {
      add('Hazmat')
    } else if (lower === 'n' || lower.includes('tanker') || /\btank\b/.test(lower)) {
      add('Tanker')
    } else if (lower === 't' || lower.includes('double') || lower.includes('triple')) {
      add('Doubles/triples')
    } else {
      add(entry.trim())
    }
  }
  return labels
}

/** Earliest start through the latest end, using the current year for Present. */
export function yearsOnRecord(ranges: string[], nowYear: number): number | null {
  let startYear: number | null = null
  let endYear: number | null = null
  for (const range of ranges) {
    const years = range.match(/\d{4}/g)?.map(Number) ?? []
    if (years.length === 0) continue
    const start = years[0]
    const end = /present/i.test(range) ? nowYear : years[years.length - 1]
    if (startYear === null || start < startYear) startYear = start
    if (endYear === null || end > endYear) endYear = end
  }
  if (startYear === null || endYear === null || endYear <= startYear) return null
  return endYear - startYear
}

export function resumeSummaryCacheKey(input: ResumeSummaryInput): string {
  return JSON.stringify({
    voice: 'resume-facts',
    licenseLabel: input.licenseLabel,
    endorsements: endorsementLabels(input.endorsements),
    mvr: input.mvr,
    jobs: input.jobs.map((job) => ({
      titleLine: job.titleLine,
      dateRange: job.dateRange,
      bullets: job.bullets,
      miles: job.miles ?? null,
    })),
  })
}

export function resumeSummaryPrompt(input: ResumeSummaryInput, nowYear = new Date().getFullYear()): string {
  const years = yearsOnRecord(
    input.jobs.map((job) => job.dateRange),
    nowYear,
  )
  const endorsements = endorsementLabels(input.endorsements)
  const jobs = input.jobs
    .map((job) => {
      const when = job.dateRange || 'dates not listed'
      const bullets = job.bullets.length > 0 ? ` — ${job.bullets.join('; ')}` : ''
      const miles = job.miles?.trim() ? ` — miles recorded: ${job.miles.trim()}` : ''
      return `${job.titleLine} (${when})${bullets}${miles}`
    })
    .join('\n')
  const mvr = input.mvr
    ? `Motor vehicle report: ${input.mvr.violationCount} violations${input.mvr.licenseStatus ? `, license status ${input.mvr.licenseStatus}` : ''}`
    : null
  return [
    years ? `Years on record: ${years}` : null,
    input.licenseLabel ? `License barcode read: ${input.licenseLabel}` : null,
    endorsements.length > 0 ? `Endorsements on the application: ${endorsements.join(', ')}` : null,
    mvr,
    'Jobs:',
    jobs,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
}

/** Keep the first finished sentences. A raw character cut was landing mid-word. */
export function completeSentences(text: string, count: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?/g)
  if (!sentences || sentences.length === 0) return text.trim()
  return sentences
    .slice(0, count)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function writeResumeSummary(input: ResumeSummaryInput): Promise<string | null> {
  if (input.jobs.length === 0) return null
  const key = resumeSummaryCacheKey(input)
  const cached = cache.get(key)
  if (cached) return cached
  if (!process.env.AVA_BRAIN) {
    console.warn('[RESUME SUMMARY] AVA_BRAIN missing')
    return null
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.AVA_BRAIN })
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL_SONNET,
      max_tokens: 180,
      system: SYSTEM,
      messages: [{ role: 'user', content: resumeSummaryPrompt(input) }],
    })
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/^["']|["']$/g, '')
      .trim()
    const summary = completeSentences(text, 2)
    if (!summary) return null
    cache.set(key, summary)
    return summary
  } catch (error) {
    console.error('[RESUME SUMMARY]', error)
    return null
  }
}
