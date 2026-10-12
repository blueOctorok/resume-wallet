import { describe, expect, it } from 'vitest'
import {
  BENEFIT_QUESTIONS,
  EMPTY_DRIVER_SURVEY,
  normalizeDriverSurvey,
  validateDriverSurvey,
  type DriverSurveyAnswers,
} from './driver-survey'

function complete(): DriverSurveyAnswers {
  const benefits: Record<string, string> = {}
  for (const question of BENEFIT_QUESTIONS) benefits[question.value] = 'very'
  return {
    ...EMPTY_DRIVER_SURVEY,
    easeComplete: 'easy',
    easeNavigate: 'neutral',
    timeToComplete: '15_30',
    benefits,
    likelyAgain: 'likely',
    moreFeedback: 'no',
  }
}

describe('validateDriverSurvey', () => {
  it('accepts a finished survey', () => {
    expect(validateDriverSurvey(complete())).toBeNull()
  })

  it('requires a contact method only when they want more feedback', () => {
    const yes = complete()
    yes.moreFeedback = 'yes'
    expect(validateDriverSurvey(yes)).toMatch(/contact/i)
    yes.contactMethod = 'text'
    expect(validateDriverSurvey(yes)).toBeNull()
  })

  it('requires every feature rating', () => {
    const answers = complete()
    delete answers.benefits.resume_created
    expect(validateDriverSurvey(answers)).toMatch(/beneficial/i)
  })
})

describe('normalizeDriverSurvey', () => {
  it('drops the contact method when they decline more feedback', () => {
    const answers = complete()
    answers.contactMethod = 'phone'
    expect(normalizeDriverSurvey(answers).contactMethod).toBe('')
  })
})
