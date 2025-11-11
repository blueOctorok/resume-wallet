export type JourneyStatus = 'pending' | 'in_progress' | 'complete'

export interface JourneyStepState {
  status: JourneyStatus
  updatedAt: string
}

export interface DriverJourneyState {
  wallet: JourneyStepState
  resume: JourneyStepState
  forms: JourneyStepState
  submission: JourneyStepState
  currentFormStep: number | null
  lastCompletedForm?: number | null
}

export interface AssistantHelpPayload {
  section: string
  question: string
  regulation?: string
  context?: string
  dataSnapshot?: unknown
}

export interface AssistantHelpRequest extends AssistantHelpPayload {
  id: string
  createdAt: string
}

export interface PrimerPrompt {
  id: string
  message: string
}

