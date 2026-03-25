'use client'

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
} from 'lucide-react'
import BackgroundCheckDisclosure from '@/components/BackgroundCheckDisclosure'
import MessagingButton from '@/components/messaging/MessagingButton'
import { useUIStore } from '@/stores'
interface CandidateRequest {
  id: string
  requestType: 'mvr_order' | 'document_upload' | 'verification' | 'profile_completion' | 'custom'
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

const STATUS_CONFIG = {
  pending: { label: 'New', color: 'bg-blue-500 text-white' },
  viewed: { label: 'Viewed', color: 'bg-gray-500 text-white' },
  completed: { label: 'Completed', color: 'bg-green-500 text-white' },
  declined: { label: 'Declined', color: 'bg-red-500 text-white' },
  expired: { label: 'Expired', color: 'bg-gray-400 text-white' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-400 text-white' },
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
  // Controls whether the full-screen disclosure form is shown
  const [showDisclosure, setShowDisclosure] = useState(false)
  // Controls whether we're viewing a previously signed consent
  const [viewingConsent, setViewingConsent] = useState<{ requestId: string; consentId: string; companyName: string } | null>(null)

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

  // Style classes
  const containerClass = theme === 'dark'
    ? 'bg-gray-800/50 border-gray-700'
    : 'bg-white border-gray-200'
  
  const cardClass = theme === 'dark'
    ? 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
    : 'bg-gray-50 border-gray-200 hover:border-gray-300'

  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600'

  if (loading) {
    return (
      <div className={`rounded-2xl border p-6 ${containerClass}`}>
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='w-6 h-6 animate-spin text-teal-500' />
          <span className={`ml-2 ${textSecondary}`}>Loading requests...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-2xl border p-6 ${containerClass}`}>
        <div className='flex items-center gap-2 text-red-500'>
          <AlertCircle className='w-5 h-5' />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  // Active requests (pending, viewed) shown first
  const activeRequests = requests.filter(r => ['pending', 'viewed'].includes(r.status))
  const completedRequests = requests.filter(r => !['pending', 'viewed'].includes(r.status))

  return (
    <div className={`rounded-2xl border shadow-lg transition-all duration-200 ${containerClass}`}>
      {/* Header */}
      <div className='p-6 border-b border-inherit'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
              <Inbox className='w-5 h-5 text-teal-500' />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>
                Employer Requests
              </h2>
              <p className={`text-sm ${textSecondary}`}>
                {pendingCount > 0
                  ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}`
                  : 'No pending requests'}
              </p>
            </div>
          </div>
          {pendingCount > 0 && (
            <span className='px-3 py-1 text-sm font-medium rounded-full bg-teal-500 text-white'>
              {pendingCount} new
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className='p-6'>
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
                  const config = REQUEST_TYPE_CONFIG[request.requestType]
                  const statusConfig = STATUS_CONFIG[request.status]
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
                    const config = REQUEST_TYPE_CONFIG[request.requestType]
                    const statusConfig = STATUS_CONFIG[request.status]
                    const canViewConsent = request.requestType === 'mvr_order' && request.consentId

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
                                onClick={() => setViewingConsent({
                                  requestId: request.id,
                                  consentId: request.consentId!,
                                  companyName: request.company?.name || 'the employer',
                                })}
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
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <Modal onClose={() => setSelectedRequest(null)} maxWidth="max-w-lg">
            {/* Modal Header */}
            <div className='p-6 border-b border-inherit'>
              <div className='flex items-start justify-between'>
                <div className='flex items-center gap-3'>
                  {(() => {
                    const config = REQUEST_TYPE_CONFIG[selectedRequest.requestType]
                    const Icon = config.icon
                    return (
                      <div className={`p-3 rounded-xl ${config.bgColor}`}>
                        <Icon className={`w-6 h-6 ${config.color}`} />
                      </div>
                    )
                  })()}
                  <div>
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>
                      {REQUEST_TYPE_CONFIG[selectedRequest.requestType].label}
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
                {REQUEST_TYPE_CONFIG[selectedRequest.requestType].description}
              </p>

              {selectedRequest.documentType && (
                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <p className={`text-sm font-medium ${textPrimary}`}>
                    Document Requested
                  </p>
                  <p className={`text-sm ${textSecondary}`}>
                    {selectedRequest.documentType}
                  </p>
                </div>
              )}

              {selectedRequest.message && (
                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <p className={`text-sm font-medium mb-2 ${textPrimary}`}>
                    Message from employer
                  </p>
                  <p className={`text-sm italic ${textSecondary}`}>
                    "{selectedRequest.message}"
                  </p>
                </div>
              )}

              {selectedRequest.requestType === 'mvr_order' && (
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'border-teal-500/30 bg-teal-500/10' : 'border-teal-200 bg-teal-50'}`}>
                  <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-teal-300' : 'text-teal-800'}`}>
                    Your rights are protected
                  </p>
                  <p className={`text-sm ${theme === 'dark' ? 'text-teal-400' : 'text-teal-700'}`}>
                    Under the Fair Credit Reporting Act (FCRA), you must review and sign a Background Check Disclosure before this employer can order a report. Click "Review & Sign Disclosure" to read the full form and authorize.
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
                  {selectedRequest.requestType === 'document_upload' && onNavigateToResume && (
                    <button
                      onClick={() => {
                        onNavigateToResume(selectedRequest.targetBlockType ?? null)
                        setSelectedRequest(null)
                      }}
                      className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors'
                    >
                      <ExternalLink className='w-4 h-4' />
                      Go to Resume
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

                  {selectedRequest.requestType === 'mvr_order' && (
                    <button
                      onClick={() => setShowDisclosure(true)}
                      className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors'
                    >
                      <Shield className='w-4 h-4' />
                      Review & Sign Disclosure
                    </button>
                  )}

                  {['verification', 'custom'].includes(selectedRequest.requestType) && (
                    <button
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
                      theme === 'dark'
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
                      subject={`Re: ${REQUEST_TYPE_CONFIG[selectedRequest.requestType].label} from ${selectedRequest.company.name}`}
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
      {showDisclosure && selectedRequest && (
        <BackgroundCheckDisclosure
          requestId={selectedRequest.id}
          companyName={selectedRequest.company?.name || 'the employer'}
          userAddress={userAddress || ''}
          onClose={() => setShowDisclosure(false)}
          onConsentSigned={async () => {
            setShowDisclosure(false)
            setSelectedRequest(null)
            await fetchRequests()
          }}
        />
      )}

      {/* View previously signed consent */}
      {viewingConsent && (
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
    </div>
  )
}
