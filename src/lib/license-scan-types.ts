import type { LicenseScanFields } from '@/lib/aamva-license'

/** What the license page renders. No proof, no DMV citation. */
export interface LicenseScanView {
  hasFront: boolean
  hasBack: boolean
  frontUrl: string | null
  backUrl: string | null
  barcodeStatus: 'unread' | 'read' | 'failed'
  fields: LicenseScanFields | null
  confirmedAt: string | null
  status: 'empty' | 'in-progress' | 'complete'
}
