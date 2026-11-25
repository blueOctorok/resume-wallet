'use client'

import { useCallback, useEffect, useState } from 'react'
import { ScanLine } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import Button from '@/components/ui/Button'
import ProvvenMark from '@/components/ui/ProvvenMark'
import ResumePaperCard, { PaperRule, paperPrimaryButtonClass } from '@/components/hub/ResumePaperCard'
import LicenseBarcodeScanner, { LicenseScanHelp } from '@/components/blocks/LicenseBarcodeScanner'
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
      <ResumePaperCard>
        <header className='mb-5 text-center'>
          <ProvvenMark className='mx-auto block text-2xl' />
          <p className='mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#f15a2b]'>
            {def?.label ?? 'Driver license'}
          </p>
          <PaperRule />
          <p className='mt-3 text-xs text-stone-500'>
            {status === 'complete' ? 'Scanned' : status === 'in-progress' ? 'Waiting for you to confirm' : 'Not started'}
          </p>
        </header>
        <p className='text-center text-sm leading-relaxed text-[#173150]'>
          We read the barcode and show you the fields. The picture is not saved. Confirming replaces what you typed on your profile and the DOT application. An MVR replaces this read, even when the values match.
        </p>
        <div className='mt-4'>
          <LicenseScanHelp paper />
        </div>

        <div className='mt-4 flex justify-center'>
          <Button onClick={() => setScanning(true)} disabled={isSaving} className={paperPrimaryButtonClass}>
            <ScanLine className='h-4 w-4' />
            {showFields ? 'Scan again' : 'Scan the barcode'}
          </Button>
        </div>

          {isLoading && !scan ? (
            <p className='mt-4 text-center text-sm text-stone-500'>Loading your license…</p>
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
                <legend className='text-sm font-semibold text-[#173150]'>Review what we read</legend>
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
                  <Button onClick={() => void onConfirm()} isLoading={isSaving} className={paperPrimaryButtonClass}>
                    {scan.status === 'complete' ? 'Save this barcode read' : 'Use this barcode read'}
                  </Button>
                ) : null}
              </fieldset>
            </div>
          ) : null}

          {error ? <p className='mt-3 text-center text-sm text-red-700'>{error}</p> : null}

          {filled.length > 0 ? (
            <p className='mt-3 text-center text-sm text-stone-600'>
              Filled from the barcode: {filled.join(', ')}. This is a read of the card, not a state record.
            </p>
          ) : null}
      </ResumePaperCard>
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
      {name ?       <p className='mt-1 text-lg font-semibold text-[#173150]'>{name}</p> : null}
      {detail ? <p className='text-sm text-[#173150]'>{detail}</p> : null}
      {fields.endorsements.length > 0 ? (
        <div className='mt-2 flex flex-wrap gap-1.5'>
          {fields.endorsements.map((code) => (
            <span key={code} className='rounded-full bg-white px-2 py-0.5 text-xs font-medium text-[#173150] ring-1 ring-stone-300'>
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
    <label className='block text-xs font-medium text-stone-500'>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-[#173150]'
      />
    </label>
  )
}
