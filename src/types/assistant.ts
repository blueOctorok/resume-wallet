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

export type ResumeUploadEventType =
  | 'hash_start'
  | 'hash_complete'
  | 'upload_start'
  | 'upload_complete'
  | 'blockchain_start'
  | 'blockchain_complete'
  | 'upload_error'
  | 'analysis_ready'
  | 'profile_conflict'

export interface ResumeUploadEvent {
  type: ResumeUploadEventType
  step?: string
  data?: any
  error?: string
  message?: string
}

export interface ResumeAnalysis {
  extractedData?: {
    name?: string
    license?: string
    experience?: string
    endorsements?: string[]
    medicalExpiration?: string
    [key: string]: any
  }
  insights: string[]
  missingFields: string[]
  qualityScore: number
}

