import type { LicenseScanFields } from '@/lib/aamva-license'

/** What the license page renders. The barcode read, with no photo. */
export interface LicenseScanView {
  barcodeStatus: 'unread' | 'read' | 'failed'
  fields: LicenseScanFields | null
  confirmedAt: string | null
  status: 'empty' | 'in-progress' | 'complete'
}
