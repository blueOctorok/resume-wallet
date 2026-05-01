'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import Button from '@/components/ui/Button'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import VerificationStatusBadge from './VerificationStatusBadge'
import {
  VerificationRequest,
  VerificationStatus,
} from '@/types/employment-verification'
import {
  findApplicantVerificationForRow,
  type CandidateEmploymentRow,
} from '@/lib/candidate-employment-verification'
import {
  ClipboardCheck,
  Building2,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
  Trash2,
  Mail,
  Phone,
  RefreshCw,
} from 'lucide-react'

interface CandidateEmploymentVerificationSectionProps {
  userAddress: string | null
}

/**
 * Composable hub: merged work history (driver/DOT block, developer profile, general resume)
 * with optional email to past employers to confirm dates — not a DOT-regulated investigation.
 */
export default function CandidateEmploymentVerificationSection({
  userAddress,
}: CandidateEmploymentVerificationSectionProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employments, setEmployments] = useState<CandidateEmploymentRow[]>([])
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([])
  const [initiatingKey, setInitiatingKey] = useState<string | null>(null)
  const [showContactModal, setShowContactModal] = useState<CandidateEmploymentRow | null>(null)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<CandidateEmploymentRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!userAddress) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const verificationRes = await fetch(
        '/api/candidate/verification/status?initiatedBy=applicant',
        { headers: { 'x-wallet-address': userAddress } },
      )
      if (verificationRes.ok) {
        const data = await verificationRes.json()
        setEmployments(data.employments ?? [])
        setVerificationRequests(data.requests ?? [])
      } else {
        setError('Failed to load employment verification')
      }
    } catch (err) {
      console.error('Error fetching candidate verification data:', err)
      setError('Failed to load employment history')
    } finally {
      setLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getVerificationForRow = (row: CandidateEmploymentRow) =>
    findApplicantVerificationForRow(verificationRequests, row)

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
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          verificationKey: row.verificationKey,
          previousEmployerEmail: overrideEmail ?? row.supervisorEmail,
          previousEmployerPhone: overridePhone ?? row.supervisorPhone,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        fetchData()
        setShowContactModal(null)
        setContactEmail('')
        setContactPhone('')
      } else if (data.needsContactInfo) {
        setShowContactModal(row)
      } else {
        console.error('[Candidate verification] Initiate failed:', response.status, data)
        alert(data.error ?? 'Failed to request verification')
      }
    } catch (err) {
      console.error('Error initiating verification:', err)
      alert('Failed to request verification')
    } finally {
      setInitiatingKey(null)
    }
  }

  const handleContactSubmit = () => {
    if (showContactModal && (contactEmail || contactPhone)) {
      initiateVerification(showContactModal, contactEmail, contactPhone)
    }
  }

  const removeDriverEmployment = async (row: CandidateEmploymentRow) => {
    if (!userAddress || row.source !== 'driver') return
    setDeletingId(row.id)
    try {
      const res = await fetch('/api/driver/profile/employment', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({ employmentId: row.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setDeleteConfirm(null)
        fetchData()
      } else {
        alert(data.error ?? 'Failed to remove employment')
      }
    } catch (err) {
      console.error('Error removing employment:', err)
      alert('Failed to remove employment')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Present'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          isDarkTheme(theme) ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className='flex items-center justify-center py-8'>
          <Loader2
            className={`w-6 h-6 animate-spin ${
              isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
            }`}
          />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          isDarkTheme(theme) ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'
        }`}
      >
        <div className='flex items-center gap-3'>
          <AlertCircle className='w-5 h-5 text-red-500' />
          <span className={isDarkTheme(theme) ? 'text-red-400' : 'text-red-600'}>{error}</span>
        </div>
      </div>
    )
  }

  if (employments.length === 0) {
    return (
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          isDarkTheme(theme) ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className='flex items-center gap-3 mb-4'>
          <div
            className={`p-2 rounded-lg ${isDarkTheme(theme) ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}
          >
            <ClipboardCheck
              className={`w-5 h-5 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'}`}
            />
          </div>
          <h3
            className={`font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
          >
            Employment verification
          </h3>
        </div>
        <p className={`text-sm mb-4 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
          We didn&apos;t find any jobs yet. Work history is pulled from your{' '}
          <strong className='font-medium'>driver resume</strong>,{' '}
          <strong className='font-medium'>developer resume</strong>,{' '}
          <strong className='font-medium'>general resume</strong>, and{' '}
          <strong className='font-medium'>DOT application</strong> (employment section). Add or
          update one of those, then come back to request a quick date confirmation from a past
          employer by email. They can ignore it — this is voluntary and not a formal DOT background
          investigation.
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
            <Loader2 className='w-4 h-4 animate-spin' />
          ) : (
            <ClipboardCheck className='w-4 h-4' />
          )}
          {refreshing ? 'Checking…' : 'Refresh work history'}
        </Button>
      </div>
    )
  }

  const verifiedCount = verificationRequests.filter(
    (r) => r.status === 'VERIFIED' || r.status === 'PARTIALLY_VERIFIED',
  ).length
  const pendingCount = verificationRequests.filter(
    (r) =>
      r.status === 'VERIFICATION_REQUESTED' || r.status === 'VERIFICATION_IN_PROGRESS',
  ).length
  const notRequestedCount = employments.filter((e) => !getVerificationForRow(e)).length

  return (
    <>
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          isDarkTheme(theme) ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className='flex items-center justify-between gap-3 mb-4'>
          <div className='flex items-center gap-3'>
            <div
              className={`p-2 rounded-lg ${isDarkTheme(theme) ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}
            >
              <ClipboardCheck
                className={`w-5 h-5 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'}`}
              />
            </div>
            <div>
              <h3
                className={`font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
              >
                Employment verification
              </h3>
              <p
                className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Optional: email past employers to confirm dates — builds trust on your career card
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => fetchData()}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors ${
              isDarkTheme(theme)
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title='Refresh'
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className='grid grid-cols-3 gap-2 mb-6'>
          <div
            className={`rounded-xl p-3 text-center ${
              isDarkTheme(theme) ? 'bg-green-900/20' : 'bg-green-50'
            }`}
          >
            <p
              className={`text-xl font-bold ${
                isDarkTheme(theme) ? 'text-green-300' : 'text-green-700'
              }`}
            >
              {verifiedCount}
            </p>
            <p className={`text-xs ${isDarkTheme(theme) ? 'text-green-400' : 'text-green-600'}`}>
              Verified
            </p>
          </div>
          <div
            className={`rounded-xl p-3 text-center ${
              isDarkTheme(theme) ? 'bg-yellow-900/20' : 'bg-yellow-50'
            }`}
          >
            <p
              className={`text-xl font-bold ${
                isDarkTheme(theme) ? 'text-yellow-300' : 'text-yellow-700'
              }`}
            >
              {pendingCount}
            </p>
            <p className={`text-xs ${isDarkTheme(theme) ? 'text-yellow-400' : 'text-yellow-600'}`}>
              Pending
            </p>
          </div>
          <div
            className={`rounded-xl p-3 text-center ${
              isDarkTheme(theme) ? 'bg-gray-800/50' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-xl font-bold ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {notRequestedCount}
            </p>
            <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
              Not requested
            </p>
          </div>
        </div>

        <div className='space-y-3'>
          {employments.map((row) => {
            const verification = getVerificationForRow(row)
            const status: VerificationStatus | 'NOT_REQUESTED' = verification?.status ?? 'NOT_REQUESTED'
            const isVerified = status === 'VERIFIED' || status === 'PARTIALLY_VERIFIED'
            const isPending =
              status === 'VERIFICATION_REQUESTED' || status === 'VERIFICATION_IN_PROGRESS'
            const canRequest =
              status === 'NOT_REQUESTED' ||
              status === 'ATTEMPTS_EXHAUSTED' ||
              status === 'VERIFICATION_DENIED' ||
              status === 'VERIFICATION_DECLINED'
            const isInitiating = initiatingKey === row.verificationKey

            return (
              <div
                key={row.verificationKey}
                className={`rounded-xl p-4 ${
                  isDarkTheme(theme)
                    ? 'bg-gray-800/50 border border-gray-700/50'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 mb-1'>
                      <Building2
                        className={`w-4 h-4 flex-shrink-0 ${
                          isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      />
                      <p
                        className={`font-medium truncate ${
                          isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {row.companyName}
                      </p>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isDarkTheme(theme) ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {row.sourceLabel}
                      </span>
                    </div>
                    <p
                      className={`text-sm mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {row.position}
                    </p>
                    <div className='flex items-center gap-1'>
                      <Calendar
                        className={`w-3 h-3 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}
                      />
                      <span
                        className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}
                      >
                        {formatDate(row.startDate)} – {formatDate(row.endDate)}
                      </span>
                    </div>
                    {verification?.verifiedAt && (
                      <p
                        className={`text-xs mt-1 ${
                          isDarkTheme(theme) ? 'text-green-400' : 'text-green-600'
                        }`}
                      >
                        Verified {formatDate(verification.verifiedAt)}
                      </p>
                    )}
                  </div>
                  <div className='flex-shrink-0 flex items-center gap-2'>
                    {isVerified && (
                      <div className='flex items-center gap-1 text-green-500'>
                        <CheckCircle2 className='w-5 h-5' />
                        <span className='text-xs font-medium'>Verified</span>
                      </div>
                    )}
                    {isPending && (
                      <VerificationStatusBadge
                        status={status as VerificationStatus}
                        size='sm'
                        theme={theme}
                      />
                    )}
                    {canRequest && (
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => initiateVerification(row)}
                        disabled={isInitiating}
                        className='inline-flex items-center gap-1'
                      >
                        {isInitiating ? (
                          <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                          <Send className='w-4 h-4' />
                        )}
                        Request
                      </Button>
                    )}
                    {row.source === 'driver' && (
                      <button
                        type='button'
                        onClick={() => setDeleteConfirm(row)}
                        disabled={deletingId === row.id}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDarkTheme(theme)
                            ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                            : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                        } disabled:opacity-50`}
                        title='Remove from driver employment list only'
                      >
                        {deletingId === row.id ? (
                          <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                          <Trash2 className='w-4 h-4' />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p
          className={`mt-4 text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}
        >
          Employers receive a simple link to confirm or correct dates. No response is required.
          This is separate from FMCSA-style investigations tied only to your DOT application flow.
        </p>
      </div>

      {showContactModal && (
        <Modal
          onClose={() => {
            setShowContactModal(null)
            setContactEmail('')
            setContactPhone('')
          }}
          maxWidth='max-w-md'
        >
          <ModalHeader
            title='Contact information needed'
            onClose={() => {
              setShowContactModal(null)
              setContactEmail('')
              setContactPhone('')
            }}
          />
          <div className='p-4 sm:p-6'>
            <p
              className={`text-sm mb-4 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
            >
              To reach out about your time at{' '}
              <strong>{showContactModal.companyName}</strong>, add an email or phone for someone who
              can confirm your dates (e.g. HR or supervisor).
            </p>
            <div className='space-y-4'>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  <Mail className='w-4 h-4 inline mr-1' />
                  Contact email
                </label>
                <input
                  type='email'
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder='supervisor@company.com'
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkTheme(theme)
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  <Phone className='w-4 h-4 inline mr-1' />
                  Contact phone (optional)
                </label>
                <PhoneInput
                  value={contactPhone}
                  onChange={setContactPhone}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkTheme(theme)
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
            </div>
            <div className='flex gap-3 mt-6'>
              <Button
                type='button'
                variant='secondary'
                className='flex-1'
                onClick={() => {
                  setShowContactModal(null)
                  setContactEmail('')
                  setContactPhone('')
                }}
              >
                Cancel
              </Button>
              <Button
                type='button'
                variant='primary'
                className='flex-1'
                onClick={handleContactSubmit}
                disabled={!contactEmail && !contactPhone}
              >
                Send request
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && deleteConfirm.source === 'driver' && (
        <Modal onClose={() => setDeleteConfirm(null)} maxWidth='max-w-md'>
          <ModalHeader title='Remove employment?' onClose={() => setDeleteConfirm(null)} />
          <div className='p-4 sm:p-6'>
            <p
              className={`text-sm mb-4 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Remove <strong>{deleteConfirm.companyName}</strong> from your{' '}
              <strong>driver employment</strong> list? This does not delete your DOT application or
              resumes — only the shared driver employment block row.
            </p>
            <div className='flex gap-3'>
              <Button
                type='button'
                variant='secondary'
                className='flex-1'
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                type='button'
                variant='danger'
                className='flex-1'
                onClick={() => removeDriverEmployment(deleteConfirm)}
                disabled={deletingId !== null}
              >
                {deletingId ? 'Removing…' : 'Remove'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
