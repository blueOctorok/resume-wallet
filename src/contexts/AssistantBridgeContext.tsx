import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type {
  AssistantHelpPayload,
  DriverJourneyState,
  ResumeUploadEvent,
} from '@/types/assistant'

interface AssistantBridgeContextValue {
  journey: DriverJourneyState
  requestHelp: (payload: AssistantHelpPayload) => void
  primerSeen: boolean
  setPrimerSeen: (value: boolean) => void
  notifyResumeUploadEvent?: (event: ResumeUploadEvent) => void
}

const AssistantBridgeContext = createContext<AssistantBridgeContextValue | null>(
  null
)

interface AssistantBridgeProviderProps extends AssistantBridgeContextValue {
  children: ReactNode
}

export function AssistantBridgeProvider({
  children,
  ...value
}: AssistantBridgeProviderProps) {
  return (
    <AssistantBridgeContext.Provider value={value}>
      {children}
    </AssistantBridgeContext.Provider>
  )
}

export function useAssistantBridge() {
  const context = useContext(AssistantBridgeContext)
  if (!context) {
    throw new Error(
      'useAssistantBridge must be used within an AssistantBridgeProvider'
    )
  }
  return context
}

