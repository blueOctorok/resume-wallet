'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AdminTabProps } from '@/components/admin/admin-types'
import type { AdminLicenseRecord } from '@/lib/admin-license'
import { getTableCellClass, getTableHeaderClass } from '@/components/admin/admin-styles'
import { isDarkTheme } from '@/lib/theme-storage'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

function statusLabel(license: AdminLicenseRecord): string {
  if (license.status === 'complete') return 'Confirmed'
  if (license.barcodeStatus === 'failed') return 'Barcode failed'
  if (license.barcodeStatus === 'read') return 'Read, not confirmed'
  return 'Not scanned'
}

export default function LicensesTab({
  theme,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [licenses, setLicenses] = useState<AdminLicenseRecord[]>([])
  const [open, setOpen] = useState<AdminLicenseRecord | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * pageSize
      const response = await fetch(
        `/api/admin/licenses?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { cache: 'no-store' },
      )
      const data = (await response.json()) as {
        success?: boolean
        error?: string
        licenses?: AdminLicenseRecord[]
        total?: number
      }
      if (!response.ok || !data.success) {
        setError(data.error || 'Could not load licenses')
        return
      }
      setError(null)
      setLicenses(data.licenses ?? [])
      setTotalCount(data.total ?? 0)
    } catch (err) {
      console.error('[ADMIN LICENSES]', err)
      setError('Could not load licenses')
    }
  }, [searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const askDelete = (license: AdminLicenseRecord) => {
    // The record modal sits above the shared confirm dialog. Close it first
    // so the confirm is the dialog on screen.
    setOpen(null)
    onDelete({
      type: 'license',
      id: license.userId,
      name: `${license.name || license.email || 'this driver'}'s license`,
    })
  }

  const openLicense = async (userId: string) => {
    setOpeningId(userId)
    setError(null)
    try {
      const response = await fetch(`/api/admin/licenses/${userId}`)
      const data = (await response.json()) as { success?: boolean; error?: string; license?: AdminLicenseRecord }
      if (!response.ok || !data.license) {
        setError(data.error || 'Could not open license')
        return
      }
      setOpen(data.license)
    } catch (err) {
      console.error('[ADMIN LICENSE]', err)
      setError('Could not open license')
    } finally {
      setOpeningId(null)
    }
  }

  const header = getTableHeaderClass(theme)
  const cell = getTableCellClass(theme)
  const muted = isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'

  return (
    <div>
      {error && <p className='mb-3 text-sm text-red-600 dark:text-red-400'>{error}</p>}
      {licenses.length === 0 && !error ? (
        <p className={`py-8 text-center text-sm ${muted}`}>No licenses on file.</p>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}>
              <tr>
                <th className={`${header} px-4 py-3 text-left`}>Driver</th>
                <th className={`${header} px-4 py-3 text-left`}>License</th>
                <th className={`${header} px-4 py-3 text-left`}>Class</th>
                <th className={`${header} px-4 py-3 text-left`}>Expires</th>
                <th className={`${header} px-4 py-3 text-left`}>Status</th>
                <th className={`${header} px-4 py-3`} />
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
              {licenses.map((license) => (
                <tr key={license.userId}>
                  <td className={cell}>
                    <div>{license.name || '—'}</div>
                    <div className={`text-xs ${muted}`}>{license.email || '—'}</div>
                  </td>
                  <td className={cell}>
                    {license.licenseNumber || '—'}
                    {license.state ? <span className={`ml-1 text-xs ${muted}`}>({license.state})</span> : null}
                  </td>
                  <td className={cell}>{license.licenseClass || '—'}</td>
                  <td className={cell}>{license.expirationDate || '—'}</td>
                  <td className={cell}>{statusLabel(license)}</td>
                  <td className={cell}>
                    <div className='flex justify-end gap-2'>
                      <Button variant='ghost' size='sm' onClick={() => void openLicense(license.userId)} isLoading={openingId === license.userId}>
                        View
                      </Button>
                      <Button variant='danger' size='sm' onClick={() => askDelete(license)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal onClose={() => setOpen(null)} maxWidth='max-w-2xl' zIndex={1100}>
          <ModalHeader
            title={open.name || 'Driver license'}
            subtitle={open.email || undefined}
            onClose={() => setOpen(null)}
          />
          <div className='space-y-4 p-4 sm:p-5'>
            <p className={`text-xs ${muted}`}>
              Read from the license barcode. Not a state record.
            </p>
            <dl className='grid grid-cols-2 gap-3 text-sm'>
              <Fact label='Number' value={open.licenseNumber} />
              <Fact label='State' value={open.state} />
              <Fact label='Class' value={open.licenseClass} />
              <Fact label='Expires' value={open.expirationDate} />
              <Fact label='Date of birth' value={open.dateOfBirth} />
              <Fact label='Status' value={statusLabel(open)} />
              <Fact label='Endorsements' value={open.endorsements.join(', ') || null} />
              <Fact label='Restrictions' value={open.restrictions.join(', ') || null} />
              <div className='col-span-2'>
                <Fact label='Address' value={open.address} />
              </div>
            </dl>
            <div className='flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700'>
              <Button variant='danger' size='sm' onClick={() => askDelete(open)}>
                Delete license
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className='text-xs font-medium text-gray-500 dark:text-gray-400'>{label}</dt>
      <dd className='mt-0.5 text-gray-900 dark:text-gray-100'>{value || '—'}</dd>
    </div>
  )
}
