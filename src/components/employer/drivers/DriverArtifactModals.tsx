'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import type { LicenseScanView } from '@/lib/license-scan-types'
import type { DriverFileDetail } from '@/lib/dq-file-load'
import { fmtDate } from './DriverFileItems'

const EV_STATUS_LABEL: Record<string, string> = {
  VERIFICATION_REQUESTED: 'Requested',
  VERIFICATION_IN_PROGRESS: 'In progress',
  SELF_REPORTED: 'Self-reported',
  VERIFIED: 'Verified',
  PARTIALLY_VERIFIED: 'Partially verified',
  VERIFICATION_DENIED: 'Denied',
  ATTEMPTS_EXHAUSTED: 'No response',
  VERIFICATION_DECLINED: 'Declined',
}

/**
 * Read-only copy of the driver's license block. Photos and the barcode read,
 * loaded only when Pace opens it — the board row stays a summary.
 */
export function DriverLicenseViewModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [scan, setScan] = useState<LicenseScanView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/employer/dq-monitor/${userId}/license`)
        const data = (await res.json()) as { error?: string; scan?: LicenseScanView }
        if (!res.ok) throw new Error(data.error ?? 'Could not load the license')
        if (!cancelled) setScan(data.scan ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the license')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const fields = scan?.fields
  const rows = fields
    ? [
        ['Name', [fields.firstName, fields.middleName, fields.lastName].filter(Boolean).join(' ')],
        ['Date of birth', fields.dateOfBirth],
        ['License number', fields.licenseNumber],
        ['State', fields.state],
        ['Class', fields.licenseClass],
        ['Expires', fields.expirationDate],
        ['Endorsements', fields.endorsements.join(' ')],
        ['Restrictions', fields.restrictions.join(' ')],
        ['Street', fields.street],
        ['City', fields.city],
        ['ZIP', fields.postalCode],
      ].filter(([, value]) => value.trim().length > 0)
    : []

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" zIndex={10100} panelShape="block" panelClassName="!border-stone-200 !bg-white !ring-[#173150]/10">
      <ModalHeader variant="block" title="Driver license" subtitle="Read from the license barcode. Not a state record." onClose={onClose} />
      <div className="space-y-4 p-4">
        {!scan && !error && (
          <p className="flex items-center gap-2 text-sm text-ironside">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading license…
          </p>
        )}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {scan && (
          <>
            {scan.barcodeStatus === 'failed' && (
              <p className="text-sm text-dark-amber">These fields were entered by the driver. The barcode was not read.</p>
            )}
            {rows.length > 0 && (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {rows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-ironside">{label}</dt>
                    <dd className="text-sm text-[#173150]">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {scan.confirmedAt && <p className="text-xs text-ironside">Confirmed {fmtDate(scan.confirmedAt)}</p>}
          </>
        )}
      </div>
    </Modal>
  )
}

export function DriverEmploymentViewModal({
  rows,
  onClose,
}: {
  rows: DriverFileDetail['employmentVerifications']
  onClose: () => void
}) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndex={10100} panelShape="block" panelClassName="!border-stone-200 !bg-white !ring-[#173150]/10">
      <ModalHeader variant="block" title="Employment verifications" subtitle="Prior employers on this driver's file." onClose={onClose} />
      <ul className="divide-y divide-stone-200 p-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-2 py-2.5 text-sm">
            <span className="min-w-0 truncate font-medium text-[#173150]">{row.employerName}</span>
            <span className="shrink-0 text-xs text-ironside">
              {EV_STATUS_LABEL[row.status] ?? row.status}
              {row.attemptCount > 0 && ` · ${row.attemptCount} attempt${row.attemptCount === 1 ? '' : 's'}`}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
