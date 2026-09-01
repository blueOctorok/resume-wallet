'use client'

import { useEffect, useState } from 'react'
import { useEmploymentVerificationBlockStore } from '@/stores/employment-verification-block-store'
import Button from '@/components/ui/Button'
import SafetyPerformanceHistoryPaper from './SafetyPerformanceHistoryPaper'
import {
  findApplicantVerificationForRow,
  isDkimVerifiedRequest,
  type CandidateEmploymentRow,
} from '@/lib/candidate-employment-verification'
import { AlertCircle, ClipboardCheck, Loader2, RefreshCw } from 'lucide-react'

interface CandidateEmploymentVerificationSectionProps {
  userAddress: string | null
  /** Inside BlockCard — skip the second card chrome. */
  embedded?: boolean
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
  const [initiatingKey, setInitiatingKey] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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
  const request = selected
    ? findApplicantVerificationForRow(verificationRequests, selected)
    : undefined

  const initiateVerification = async (
    row: CandidateEmploymentRow,
    overrideEmail?: string,
    overridePhone?: string,
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
        }),
      })
      const data = await response.json()
      if (response.ok) {
        void fetchData()
      } else {
        alert(data.error ?? 'Failed to request verification')
      }
    } catch (err) {
      console.error('Error initiating verification:', err)
      alert('Failed to request verification')
    } finally {
      setInitiatingKey(null)
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
          No jobs on file yet. Fill <strong className='font-medium'>DOT Form 3</strong> (or a
          resume). Those employers appear here on the official § 391.23 form — still
          self-reported until a previous employer replies and DKIM passes.
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

  return (
    <div className={embedded ? '' : 'rounded-xl border border-ironside/30 bg-[#fbf8f1] p-4 sm:p-6'}>
      <div className='mb-4 flex items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-wrap gap-2'>
          {employments.map((row) => {
            const req = findApplicantVerificationForRow(verificationRequests, row)
            const dkim = isDkimVerifiedRequest(req)
            const active = row.verificationKey === selectedKey
            return (
              <button
                key={row.verificationKey}
                type='button'
                onClick={() => setSelectedKey(row.verificationKey)}
                className={`rounded-lg border px-3 py-1.5 text-left text-xs font-medium ${
                  active
                    ? 'border-[#173150] bg-[#173150] text-[#fbf8f1]'
                    : 'border-ironside/35 bg-white text-[#173150]'
                }`}
              >
                {row.companyName}
                <span className={`mt-0.5 block text-[10px] ${active ? 'text-[#fbf8f1]/70' : 'text-ironside'}`}>
                  {dkim ? 'DKIM verified' : req ? 'Sent' : 'On file'}
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

      {selected && (
        <SafetyPerformanceHistoryPaper
          applicant={applicant}
          employment={selected}
          request={request}
          sending={initiatingKey === selected.verificationKey}
          onSend={({ email, phone }) => initiateVerification(selected, email, phone)}
        />
      )}
    </div>
  )
}
