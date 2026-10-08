'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, IdCard, Upload } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import Modal, { ModalHeader } from '@/components/ui/Modal'
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
  const [photoSide, setPhotoSide] = useState<'front' | 'back' | null>(null)

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
              onOpen={() => setPhotoSide('front')}
            />
            <SideCapture
              label='Back'
              previewUrl={scan?.backUrl ?? null}
              disabled={isSaving}
              onOpen={() => setPhotoSide('back')}
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
      {photoSide ? (
        <LicensePhotoModal
          side={photoSide}
          disabled={isSaving}
          onClose={() => setPhotoSide(null)}
          onFile={(file) => {
            const side = photoSide
            setPhotoSide(null)
            void uploadSide(side, file)
          }}
        />
      ) : null}
    </div>
  )
}

function splitCodes(codes: string[]): string[] {
  return codes.flatMap((code) => code.split(/[^A-Za-z0-9]+/)).map((code) => code.trim().toUpperCase()).filter(Boolean)
}

function SideCapture({
  label,
  previewUrl,
  disabled,
  onOpen,
}: {
  label: string
  previewUrl: string | null
  disabled: boolean
  onOpen: () => void
}) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onOpen}
      className='flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800'
    >
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
          Add a photo
        </span>
      )}
    </button>
  )
}

function LicensePhotoModal({
  side,
  disabled,
  onClose,
  onFile,
}: {
  side: 'front' | 'back'
  disabled: boolean
  onClose: () => void
  onFile: (file: File) => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const take = (file: File | undefined, input: HTMLInputElement) => {
    input.value = ''
    if (file) onFile(file)
  }

  return (
    <Modal onClose={onClose} maxWidth='max-w-md' panelShape='block'>
      <ModalHeader
        variant='block'
        title={side === 'front' ? 'Front of the license' : 'Back of the license'}
        subtitle='Use the camera, or choose a photo you already have.'
        onClose={onClose}
      />
      <div className='flex flex-col gap-3 p-4'>
        <Button onClick={() => cameraRef.current?.click()} disabled={disabled}>
          <Camera className='h-4 w-4' />
          Use camera
        </Button>
        <Button variant='secondary' onClick={() => fileRef.current?.click()} disabled={disabled}>
          <Upload className='h-4 w-4' />
          Upload a photo
        </Button>
        {/* capture opens the rear camera and asks the device for camera access.
            The upload input leaves capture off so a saved photo stays available. */}
        <input
          ref={cameraRef}
          type='file'
          accept='image/*'
          capture='environment'
          className='sr-only'
          onChange={(event) => take(event.target.files?.[0], event.target)}
        />
        <input
          ref={fileRef}
          type='file'
          accept='image/*'
          className='sr-only'
          onChange={(event) => take(event.target.files?.[0], event.target)}
        />
      </div>
    </Modal>
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
