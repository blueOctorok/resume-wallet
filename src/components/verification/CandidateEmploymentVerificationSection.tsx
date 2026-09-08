'use client'

import { useEffect, useState } from 'react'
import { useEmploymentVerificationBlockStore } from '@/stores/employment-verification-block-store'
import Button from '@/components/ui/Button'
import DriverAuthorizationForm from './DriverAuthorizationForm'
import SafetyPerformanceHistoryPaper from './SafetyPerformanceHistoryPaper'
import {
  findApplicantVerificationsForRow,
  isDkimVerifiedRequest,
  type CandidateEmploymentRow,
} from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'
import { AlertCircle, ClipboardCheck, Loader2, RefreshCw } from 'lucide-react'

interface CandidateEmploymentVerificationSectionProps {
  userAddress: string | null
  embedded?: boolean
}

function hasEmployerReply(request?: VerificationRequest): boolean {
  if (!request) return false
  return Boolean(
    request.answers ||
      request.status === 'VERIFIED' ||
      request.status === 'PARTIALLY_VERIFIED' ||
      request.status === 'VERIFICATION_DENIED',
  )
}

export default function CandidateEmploymentVerificationSection({
  userAddress,
  embedded = false,
}: CandidateEmploymentVerificationSectionProps) {
  const applicant = useEmploymentVerificationBlockStore((s) => s.applicant)
  const employments = useEmploymentVerificationBlockStore((s) => s.employments)
  const verificationRequests = useEmploymentVerificationBlockStore((s) => s.requests)
  const loading = useEmploymentVerificationBlockStore((s) => s.isLoading)
  const error = useEmploymentVerificationBlockStore((s) => s.error)
  const fetchData = useEmploymentVerificationBlockStore((s) => s.fetch)

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [initiatingKey, setInitiatingKey] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [savingReview, setSavingReview] = useState(false)

  useEffect(() => {
    if (userAddress) void fetchData()
  }, [userAddress, fetchData])

  useEffect(() => {
    if (!employments.length) {
      setSelectedKey(null)
      return
    }
    if (!selectedKey || !employments.some((e) => e.verificationKey === selectedKey)) {
      setSelectedKey(employments[0].verificationKey)
    }
  }, [employments, selectedKey])

  const selected = employments.find((e) => e.verificationKey === selectedKey) ?? null
  const packets = selected
    ? findApplicantVerificationsForRow(verificationRequests, selected)
    : []
  const request =
    packets.find((p) => p.id === selectedRequestId) ?? packets[0]

  useEffect(() => {
    if (request && request.id !== selectedRequestId) {
      setSelectedRequestId(request.id)
    }
    if (!packets.length && selectedRequestId) setSelectedRequestId(null)
  }, [request, packets.length, selectedRequestId])

  const initiateVerification = async (
    row: CandidateEmploymentRow,
    overrideEmail?: string,
    overridePhone?: string,
    correctionOf?: string,
  ) => {
    if (!userAddress) return
    setInitiatingKey(row.verificationKey)
    try {
      const response = await fetch('/api/candidate/verification/initiate-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationKey: row.verificationKey,
          previousEmployerEmail: overrideEmail ?? row.supervisorEmail,
          previousEmployerPhone: overridePhone ?? row.supervisorPhone,
          correctionOf,
        }),
      })
      const data = await response.json()
      if (response.ok) void fetchData()
      else alert(data.error ?? 'Failed to send packet')
    } catch (err) {
      console.error('Error initiating verification:', err)
      alert('Failed to send packet')
    } finally {
      setInitiatingKey(null)
    }
  }

  const resend = async (requestId: string) => {
    setInitiatingKey(requestId)
    try {
      const res = await fetch('/api/candidate/verification/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      })
      const data = await res.json()
      if (res.ok) void fetchData()
      else alert(data.error ?? 'Failed to resend')
    } catch {
      alert('Failed to resend')
    } finally {
      setInitiatingKey(null)
    }
  }

  const saveReview = async (
    requestId: string,
    patch: { shareConsent?: 'share' | 'hold'; hidden?: boolean; reviewed?: boolean },
  ) => {
    setSavingReview(true)
    try {
      const res = await fetch(`/api/candidate/verification/${requestId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (res.ok) void fetchData()
      else alert(data.error ?? 'Failed to save')
    } catch {
      alert('Failed to save')
    } finally {
      setSavingReview(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center py-10'>
        <Loader2 className='h-6 w-6 animate-spin text-[#173150]' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4'>
        <AlertCircle className='h-5 w-5 text-red-500' />
        <span className='text-sm text-red-700'>{error}</span>
      </div>
    )
  }

  if (employments.length === 0) {
    return (
      <div className='py-2'>
        <p className='mb-4 text-sm text-[#173150]/75'>
          No former employers to verify. Fill <strong className='font-medium'>DOT Form 3</strong>.
          Current jobs stay off this list unless you uncheck “do not contact.”
        </p>
        <Button
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => {
            setRefreshing(true)
            fetchData().finally(() => setRefreshing(false))
          }}
          disabled={refreshing}
          className='inline-flex items-center gap-2'
        >
          {refreshing ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <ClipboardCheck className='h-4 w-4' />
          )}
          {refreshing ? 'Checking…' : 'Refresh work history'}
        </Button>
      </div>
    )
  }

  const replied = hasEmployerReply(request)
  const sent = Boolean(request)
  const attempts = request?.attemptCount ?? 0
  const canResend =
    sent && !replied && attempts < 3 && request?.status !== 'ATTEMPTS_EXHAUSTED'

  return (
    <div className={embedded ? '' : 'rounded-xl border border-ironside/30 bg-[#fbf8f1] p-4 sm:p-6'}>
      <div className='mb-4 flex items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-wrap gap-2'>
          {employments.map((row) => {
            const reqs = findApplicantVerificationsForRow(verificationRequests, row)
            const latest = reqs[0]
            const dkim = isDkimVerifiedRequest(latest)
            const active = row.verificationKey === selectedKey
            return (
              <button
                key={row.verificationKey}
                type='button'
                onClick={() => {
                  setSelectedKey(row.verificationKey)
                  setSelectedRequestId(reqs[0]?.id ?? null)
                }}
                className={`rounded-lg border px-3 py-1.5 text-left text-xs font-medium ${
                  active
                    ? 'border-[#173150] bg-[#173150] text-[#fbf8f1]'
                    : 'border-ironside/35 bg-white text-[#173150]'
                }`}
              >
                {row.companyName}
                <span className={`mt-0.5 block text-[10px] ${active ? 'text-[#fbf8f1]/70' : 'text-ironside'}`}>
                  {dkim
                    ? 'DKIM verified'
                    : latest && hasEmployerReply(latest)
                      ? 'Returned — review'
                      : latest
                        ? `Sent ${latest.attemptCount || 1}/3`
                        : 'Needs send'}
                </span>
              </button>
            )
          })}
        </div>
        <button
          type='button'
          onClick={() => void fetchData()}
          disabled={loading}
          className='shrink-0 rounded-lg p-2 text-ironside hover:bg-white hover:text-[#173150] disabled:opacity-50'
          title='Refresh'
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {packets.length > 1 && (
        <div className='mb-4 flex flex-wrap gap-2'>
          {packets.map((p, i) => (
            <button
              key={p.id}
              type='button'
              onClick={() => setSelectedRequestId(p.id)}
              className={`rounded border px-2 py-1 text-[11px] ${
                p.id === request?.id
                  ? 'border-[#173150] bg-[#173150] text-[#fbf8f1]'
                  : 'border-ironside/35 bg-white text-[#173150]'
              }`}
            >
              {p.correctionOf ? 'Correction' : i === packets.length - 1 ? 'Original' : `Packet ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {selected && request?.driverHidden && (
        <div className='mb-4 flex items-center justify-between gap-3 rounded-lg border border-ironside/25 bg-white/70 px-3 py-2 text-xs text-[#173150]/75'>
          <span>This packet is hidden from your career card.</span>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            disabled={savingReview}
            onClick={() => saveReview(request.id, { hidden: false })}
          >
            Unhide
          </Button>
        </div>
      )}

      {selected && replied && request && !request.driverHidden && (
        <div className='mb-4 space-y-3 rounded-lg border border-[#173150]/15 bg-white/80 p-3 text-sm text-[#173150]'>
          <p>
            This packet came back. Review Employment Verification, safety history, and any drug
            and alcohol answers before sharing. If something is wrong, request a correction — the
            original stays on file.
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant={request.driverShareConsent === 'share' ? 'primary' : 'secondary'}
              size='sm'
              disabled={savingReview}
              onClick={() => saveReview(request.id, { shareConsent: 'share' })}
            >
              I agree to share
            </Button>
            <Button
              type='button'
              variant={request.driverShareConsent === 'hold' ? 'primary' : 'secondary'}
              size='sm'
              disabled={savingReview}
              onClick={() => saveReview(request.id, { shareConsent: 'hold' })}
            >
              Do not share
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={savingReview}
              onClick={() => saveReview(request.id, { hidden: true })}
            >
              Hide
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              disabled={initiatingKey !== null}
              onClick={() =>
                initiateVerification(
                  selected,
                  request.previousEmployerEmail ?? undefined,
                  request.previousEmployerPhone ?? undefined,
                  request.id,
                )
              }
            >
              Request correction
            </Button>
          </div>
          {request.driverShareConsent === 'share' && (
            <p className='text-xs text-[#173150]/60'>On your career card. Hide it anytime.</p>
          )}
          {request.driverShareConsent === 'hold' && (
            <p className='text-xs text-[#173150]/60'>Stored here only — not on the career card.</p>
          )}
        </div>
      )}

      {selected && sent && !replied && (
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#173150]/70'>
          <span>
            Sent {attempts}/3
            {request?.previousEmployerEmail ? ` to ${request.previousEmployerEmail}` : ''}.
            We send this packet at least three times if they do not reply.
          </span>
          {canResend && request && (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              disabled={initiatingKey !== null}
              onClick={() => resend(request.id)}
            >
              Send again ({3 - attempts} left)
            </Button>
          )}
        </div>
      )}

      {selected && (
        <div className='space-y-8'>
          <DriverAuthorizationForm
            applicant={applicant}
            employment={selected}
            sent={sent}
            sending={initiatingKey === selected.verificationKey}
            onSend={({ email, phone }) => initiateVerification(selected, email, phone)}
          />
          <SafetyPerformanceHistoryPaper
            applicant={applicant}
            employment={selected}
            request={request}
          />
        </div>
      )}
    </div>
  )
}
