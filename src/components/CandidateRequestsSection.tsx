'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import Modal, { ModalHeader } from './ui/Modal'
import {
  Inbox,
  Building2,
  FileText,
  Car,
  ClipboardCheck,
  MessageSquare,
  UserCheck,
  Loader2,
  AlertCircle,
  Check,
  X,
  ChevronRight,
  Clock,
  ExternalLink,
  Shield,
  Code2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getBlockDefinition } from '@/lib/block-registry'
import BackgroundCheckDisclosure from '@/components/BackgroundCheckDisclosure'
import PspDisclosureForm from '@/components/PspDisclosureForm'
import MessagingButton from '@/components/messaging/MessagingButton'
import BlockCard from '@/components/ui/BlockCard'
import VaultHorizontalVaultShell from '@/components/ui/VaultHorizontalVaultShell'
import { useUIStore } from '@/stores'
interface CandidateRequest {
  id: string
  requestType:
    | 'mvr_order'
    | 'psp_order'
    | 'document_upload'
    | 'verification'
    | 'profile_completion'
    | 'custom'
    | 'block_request'
  documentType?: string | null
  targetBlockType?: string | null
  message?: string | null
  status: 'pending' | 'viewed' | 'completed' | 'declined' | 'expired' | 'cancelled'
  completedAt?: string | null
  expiresAt?: string | null
  createdAt: string
  company: {
    id: string
    name: string
    logo_url?: string | null
    ownerUserId?: string | null
  } | null
  consentId?: string | null
}

interface CandidateRequestsSectionProps {
  userAddress: string | null
  /** Pass requested block id (e.g. driver-resume vs developer-resume) so the correct builder opens */
  onNavigateToResume?: (targetBlockType?: string | null) => void
  onNavigateToDotApp?: () => void
}

const REQUEST_TYPE_CONFIG = {
  mvr_order: {
    icon: Shield,
    label: 'Background Check Request',
    description: 'This employer is requesting your authorization to run a background check & MVR',
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
  },
  psp_order: {
    icon: Shield,
    label: 'Background Check & PSP Request',
    description: 'This employer is requesting your authorization before ordering an FMCSA PSP report',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  document_upload: {
    icon: FileText,
    label: 'Resume Request',
    description: 'This employer is requesting your resume',
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
  },
  verification: {
    icon: ClipboardCheck,
    label: 'Verification Request',
    description: 'This employer wants to verify your employment history',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  profile_completion: {
    icon: UserCheck,
    label: 'DOT Application Request',
    description: 'This employer is requesting you complete your DOT Driver Application',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  custom: {
    icon: MessageSquare,
    label: 'Request',
    description: 'This employer has a message for you',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
  },
}

type RequestVisualConfig = {
  icon: LucideIcon
  label: string
  description: string
  color: string
  bgColor: string
}

/** Unknown `request_type` from DB or bad data — same as `custom`, explicit alias for fallbacks */
const DEFAULT_REQUEST_VISUAL: RequestVisualConfig = REQUEST_TYPE_CONFIG.custom

const STATUS_CONFIG = {
  pending: { label: 'New', color: 'bg-blue-500 text-white' },
  viewed: { label: 'Viewed', color: 'bg-gray-500 text-white' },
  completed: { label: 'Completed', color: 'bg-green-500 text-white' },
  declined: { label: 'Declined', color: 'bg-red-500 text-white' },
  expired: { label: 'Expired', color: 'bg-gray-400 text-white' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-400 text-white' },
}

/** MVR / general FCRA disclosure (BackgroundCheckDisclosure). */
function isMvrBgcheckConsentFlow(request: Pick<CandidateRequest, 'requestType' | 'targetBlockType'>): boolean {
  return (
    request.requestType === 'mvr_order' ||
    (request.requestType === 'block_request' && request.targetBlockType === 'driver-mvr')
  )
}

/** FMCSA PSP standalone disclosure (PspDisclosureForm). */
function isPspFmcsaConsentFlow(request: Pick<CandidateRequest, 'requestType' | 'targetBlockType'>): boolean {
  return (
    request.requestType === 'psp_order' ||
    (request.requestType === 'block_request' && request.targetBlockType === 'driver-psp')
  )
}

/** Registry-backed label for `block_request`; falls back so new API types never crash the UI */
function getRequestVisualConfig(request: CandidateRequest): RequestVisualConfig {
  if (!request?.requestType || typeof request.requestType !== 'string') {
    return DEFAULT_REQUEST_VISUAL
  }

  if (isPspFmcsaConsentFlow(request)) {
    return REQUEST_TYPE_CONFIG.psp_order ?? DEFAULT_REQUEST_VISUAL
  }
  if (isMvrBgcheckConsentFlow(request)) {
    return REQUEST_TYPE_CONFIG.mvr_order ?? DEFAULT_REQUEST_VISUAL
  }

  if (request.requestType === 'block_request') {
    const def = request.targetBlockType ? getBlockDefinition(request.targetBlockType) : undefined
    let icon: LucideIcon = MessageSquare
    if (def?.categoryId === 'drivers') icon = Car
    else if (def?.categoryId === 'developers') icon = Code2
    else if (def?.categoryId === 'general') icon = FileText

    return {
      icon,
      label: def?.requestLabel ? `Request: ${def.requestLabel}` : 'Employer block request',
      description:
        def?.description ??
        'This employer is asking you to add or complete something on your career card.',
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10',
    }
  }

  const base = REQUEST_TYPE_CONFIG[request.requestType as keyof typeof REQUEST_TYPE_CONFIG]
  if (base?.icon) return base

  return DEFAULT_REQUEST_VISUAL
}

function getStatusRowConfig(status: CandidateRequest['status']) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
}

export default function CandidateRequestsSection({
  userAddress,
  onNavigateToResume,
  onNavigateToDotApp,
}: CandidateRequestsSectionProps) {
  const { theme } = useTheme()
  const { navigateToMessages } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<CandidateRequest[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [selectedRequest, setSelectedRequest] = useState<CandidateRequest | null>(null)
  const [updating, setUpdating] = useState(false)
  /** Which standalone legal form is open from the request detail modal */
  const [disclosureModal, setDisclosureModal] = useState<null | 'mvr' | 'psp'>(null)
  const [viewingConsent, setViewingConsent] = useState<{
    mode: 'mvr' | 'psp'
    requestId: string
    consentId: string
    companyName: string
  } | null>(null)

  const fetchRequests = useCallback(async () => {
    if (!userAddress) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/candidate/requests', {
        headers: { 'x-wallet-address': userAddress },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch requests')
      }

      const data = await response.json()
      setRequests(data.requests || [])
      setPendingCount(data.pendingCount || 0)
    } catch (err) {
      console.error('Error fetching candidate requests:', err)
      setError('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const updateRequestStatus = async (requestId: string, status: 'completed' | 'declined') => {
    if (!userAddress) return

    try {
      setUpdating(true)
      const response = await fetch(`/api/candidate/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error('Failed to update request')
      }

      // Refresh the list
      await fetchRequests()
      setSelectedRequest(null)
    } catch (err) {
      console.error('Error updating request:', err)
      alert('Failed to update request. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false
    const daysUntilExpiry = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }

  const isDark = isDarkTheme(theme)

  const cardClass = isDark
    ? 'bg-gray-900/40 border-indigo-500/20 hover:border-indigo-400/35'
    : 'bg-slate-50/90 border-indigo-200/70 hover:border-indigo-300'

  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600'

  if (loading) {
    return (
      <VaultHorizontalVaultShell isDark={isDark} layout='panel' accent='indigo' contentClassName='p-6'>
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='w-6 h-6 animate-spin text-indigo-400' />
          <span className={`ml-2 ${textSecondary}`}>Loading requests...</span>
        </div>
      </VaultHorizontalVaultShell>
    )
  }

  if (error) {
    return (
      <VaultHorizontalVaultShell isDark={isDark} layout='panel' accent='indigo' contentClassName='p-6'>
        <div className='flex items-center gap-2 text-red-500'>
          <AlertCircle className='w-5 h-5' />
          <span>{error}</span>
        </div>
      </VaultHorizontalVaultShell>
    )
  }

  // Active requests (pending, viewed) shown first
  const activeRequests = requests.filter(r => ['pending', 'viewed'].includes(r.status))
  const completedRequests = requests.filter(r => !['pending', 'viewed'].includes(r.status))

  return (
    <>
    <VaultHorizontalVaultShell isDark={isDark} layout='panel' accent='indigo' contentClassName='p-4 sm:p-5 lg:p-6'>
      <BlockCard
        variant='embed'
        icon={Inbox}
        title='Employer requests'
        description={
          pendingCount > 0
            ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}`
            : 'No pending requests — when employers reach out, they appear here.'
        }
        headerActions={
          pendingCount > 0 ? (
            <span className='px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500 text-white dark:bg-indigo-400 dark:text-gray-900 shrink-0'>
              {pendingCount} new
            </span>
          ) : null
        }
      >
        {requests.length === 0 ? (
          <div className='text-center py-8'>
            <Inbox className={`w-12 h-12 mx-auto mb-3 ${textSecondary}`} />
            <p className={textPrimary}>No requests yet</p>
            <p className={`text-sm ${textSecondary}`}>
              When employers are interested in you, their requests will appear here
            </p>
          </div>
        ) : (
          <div className='space-y-4'>
            {/* Active Requests */}
            {activeRequests.length > 0 && (
              <div className='space-y-3'>
                {activeRequests.map(request => {
                  const config = getRequestVisualConfig(request)
                  const statusConfig = getStatusRowConfig(request.status)
                  const Icon = config.icon

                  return (
                    <div
                      key={request.id}
                      onClick={() => setSelectedRequest(request)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all ${cardClass}`}
                    >
                      <div className='flex items-start gap-4'>
                        <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 mb-1'>
                            <span className={`font-medium ${textPrimary}`}>
                              {config.label}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            {isExpiringSoon(request.expiresAt) && (
                              <span className='px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/20 text-amber-600'>
                                Expires soon
                              </span>
                            )}
                          </div>
                          <div className='flex items-center gap-1.5 mb-2'>
                            <Building2 className={`w-3.5 h-3.5 ${textSecondary}`} />
                            <span className={`text-sm ${textSecondary}`}>
                              {request.company?.name || 'Unknown Company'}
                            </span>
                          </div>
                          {request.documentType && (
                            <p className={`text-sm ${textSecondary}`}>
                              Requested: <span className='font-medium'>{request.documentType}</span>
                            </p>
                          )}
                          {request.message && (
                            <p className={`text-sm ${textSecondary} line-clamp-2`}>
                              "{request.message}"
                            </p>
                          )}
                          <p className={`text-xs mt-2 ${textSecondary}`}>
                            <Clock className='w-3 h-3 inline mr-1' />
                            {formatDate(request.createdAt)}
                          </p>
                        </div>
                        <ChevronRight className={`w-5 h-5 ${textSecondary}`} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Completed/Past Requests */}
            {completedRequests.length > 0 && (
              <div className='mt-6'>
                <h3 className={`text-sm font-medium mb-3 ${textSecondary}`}>
                  Past Requests
                </h3>
                <div className='space-y-2'>
                  {completedRequests.slice(0, 5).map(request => {
                    const config = getRequestVisualConfig(request)
                    const statusConfig = getStatusRowConfig(request.status)
                    const canViewConsent =
                      (isMvrBgcheckConsentFlow(request) || isPspFmcsaConsentFlow(request)) && request.consentId

                    return (
                      <div
                        key={request.id}
                        className={`rounded-lg border p-3 ${canViewConsent ? '' : 'opacity-75'} ${cardClass}`}
                      >
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-3'>
                            <span className={`text-sm ${textPrimary}`}>
                              {config.label}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className='flex items-center gap-2'>
                            <span className={`text-xs ${textSecondary}`}>
                              {request.company?.name}
                            </span>
                            {canViewConsent && (
                              <button
                                onClick={() =>
                                  setViewingConsent({
                                    mode:
                                      request.requestType === 'psp_order' ||
                                      (request.requestType === 'block_request' &&
                                        request.targetBlockType === 'driver-psp')
                                        ? 'psp'
                                        : 'mvr',
                                    requestId: request.id,
                                    consentId: request.consentId!,
                                    companyName: request.company?.name || 'the employer',
                                  })
                                }
                                className='flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 transition-colors'
                              >
                                <FileText className='w-3 h-3' />
                                View
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </BlockCard>
    </VaultHorizontalVaultShell>

      {/* Request Detail Modal */}
    {selectedRequest && (
        <Modal onClose={() => setSelectedRequest(null)} maxWidth="max-w-lg">
            {/* Modal Header */}
            <div className='p-6 border-b border-inherit'>
                <div className='flex items-start justify-between'>
                <div className='flex items-center gap-3'>
                  {(() => {
                    const detailConfig = getRequestVisualConfig(selectedRequest)
                    const Icon = detailConfig.icon
                    return (
                      <div className={`p-3 rounded-xl ${detailConfig.bgColor}`}>
                        <Icon className={`w-6 h-6 ${detailConfig.color}`} />
                      </div>
                    )
                  })()}
                  <div>
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>
                      {getRequestVisualConfig(selectedRequest).label}
                    </h3>
                    <p className={`text-sm ${textSecondary}`}>
                      from {selectedRequest.company?.name || 'Unknown Company'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${textSecondary}`}
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className='p-6 space-y-4'>
              <p className={textSecondary}>
                {getRequestVisualConfig(selectedRequest).description}
              </p>

              {selectedRequest.documentType && (
                <div className={`p-4 rounded-xl ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <p className={`text-sm font-medium ${textPrimary}`}>
                    Document Requested
                  </p>
                  <p className={`text-sm ${textSecondary}`}>
                    {selectedRequest.documentType}
                  </p>
                </div>
              )}

              {selectedRequest.message && (
                <div className={`p-4 rounded-xl ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <p className={`text-sm font-medium mb-2 ${textPrimary}`}>
                    Message from employer
                  </p>
                  <p className={`text-sm italic ${textSecondary}`}>
                    "{selectedRequest.message}"
                  </p>
                </div>
              )}

              {isMvrBgcheckConsentFlow(selectedRequest) && (
                <div className={`p-4 rounded-xl border ${isDarkTheme(theme) ? 'border-teal-500/30 bg-teal-500/10' : 'border-teal-200 bg-teal-50'}`}>
                  <p className={`text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-teal-300' : 'text-teal-800'}`}>
                    Your rights are protected
                  </p>
                  <p className={`text-sm ${isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-700'}`}>
                    Under the Fair Credit Reporting Act (FCRA), you must review and sign a Background Check Disclosure before this employer can order a report. Click "Review & Sign Disclosure" to read the full form and authorize.
                  </p>
                </div>
              )}

              {isPspFmcsaConsentFlow(selectedRequest) && (
                <div className={`p-4 rounded-xl border ${isDarkTheme(theme) ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-200 bg-amber-50'}`}>
                  <p className={`text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-amber-200' : 'text-amber-900'}`}>
                    FMCSA PSP authorization required
                  </p>
                  <p className={`text-sm ${isDarkTheme(theme) ? 'text-amber-100/90' : 'text-amber-900/90'}`}>
                    Before this employer can order your Pre-Employment Screening Program (PSP) report, you must review and sign the federal PSP Disclosure & Authorization form exactly as provided by FMCSA. This is a separate stand-alone document.
                  </p>
                </div>
              )}

              {selectedRequest.expiresAt && (
                <p className={`text-sm ${textSecondary}`}>
                  <Clock className='w-4 h-4 inline mr-1' />
                  Expires {formatDate(selectedRequest.expiresAt)}
                </p>
              )}
            </div>

            {/* Modal Actions */}
            {['pending', 'viewed'].includes(selectedRequest.status) && (
              <div className='p-6 border-t border-inherit'>
                <div className='flex gap-3'>
                  {(selectedRequest.requestType === 'document_upload' ||
                    (selectedRequest.requestType === 'block_request' &&
                      !isMvrBgcheckConsentFlow(selectedRequest) &&
                      !isPspFmcsaConsentFlow(selectedRequest))) &&
                    onNavigateToResume && (
                    <button
                      type='button'
                      onClick={() => {
                        onNavigateToResume(selectedRequest.targetBlockType ?? null)
                        setSelectedRequest(null)
                      }}
                      className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors'
                    >
                      <ExternalLink className='w-4 h-4' />
                      {selectedRequest.requestType === 'document_upload'
                        ? 'Go to Resume'
                        : (() => {
                            const rl =
                              selectedRequest.targetBlockType &&
                              getBlockDefinition(selectedRequest.targetBlockType)?.requestLabel
                            return rl ? `Open ${rl}` : 'Open requested block'
                          })()}
                    </button>
                  )}
                  
                  {selectedRequest.requestType === 'profile_completion' && onNavigateToDotApp && (
                    <button
                      onClick={() => {
                        onNavigateToDotApp()
                        setSelectedRequest(null)
                      }}
                      className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors'
                    >
                      <ExternalLink className='w-4 h-4' />
                      Start DOT Application
                    </button>
                  )}

                  {isMvrBgcheckConsentFlow(selectedRequest) && (
                    <button
                      type='button'
                      onClick={() => setDisclosureModal('mvr')}
                      className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors'
                    >
                      <Shield className='w-4 h-4' />
                      Review & Sign Disclosure
                    </button>
                  )}

                  {isPspFmcsaConsentFlow(selectedRequest) && (
                    <button
                      type='button'
                      onClick={() => setDisclosureModal('psp')}
                      className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors'
                    >
                      <Shield className='w-4 h-4' />
                      Review & Sign FMCSA PSP Form
                    </button>
                  )}

                  {(selectedRequest.requestType === 'verification' ||
                    selectedRequest.requestType === 'custom' ||
                    (selectedRequest.requestType === 'block_request' &&
                      !selectedRequest.targetBlockType &&
                      !isMvrBgcheckConsentFlow(selectedRequest) &&
                      !isPspFmcsaConsentFlow(selectedRequest))) && (
                    <button
                      type='button'
                      onClick={() => updateRequestStatus(selectedRequest.id, 'completed')}
                      disabled={updating}
                      className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50'
                    >
                      {updating ? (
                        <Loader2 className='w-4 h-4 animate-spin' />
                      ) : (
                        <Check className='w-4 h-4' />
                      )}
                      Mark Complete
                    </button>
                  )}

                  <button
                    onClick={() => updateRequestStatus(selectedRequest.id, 'declined')}
                    disabled={updating}
                    className={`px-4 py-2.5 rounded-xl border transition-colors ${
                      isDarkTheme(theme)
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Decline
                  </button>

                  {selectedRequest.company?.ownerUserId && userAddress && (
                    <MessagingButton
                      otherUserId={selectedRequest.company.ownerUserId}
                      candidateRequestId={selectedRequest.id}
                      subject={`Re: ${getRequestVisualConfig(selectedRequest).label} from ${selectedRequest.company?.name ?? 'employer'}`}
                      walletAddress={userAddress}
                      onThreadOpen={(threadId) => {
                        setSelectedRequest(null)
                        navigateToMessages(threadId)
                      }}
                      variant='button'
                    />
                  )}
                </div>
              </div>
            )}
        </Modal>
      )}

      {/* Full-screen FCRA disclosure form — shown when driver opens an MVR request */}
      {disclosureModal === 'mvr' && selectedRequest && (
        <BackgroundCheckDisclosure
          requestId={selectedRequest.id}
          companyName={selectedRequest.company?.name || 'the employer'}
          userAddress={userAddress || ''}
          onClose={() => setDisclosureModal(null)}
          onConsentSigned={async () => {
            setDisclosureModal(null)
            setSelectedRequest(null)
            await fetchRequests()
          }}
        />
      )}

      {disclosureModal === 'psp' && selectedRequest && (
        <PspDisclosureForm
          requestId={selectedRequest.id}
          companyName={selectedRequest.company?.name || 'the employer'}
          userAddress={userAddress || ''}
          onClose={() => setDisclosureModal(null)}
          onConsentSigned={async () => {
            setDisclosureModal(null)
            setSelectedRequest(null)
            await fetchRequests()
          }}
        />
      )}

      {viewingConsent?.mode === 'mvr' && (
        <BackgroundCheckDisclosure
          requestId={viewingConsent.requestId}
          companyName={viewingConsent.companyName}
          userAddress={userAddress || ''}
          onClose={() => setViewingConsent(null)}
          onConsentSigned={() => setViewingConsent(null)}
          viewMode
          consentId={viewingConsent.consentId}
        />
      )}

      {viewingConsent?.mode === 'psp' && (
        <PspDisclosureForm
          requestId={viewingConsent.requestId}
          companyName={viewingConsent.companyName}
          userAddress={userAddress || ''}
          onClose={() => setViewingConsent(null)}
          onConsentSigned={() => setViewingConsent(null)}
          viewMode
          consentId={viewingConsent.consentId}
        />
      )}
    </>
  )
}
