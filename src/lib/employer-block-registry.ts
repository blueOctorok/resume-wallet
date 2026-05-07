import type { LucideIcon } from 'lucide-react'
import { FileSearch, ShieldAlert } from 'lucide-react'

export type EmployerBlockCategoryId = 'drivers' | 'developers' | 'general'

export interface EmployerBlockDefinition {
  id: string
  label: string
  description: string
  icon: LucideIcon
  categoryId: EmployerBlockCategoryId
  /** Display order in the picker; lower = sooner */
  suggestedOrder: number
  /** If false, the picker does not offer install (e.g. future stub). Defaults true. */
  installable?: boolean
  pricingNote?: string
  complianceNote?: string
}

export const EMPLOYER_BLOCK_DEFINITIONS: EmployerBlockDefinition[] = [
  {
    id: 'employer-mvr-orders',
    label: 'MVR ordering',
    description: 'Request and place employer-paid motor vehicle reports through your integrated CRA.',
    icon: FileSearch,
    categoryId: 'drivers',
    suggestedOrder: 0,
    installable: true,
    pricingNote: 'Per-order USDC pricing at checkout.',
  },
  {
    id: 'employer-psp-orders',
    label: 'PSP (FMCSA) ordering',
    description: 'Pre-employment screening (crash/inspection history) orders for commercial drivers.',
    icon: ShieldAlert,
    categoryId: 'drivers',
    suggestedOrder: 1,
    installable: true,
    pricingNote: 'Per-order USDC pricing at checkout.',
    complianceNote: 'PSP is live with FMCSA — there is no sandbox environment.',
  },
  {
    id: 'employer-employment-verification',
    label: 'Employment verification (coming soon)',
    description: 'Orchestrated previous-employer outreach for DOT-compliant employment checks.',
    icon: ShieldAlert,
    categoryId: 'drivers',
    suggestedOrder: 99,
    installable: false,
  },
]

export function getEmployerBlockDefinition(
  id: string,
): EmployerBlockDefinition | undefined {
  return EMPLOYER_BLOCK_DEFINITIONS.find((b) => b.id === id)
}

/** Blocks that can be added from the picker / APIs */
export function getInstallableEmployerBlockDefinitions(): EmployerBlockDefinition[] {
  return EMPLOYER_BLOCK_DEFINITIONS.filter((b) => b.installable !== false)
}
