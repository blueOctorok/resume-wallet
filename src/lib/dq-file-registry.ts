/**
 * Shared DQ (Driver Qualification) file item registry.
 *
 * One source of truth for labels/sources used by:
 * - Employer DQ monitor (company lens)
 * - Driver hub mirror (driver lens)
 *
 * Status resolution lives in dq-file-status.ts — this file is metadata only.
 */

export type DqItemId =
  | 'mvr'
  | 'psp'
  | 'dot_application'
  | 'cdlis_consent'
  | 'employment_verification'
  | 'dl_images'
  | 'med_card'
  | 'criminal_bg'
  | 'drug_screen'
  | 'clearinghouse'
  | 'cdlis_report'

/** Who supplies the artifact in the real ops workflow. */
export type DqItemSource =
  | 'company_order'
  | 'driver_upload'
  | 'key'
  | 'gov'
  | 'employer_action'

export interface DqItemDefinition {
  id: DqItemId
  label: string
  description: string
  source: DqItemSource
  /** Short CFR / product note for tooltips. */
  cfrNote?: string
  /**
   * When false, this item is a v1 placeholder and must NOT block overall
   * "complete" — otherwise no driver would ever roll up to complete.
   */
  blocksOverallCompletion: boolean
  /** Employer-facing empty-state hint. */
  employerEmptyHint: string
  /** Driver-facing empty-state hint. */
  driverEmptyHint: string
}

export const DQ_ITEM_DEFINITIONS: DqItemDefinition[] = [
  {
    id: 'mvr',
    label: 'Motor Vehicle Record',
    description: 'State DMV pull via integrated CRA (Key / Accio). Driver-owned — visible on every employer DQ monitor.',
    source: 'company_order',
    cfrNote: '§391.23',
    blocksOverallCompletion: true,
    employerEmptyHint: 'No MVR on this driver’s file yet.',
    driverEmptyHint: 'Complete screening consent to order your MVR (agency-sponsored).',
  },
  {
    id: 'psp',
    label: 'FMCSA PSP',
    description: 'Crash and inspection history via FMCSA PSP. Driver-owned — visible on every employer DQ monitor.',
    source: 'company_order',
    cfrNote: '§391.23',
    blocksOverallCompletion: true,
    employerEmptyHint: 'No PSP on this driver’s file yet.',
    driverEmptyHint: 'Complete screening consent to order your PSP (agency-sponsored).',
  },
  {
    id: 'dot_application',
    label: 'DOT application',
    description: 'Federal driver qualification application (Forms 1–3).',
    source: 'driver_upload',
    cfrNote: '§391.21',
    blocksOverallCompletion: true,
    employerEmptyHint: 'Request the DOT application from this driver.',
    driverEmptyHint: 'Complete your DOT application in the hub.',
  },
  {
    id: 'cdlis_consent',
    label: 'CDLIS written consent',
    description: 'Signed CDLIS authorization in the screening consent package. This is consent, not the inquiry report.',
    source: 'employer_action',
    blocksOverallCompletion: true,
    employerEmptyHint: 'Collect the screening consent package (includes CDLIS).',
    driverEmptyHint: 'Sign the screening consent package when requested.',
  },
  {
    id: 'employment_verification',
    label: 'Employment verifications',
    description: 'Prior-employer safety history inquiries. Must be completed within 30 days of hire when a hire date is set.',
    source: 'employer_action',
    cfrNote: '§391.23',
    blocksOverallCompletion: true,
    employerEmptyHint: 'Initiate employment verification with prior employers.',
    driverEmptyHint: 'Employment history is verified by your hiring employer.',
  },
  {
    id: 'dl_images',
    label: 'Driver license (front & back)',
    description: 'Photos of both sides of the commercial driver license.',
    source: 'driver_upload',
    blocksOverallCompletion: false,
    employerEmptyHint: 'Needs driver upload (coming soon).',
    driverEmptyHint: 'Upload coming soon — your employer will ask for DL photos.',
  },
  {
    id: 'med_card',
    label: 'DOT medical card',
    description: 'Photo of the medical examiner’s certificate.',
    source: 'driver_upload',
    cfrNote: '§391.43',
    blocksOverallCompletion: false,
    employerEmptyHint: 'Needs driver upload (coming soon).',
    driverEmptyHint: 'Upload coming soon — keep your med card ready.',
  },
  {
    id: 'criminal_bg',
    label: 'Criminal background check',
    description: 'Criminal background report ordered through Key.',
    source: 'key',
    blocksOverallCompletion: false,
    employerEmptyHint: 'Needs Key order (coming soon).',
    driverEmptyHint: 'Ordered by your employer through Key when needed.',
  },
  {
    id: 'drug_screen',
    label: 'DOT drug screen',
    description: 'Completed DOT drug screen results via Key.',
    source: 'key',
    blocksOverallCompletion: false,
    employerEmptyHint: 'Needs Key order (coming soon).',
    driverEmptyHint: 'Ordered by your employer through Key when needed.',
  },
  {
    id: 'clearinghouse',
    label: 'FMCSA Clearinghouse',
    description: 'FMCSA Drug & Alcohol Clearinghouse query results.',
    source: 'gov',
    blocksOverallCompletion: false,
    employerEmptyHint: 'Needs government / employer Clearinghouse query (coming soon).',
    driverEmptyHint: 'Queried by your employer via FMCSA Clearinghouse.',
  },
  {
    id: 'cdlis_report',
    label: 'CDLIS inquiry report',
    description: 'Full CDLIS report from Key. Distinct from written consent on file.',
    source: 'key',
    blocksOverallCompletion: false,
    employerEmptyHint: 'Needs Key CDLIS inquiry (coming soon). Consent may already be on file.',
    driverEmptyHint: 'Report ordered by your employer through Key when needed.',
  },
]

export function getDqItemDefinition(id: DqItemId): DqItemDefinition {
  const def = DQ_ITEM_DEFINITIONS.find((d) => d.id === id)
  if (!def) throw new Error(`Unknown DQ item: ${id}`)
  return def
}

export function getLiveDqItems(): DqItemDefinition[] {
  return DQ_ITEM_DEFINITIONS.filter((d) => d.blocksOverallCompletion)
}

export function getPlaceholderDqItems(): DqItemDefinition[] {
  return DQ_ITEM_DEFINITIONS.filter((d) => !d.blocksOverallCompletion)
}

/** Human label for empty placeholder source chips. */
export function dqSourceChipLabel(source: DqItemSource): string {
  switch (source) {
    case 'driver_upload':
      return 'Needs driver'
    case 'key':
      return 'Needs Key'
    case 'gov':
      return 'Needs gov’t'
    case 'employer_action':
      return 'Needs employer'
    case 'company_order':
      return 'Needs order'
    default:
      return 'Pending'
  }
}
