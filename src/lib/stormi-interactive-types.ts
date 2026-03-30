/**
 * Structured payloads embedded in Stormi chat messages for interactive UI (not plain text).
 * Kept in a dedicated module so ava-chat and persistence can import without cycles.
 */

export interface StormiInterviewPrepChoice {
  id: string
  text: string
  /** Short coaching shown after the user taps this option (honest prep — not live interview cheating). */
  feedback: string
}

/** One multiple-choice practice question; user taps an option to see feedback inline. */
export interface StormiInterviewPrepPayload {
  kind: 'interview_prep_mcq'
  /** e.g. "behavioral", "role-specific" */
  topic?: string
  question: string
  choices: StormiInterviewPrepChoice[]
  /** Which choice is the strongest interview answer (coaching — user may still read all feedback). */
  recommendedChoiceId: string
}
