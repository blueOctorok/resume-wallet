/**
 * Driver focus-group survey. Questions follow Driver_Survey_draft.pdf.
 * The phone scripts in that PDF are for the employee, not this form.
 *
 * Answers are stored as stable keys. Labels can change without rewriting
 * rows that are already saved.
 */

export interface SurveyOption {
  value: string
  label: string
}

export const EASE_OPTIONS: SurveyOption[] = [
  { value: 'very_easy', label: 'Very easy' },
  { value: 'easy', label: 'Easy' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'difficult', label: 'Difficult' },
  { value: 'very_difficult', label: 'Very difficult' },
]

export const TIME_OPTIONS: SurveyOption[] = [
  { value: 'under_15', label: 'Less than 15 minutes' },
  { value: '15_30', label: '15–30 minutes' },
  { value: '30_45', label: '30–45 minutes' },
  { value: 'over_45', label: 'More than 45 minutes' },
]

export const BENEFIT_OPTIONS: SurveyOption[] = [
  { value: 'extremely', label: 'Extremely beneficial' },
  { value: 'very', label: 'Very beneficial' },
  { value: 'somewhat', label: 'Somewhat beneficial' },
  { value: 'not_very', label: 'Not very beneficial' },
  { value: 'not_at_all', label: 'Not beneficial at all' },
]

export const BENEFIT_QUESTIONS: SurveyOption[] = [
  {
    value: 'resume_created',
    label: 'Automatically creating a professional resume after completing your DOT application',
  },
  {
    value: 'resume_updates',
    label: 'Automatically updating your resume whenever your application information changes',
  },
  {
    value: 'verify_manage',
    label: 'Being able to verify and manage the information you provide on your application',
  },
  {
    value: 'reusable_application',
    label: 'Owning one reusable DOT application instead of completing a new application for every employer',
  },
  {
    value: 'one_place',
    label: 'Securely storing your driver profile and application information in one place',
  },
  {
    value: 'no_retyping',
    label: 'Not having to remember employment dates, addresses, and other application details each time you apply',
  },
]

export const LIKELY_OPTIONS: SurveyOption[] = [
  { value: 'very_likely', label: 'Very likely' },
  { value: 'likely', label: 'Likely' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'unlikely', label: 'Unlikely' },
  { value: 'very_unlikely', label: 'Very unlikely' },
]

export const CONTACT_OPTIONS: SurveyOption[] = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text message' },
]

const OPEN_TEXT_MAX = 2000

export interface DriverSurveyAnswers {
  easeComplete: string
  easeNavigate: string
  timeToComplete: string
  benefits: Record<string, string>
  mostValuable: string
  confusing: string
  improvements: string
  likelyAgain: string
  moreFeedback: '' | 'yes' | 'no'
  contactMethod: string
}

export const EMPTY_DRIVER_SURVEY: DriverSurveyAnswers = {
  easeComplete: '',
  easeNavigate: '',
  timeToComplete: '',
  benefits: {},
  mostValuable: '',
  confusing: '',
  improvements: '',
  likelyAgain: '',
  moreFeedback: '',
  contactMethod: '',
}

function isOption(value: string, options: SurveyOption[]): boolean {
  return options.some((option) => option.value === value)
}

function optionLabel(value: string, options: SurveyOption[]): string {
  return options.find((option) => option.value === value)?.label ?? value
}

function clipText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, OPEN_TEXT_MAX) : ''
}

/** Reject anything that is not a complete answer set. Returns the first problem. */
export function validateDriverSurvey(input: unknown): string | null {
  if (!input || typeof input !== 'object') return 'Survey answers are missing.'
  const raw = input as Partial<DriverSurveyAnswers>

  if (!isOption(String(raw.easeComplete ?? ''), EASE_OPTIONS)) {
    return 'Tell us how easy the application was to complete.'
  }
  if (!isOption(String(raw.easeNavigate ?? ''), EASE_OPTIONS)) {
    return 'Tell us how easy the application was to navigate.'
  }
  if (!isOption(String(raw.timeToComplete ?? ''), TIME_OPTIONS)) {
    return 'Tell us how long the application took.'
  }

  const benefits = raw.benefits
  if (!benefits || typeof benefits !== 'object') {
    return 'Rate how beneficial each feature is.'
  }
  for (const question of BENEFIT_QUESTIONS) {
    if (!isOption(String(benefits[question.value] ?? ''), BENEFIT_OPTIONS)) {
      return 'Rate how beneficial each feature is.'
    }
  }

  if (!isOption(String(raw.likelyAgain ?? ''), LIKELY_OPTIONS)) {
    return 'Tell us how likely you are to use the application again.'
  }
  if (raw.moreFeedback !== 'yes' && raw.moreFeedback !== 'no') {
    return 'Tell us if you would give more feedback.'
  }
  if (raw.moreFeedback === 'yes' && !isOption(String(raw.contactMethod ?? ''), CONTACT_OPTIONS)) {
    return 'Choose how we should contact you.'
  }
  return null
}

/** Keep only known fields so a client cannot store extra keys. */
export function normalizeDriverSurvey(input: DriverSurveyAnswers): DriverSurveyAnswers {
  const benefits: Record<string, string> = {}
  for (const question of BENEFIT_QUESTIONS) {
    benefits[question.value] = input.benefits[question.value] ?? ''
  }
  return {
    easeComplete: input.easeComplete,
    easeNavigate: input.easeNavigate,
    timeToComplete: input.timeToComplete,
    benefits,
    mostValuable: clipText(input.mostValuable),
    confusing: clipText(input.confusing),
    improvements: clipText(input.improvements),
    likelyAgain: input.likelyAgain,
    moreFeedback: input.moreFeedback,
    contactMethod: input.moreFeedback === 'yes' ? input.contactMethod : '',
  }
}

export interface SurveyAnswerRow {
  question: string
  answer: string
}

/** Labeled rows for the admin review. Same wording the driver saw. */
export function surveyAnswerRows(answers: DriverSurveyAnswers): SurveyAnswerRow[] {
  const rows: SurveyAnswerRow[] = [
    {
      question: 'How easy was the DOT application to complete?',
      answer: optionLabel(answers.easeComplete, EASE_OPTIONS),
    },
    {
      question: 'How easy was the application to navigate?',
      answer: optionLabel(answers.easeNavigate, EASE_OPTIONS),
    },
    {
      question: 'How long did it take you to complete the application?',
      answer: optionLabel(answers.timeToComplete, TIME_OPTIONS),
    },
  ]
  for (const question of BENEFIT_QUESTIONS) {
    rows.push({
      question: question.label,
      answer: optionLabel(answers.benefits[question.value] ?? '', BENEFIT_OPTIONS),
    })
  }
  rows.push(
    { question: 'Which feature do you find most valuable?', answer: answers.mostValuable || '—' },
    {
      question: 'Is there anything about the application that was confusing or difficult?',
      answer: answers.confusing || '—',
    },
    {
      question: 'What additional features or improvements would you like to see?',
      answer: answers.improvements || '—',
    },
    {
      question: 'How likely are you to use this application again?',
      answer: optionLabel(answers.likelyAgain, LIKELY_OPTIONS),
    },
    {
      question: 'Willing to provide additional feedback?',
      answer: answers.moreFeedback === 'yes' ? 'Yes' : answers.moreFeedback === 'no' ? 'No' : '—',
    },
  )
  if (answers.moreFeedback === 'yes') {
    rows.push({
      question: 'Preferred contact method',
      answer: optionLabel(answers.contactMethod, CONTACT_OPTIONS),
    })
  }
  return rows
}
