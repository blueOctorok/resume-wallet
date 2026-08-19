import type { LucideIcon } from 'lucide-react'
import {
  FileSearch,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'

export type EmployerBlockCategoryId = 'general' | 'drivers'

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
  // Each employer block enables exactly one candidate-side capability.
  // All installable blocks are auto-provisioned for every company.
  //
  // NOT here (by design):
  //   - DOT application — a core block auto-installed on every driver hub;
  //     employers never request it.
  //   - Portfolio requests — developer outreach retired (drivers-only wedge).
  //   - Resume — a byproduct of the DOT application, not a request type.
  //
  // ── Drivers ───────────────────────────────────────────────────────────────
  {
    id: 'employer-screening-consent',
    label: 'Screening consent collection',
    description:
      'Collect FCRA Background Check Disclosure, FMCSA PSP Authorization, and CDLIS written consent in one bundle per candidate. Required before MVR/PSP orders; CDLIS portion is stored for compliance and a future CDLIS inquiry block (not sent in Accio PSP XML today).',
    icon: ShieldCheck,
    categoryId: 'drivers',
    suggestedOrder: -4,
    installable: true,
    complianceNote: 'FCRA + FMCSA compliant consent collection.',
  },
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
    label: 'PSP ordering',
    description:
      'FMCSA Pre-Employment Screening (crash/inspection history) via your integrated CRA. Requires screening consent on file for the candidate; MVR is ordered separately when needed.',
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
