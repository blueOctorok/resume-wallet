'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, FileCheck, Loader2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import BackgroundCheckDisclosure from '@/components/BackgroundCheckDisclosure'
import PspDisclosureForm from '@/components/PspDisclosureForm'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import { cn } from '@/lib/utils'

type ConsentTab = 'fcra' | 'psp' | 'cdlis'

interface PresetConsent {
  signedName: string
  signedAt: string | null
  companyName: string
  formData: Record<string, string>
  formVersion?: string | null
}

interface EmployerConsentPackageResponse {
  success: true
  bundle: {
    id: string
    status: string
    completedAt: string | null
    createdAt: string
    candidateName: string | null
  }
  fcra: Omit<PresetConsent, 'formVersion'> | null
  psp: PresetConsent | null
  cdlis: {
    signedName: string | null
    signedAt: string | null
    formData: Record<string, string>
  } | null
}

interface EmployerConsentPackageModalProps {
  bundleId: string
  candidateName: string
  onClose: () => void
}

export default function EmployerConsentPackageModal({
  bundleId,
  candidateName,
  onClose,
}: EmployerConsentPackageModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<EmployerConsentPackageResponse | null>(null)
  const [activeTab, setActiveTab] = useState<ConsentTab>('fcra')

  const availableTabs = useMemo(() => {
    if (!data) return [] as ConsentTab[]
    const tabs: ConsentTab[] = []
    if (data.fcra) tabs.push('fcra')
    if (data.psp) tabs.push('psp')
    if (data.cdlis) tabs.push('cdlis')
    return tabs
  }, [data])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/employer/screenings/consent/${bundleId}`)
        const json = (await res.json()) as EmployerConsentPackageResponse | { error: string }
        if (!res.ok || !('success' in json)) {
          throw new Error('error' in json ? json.error : 'Failed to load consent package')
        }
        if (cancelled) return
        setData(json)
        const first: ConsentTab | undefined = json.fcra ? 'fcra' : json.psp ? 'psp' : json.cdlis ? 'cdlis' : undefined
        if (first) setActiveTab(first)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load consent package')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bundleId])

  const tabLabel: Record<ConsentTab, string> = {
    fcra: 'FCRA',
    psp: 'FMCSA PSP',
    cdlis: 'CDLIS',
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-5xl" zIndex={1150}>
      <ModalHeader
        title="Signed consent package"
        subtitle={candidateName}
        onClose={onClose}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className={cn('h-6 w-6 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
        </div>
      ) : error ? (
        <div
          className={cn(
            'mx-4 mb-4 rounded-lg border px-4 py-3 text-sm sm:mx-5',
            isDark ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700',
          )}
        >
          {error}
        </div>
      ) : data ? (
        <div className="flex min-h-0 flex-col">
          {availableTabs.length > 1 && (
            <div
              className={cn(
                'flex flex-wrap gap-2 border-b px-4 py-3 sm:px-5',
                isDark ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50',
              )}
            >
              {availableTabs.map((tab) => (
                <Button
                  key={tab}
                  type="button"
                  size="sm"
                  variant={activeTab === tab ? 'primary' : 'secondary'}
                  onClick={() => setActiveTab(tab)}
                >
                  {tabLabel[tab]}
                </Button>
              ))}
            </div>
          )}

          <div className="max-h-[min(75vh,40rem)] overflow-y-auto">
            {activeTab === 'fcra' && data.fcra && (
              <BackgroundCheckDisclosure
                requestId=""
                companyName={data.fcra.companyName}
                userAddress=""
                onClose={onClose}
                onConsentSigned={() => {}}
                viewMode
                renderInline
                presetConsent={data.fcra}
              />
            )}

            {activeTab === 'psp' && data.psp && (
              <PspDisclosureForm
                userAddress=""
                companyName={data.psp.companyName}
                onClose={onClose}
                onConsentSigned={() => {}}
                viewMode
                renderInline
                presetConsent={data.psp}
              />
            )}

            {activeTab === 'cdlis' && data.cdlis && (
              <CdlisConsentReadOnly cdlis={data.cdlis} isDark={isDark} />
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function CdlisConsentReadOnly({
  cdlis,
  isDark,
}: {
  cdlis: NonNullable<EmployerConsentPackageResponse['cdlis']>
  isDark: boolean
}) {
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'

  const typedSignature = cdlis.formData.typedSignature ?? cdlis.signedName ?? ''
  const printFirstName = cdlis.formData.printFirstName ?? ''
  const printLastName = cdlis.formData.printLastName ?? ''
  const consentDateIso = cdlis.formData.consentDateIso ?? cdlis.signedAt ?? ''

  return (
    <div className={cn('p-4 sm:p-6', isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-100 text-gray-900')}>
      <div className="mx-auto max-w-3xl rounded-2xl bg-white text-gray-900 shadow-xl dark:bg-gray-900 dark:text-gray-100">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5 text-white">
          <div className="mb-1 flex items-center gap-2">
            <FileCheck className="h-5 w-5" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-widest opacity-90">Storm Verified Document</span>
          </div>
          <h2 className="text-xl font-bold">CDLIS Written Consent</h2>
          <p className="mt-1 text-sm opacity-90">Commercial Driver&apos;s License Information System authorization</p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            The applicant authorized release of commercial driver&apos;s license information from the Commercial
            Driver&apos;s License Information System (CDLIS) for employment screening purposes, as required for motor
            carrier background checks.
          </p>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Printed first name" value={printFirstName} />
              <Field label="Printed last name" value={printLastName} />
              <Field label="Consent date" value={consentDateIso ? fmtDate(consentDateIso) : '—'} />
              <Field label="Signed at (UTC)" value={cdlis.signedAt ? fmtDate(cdlis.signedAt) : '—'} />
            </dl>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800/50 dark:bg-green-950/30">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden />
              <span className="font-semibold text-green-800 dark:text-green-200">Authorization signed</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Typed signature</p>
            <p className="text-xl text-gray-900 dark:text-gray-100" style={{ fontFamily: 'cursive' }}>
              {typedSignature || '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">{value || '—'}</dd>
    </div>
  )
}
