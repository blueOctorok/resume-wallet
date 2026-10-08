'use client'

import { useEffect, useState } from 'react'
import { Camera, IdCard } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import { useTheme } from '@/contexts/ThemeContext'
import { emptyLicenseFields, type LicenseScanFields } from '@/lib/aamva-license'
import { getBlockDefinition } from '@/lib/block-registry'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { useAuthStore } from '@/stores'
import { useLicenseBlockStore } from '@/stores/license-block-store'

const def = getBlockDefinition('driver-license')

/**
 * Photograph both sides of a license, read the barcode on the back, and
 * let the driver confirm the fields. The card is on file. It is not a
 * state-record check and it is not a Midnight proof.
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
  const uploadSide = useLicenseBlockStore((s) => s.uploadSide)
  const confirm = useLicenseBlockStore((s) => s.confirm)

  const [draft, setDraft] = useState<LicenseScanFields>(emptyLicenseFields())

  useEffect(() => {
    void load()
  }, [load])

  // Reset the review form when a new read comes back. Keyed off the saved
  // fields, so typing in the form does not snap the inputs back.
  const savedFieldKey = scan?.fields ? JSON.stringify(scan.fields) : ''
  useEffect(() => {
    setDraft(scan?.fields ?? emptyLicenseFields())
  }, [savedFieldKey, scan?.fields])

  const status = scan?.status === 'complete'
    ? 'complete'
    : scan?.status === 'in-progress'
      ? 'in-progress'
      : 'empty'

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
          description='On file from the card you photograph. A carrier still orders a motor vehicle record before this is a verified fact.'
          status={status}
        >
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            Photograph the front, then the back, with a phone or a computer camera. You can also choose a photo you already took. We read the barcode on the back. Confirming replaces what you typed on the DOT application. An MVR replaces the license, even when the values match.
          </p>

          <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <SideCapture
              label='Front'
              previewUrl={scan?.frontUrl ?? null}
              disabled={isSaving}
              onFile={(file) => void uploadSide('front', file)}
            />
            <SideCapture
              label='Back'
              previewUrl={scan?.backUrl ?? null}
              disabled={isSaving}
              onFile={(file) => void uploadSide('back', file)}
            />
          </div>

          {isLoading && !scan ? (
            <p className='mt-4 text-sm text-gray-500 dark:text-gray-400'>Loading your license…</p>
          ) : null}

          {scan?.hasBack && scan.barcodeStatus === 'failed' ? (
            <p className='mt-4 text-sm text-dark-amber'>
              The barcode did not read. Type the fields from the card, or take the back again in even light.
            </p>
          ) : null}

          {scan?.hasFront && scan.hasBack ? (
            <fieldset className='mt-4 space-y-3' disabled={isSaving}>
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
              <Button onClick={() => void onConfirm()} isLoading={isSaving}>
                {scan.status === 'complete' ? 'Save license on file' : 'Put this license on file'}
              </Button>
            </fieldset>
          ) : null}

          {error ? <p className='mt-3 text-sm text-red-600 dark:text-red-400'>{error}</p> : null}

          {filled.length > 0 ? (
            <p className='mt-3 text-sm text-gray-600 dark:text-gray-400'>
              Filled empty fields: {filled.join(', ')}. This is on file, not a verified record.
            </p>
          ) : null}
        </BlockCard>
      </HubSectionPanel>
    </div>
  )
}

/**
 * Phones and tablets get the rear-camera hint. Computers do not: `capture`
 * there can hide the file picker, and a laptop photo is often a webcam shot
 * or a picture already saved.
 */
function usePrefersRearCamera(): boolean {
  const [coarsePointer, setCoarsePointer] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarsePointer(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return coarsePointer
}

function splitCodes(codes: string[]): string[] {
  return codes.flatMap((code) => code.split(/[^A-Za-z0-9]+/)).map((code) => code.trim().toUpperCase()).filter(Boolean)
}

function SideCapture({
  label,
  previewUrl,
  disabled,
  onFile,
}: {
  label: string
  previewUrl: string | null
  disabled: boolean
  onFile: (file: File) => void
}) {
  const rearCamera = usePrefersRearCamera()

  return (
    <label className='flex cursor-pointer flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800'>
      <span className='flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100'>
        <Camera className='h-4 w-4 text-teal-600 dark:text-teal-400' />
        {label}
      </span>
      {previewUrl ? (
        // Signed URL from our storage. Next image optimization is unnecessary for a one-off preview.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={`${label} of license`} className='h-28 w-full rounded-lg object-cover' />
      ) : (
        <span className='flex h-28 items-center justify-center px-3 text-center text-xs text-gray-500 dark:text-gray-400'>
          Take a photo or choose one
        </span>
      )}
      <input
        type='file'
        accept='image/*'
        // Rear camera on a phone (iOS or Android). Left off on a computer so
        // the dialog can offer the webcam or a photo already on disk.
        capture={rearCamera ? 'environment' : undefined}
        disabled={disabled}
        className='sr-only'
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
    </label>
  )
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
