'use client'

import { useCallback, useEffect, useState } from 'react'
import { IdCard, ScanLine } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import LicenseBarcodeScanner, { LicenseScanHelp } from '@/components/blocks/LicenseBarcodeScanner'
import { useTheme } from '@/contexts/ThemeContext'
import { emptyLicenseFields, type LicenseScanFields } from '@/lib/aamva-license'
import { getBlockDefinition } from '@/lib/block-registry'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { useAuthStore } from '@/stores'
import { useLicenseBlockStore } from '@/stores/license-block-store'

const def = getBlockDefinition('driver-license')

/**
 * The driver holds the back of the license up to the camera. We read the
 * barcode in the browser and keep the fields. The picture is not stored.
 * This is a read of the card, not a state record and not a Midnight proof.
 */
export default function DriverLicenseBlock({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const scan = useLicenseBlockStore((s) => s.scan)
  const isLoading = useLicenseBlockStore((s) => s.isLoading)
  const isSaving = useLicenseBlockStore((s) => s.isSaving)
  const error = useLicenseBlockStore((s) => s.error)
  const filled = useLicenseBlockStore((s) => s.filled)
  const load = useLicenseBlockStore((s) => s.load)
  const submitBarcode = useLicenseBlockStore((s) => s.submitBarcode)
  const confirm = useLicenseBlockStore((s) => s.confirm)

  const [draft, setDraft] = useState<LicenseScanFields>(emptyLicenseFields())
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  const savedFieldKey = scan?.fields ? JSON.stringify(scan.fields) : ''
  useEffect(() => {
    setDraft(scan?.fields ?? emptyLicenseFields())
  }, [savedFieldKey, scan?.fields])

  const onBarcode = useCallback((raw: string) => {
    setScanning(false)
    void submitBarcode(raw)
  }, [submitBarcode])

  const status = scan?.status === 'complete'
    ? 'complete'
    : scan?.status === 'in-progress'
      ? 'in-progress'
      : 'empty'

  const barcodeRead = scan?.barcodeStatus === 'read' && Boolean(scan.fields)
  const showFields = Boolean(scan?.fields?.licenseNumber)

  const onConfirm = async () => {
    const ok = await confirm({
      ...draft,
      endorsements: splitCodes(draft.endorsements),
      restrictions: splitCodes(draft.restrictions),
    })
    if (ok && sessionUserId) void syncDriverHubFromApi(sessionUserId)
  }

  return (
    <div className='mx-auto max-w-2xl'>
      <BackToHubButton onClick={onBack} />
      <HubSectionPanel isDark={isDark} accent='teal'>
        <BlockCard
          variant='embed'
          icon={IdCard}
          title={def?.label ?? 'Driver license'}
          description='Read from the barcode on the back of the card. A carrier still orders a motor vehicle record before this is a verified fact.'
          status={status}
        >
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            We read the barcode and show you the fields. The picture is not saved. Confirming replaces what you typed on the DOT application. An MVR replaces this read, even when the values match.
          </p>
          <div className='mt-4'>
            <LicenseScanHelp />
          </div>

          <div className='mt-4'>
            <Button onClick={() => setScanning(true)} disabled={isSaving}>
              <ScanLine className='h-4 w-4' />
              {showFields ? 'Scan again' : 'Scan the barcode'}
            </Button>
          </div>

          {isLoading && !scan ? (
            <p className='mt-4 text-sm text-gray-500 dark:text-gray-400'>Loading your license…</p>
          ) : null}

          {scan && scan.barcodeStatus === 'failed' && showFields ? (
            <p className='mt-4 text-sm text-dark-amber'>
              These fields were typed. Scan the barcode to replace them with a read from the card.
            </p>
          ) : null}

          {showFields && scan?.fields ? (
            <div className='mt-4 space-y-4'>
              <BarcodeSummary fields={scan.fields} fromBarcode={barcodeRead} />
              <fieldset className='space-y-3' disabled={isSaving || !barcodeRead}>
                <legend className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
                  Review what we read
                </legend>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <Field label='First name' value={draft.firstName} onChange={(v) => setDraft({ ...draft, firstName: v })} />
                  <Field label='Middle name' value={draft.middleName} onChange={(v) => setDraft({ ...draft, middleName: v })} />
                  <Field label='Last name' value={draft.lastName} onChange={(v) => setDraft({ ...draft, lastName: v })} />
                  <Field label='Date of birth' value={draft.dateOfBirth} onChange={(v) => setDraft({ ...draft, dateOfBirth: v })} type='date' />
                  <Field label='License number' value={draft.licenseNumber} onChange={(v) => setDraft({ ...draft, licenseNumber: v })} />
                  <Field label='State' value={draft.state} onChange={(v) => setDraft({ ...draft, state: v.toUpperCase().slice(0, 2) })} />
                  <Field label='Class' value={draft.licenseClass} onChange={(v) => setDraft({ ...draft, licenseClass: v.toUpperCase() })} />
                  <Field label='Expires' value={draft.expirationDate} onChange={(v) => setDraft({ ...draft, expirationDate: v })} type='date' />
                  <Field label='Endorsements' value={draft.endorsements.join(' ')} onChange={(v) => setDraft({ ...draft, endorsements: v.split(/\s+/).filter(Boolean) })} />
                  <Field label='Restrictions' value={draft.restrictions.join(' ')} onChange={(v) => setDraft({ ...draft, restrictions: v.split(/\s+/).filter(Boolean) })} />
                  <Field label='Street' value={draft.street} onChange={(v) => setDraft({ ...draft, street: v })} />
                  <Field label='City' value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} />
                  <Field label='ZIP' value={draft.postalCode} onChange={(v) => setDraft({ ...draft, postalCode: v })} />
                </div>
                {barcodeRead ? (
                  <Button onClick={() => void onConfirm()} isLoading={isSaving}>
                    {scan.status === 'complete' ? 'Save this barcode read' : 'Use this barcode read'}
                  </Button>
                ) : null}
              </fieldset>
            </div>
          ) : null}

          {error ? <p className='mt-3 text-sm text-red-600 dark:text-red-400'>{error}</p> : null}

          {filled.length > 0 ? (
            <p className='mt-3 text-sm text-gray-600 dark:text-gray-400'>
              Filled from the barcode: {filled.join(', ')}. This is a read of the card, not a state record.
            </p>
          ) : null}
        </BlockCard>
      </HubSectionPanel>
      {scanning ? <LicenseBarcodeScanner onRead={onBarcode} onClose={() => setScanning(false)} /> : null}
    </div>
  )
}

function BarcodeSummary({ fields, fromBarcode }: { fields: LicenseScanFields; fromBarcode: boolean }) {
  const name = [fields.firstName, fields.middleName, fields.lastName].filter(Boolean).join(' ')
  const detail = [
    fields.licenseClass ? `Class ${fields.licenseClass}` : null,
    fields.state || null,
    fields.expirationDate ? `expires ${displayDate(fields.expirationDate)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className='rounded-xl border border-retro-teal/40 bg-retro-teal/10 p-4'>
      <p className='text-[10px] font-semibold uppercase tracking-wide text-retro-teal'>
        {fromBarcode ? 'Read from the license barcode' : 'Entered by the driver'}
      </p>
      {name ? <p className='mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100'>{name}</p> : null}
      {detail ? <p className='text-sm text-gray-700 dark:text-gray-300'>{detail}</p> : null}
      {fields.endorsements.length > 0 ? (
        <div className='mt-2 flex flex-wrap gap-1.5'>
          {fields.endorsements.map((code) => (
            <span key={code} className='rounded-full bg-white px-2 py-0.5 text-xs font-medium text-[#173150] dark:bg-gray-900 dark:text-gray-100'>
              {code}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function displayDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${month}/${day}/${year}`
}

function splitCodes(codes: string[]): string[] {
  return codes.flatMap((code) => code.split(/[^A-Za-z0-9]+/)).map((code) => code.trim().toUpperCase()).filter(Boolean)
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className='block text-xs font-medium text-gray-600 dark:text-gray-400'>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
      />
    </label>
  )
}
