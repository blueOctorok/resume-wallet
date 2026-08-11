'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  AlertTriangle,
  Archive,
  CheckCircle2,
  XCircle,
  UserPlus,
  Loader2,
  Trash2,
} from 'lucide-react'
import type { AdminTabProps, AccessRequest, AccessRequestsStats } from '@/components/admin/admin-types'

export default function AccessRequestsTab({
  theme,
  sessionUserId,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [accessRequestsStats, setAccessRequestsStats] = useState<AccessRequestsStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    flagged: 0,
    auto_approved: 0,
    blocked: 0,
    total: 0,
  })
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!sessionUserId) return
    try {
      const offset = (currentPage - 1) * pageSize
      const params = new URLSearchParams({
        status: 'all',
        search: searchQuery,
        limit: String(pageSize),
        offset: String(offset),
      })
      const res = await fetch(`/api/admin/employer-requests?${params}`, {
        headers: { 'x-wallet-address': sessionUserId },
      })
      const data = await res.json()
      if (data.success) {
        setAccessRequests(data.requests)
        setAccessRequestsStats(data.stats)
        setTotalCount(data.total ?? data.requests.length)
      }
    } catch (err) {
      console.error('Failed to fetch access requests:', err)
    }
  }, [sessionUserId, searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData, searchQuery, currentPage])

  return (
    <div className='p-6'>
      {/* Archive notice */}
      <div className={`mb-6 rounded-xl border p-4 flex items-start gap-3 ${
        isDarkTheme(theme)
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        <Archive className='w-5 h-5 shrink-0 mt-0.5' />
        <div className='text-sm'>
          <p className='font-semibold'>Archive — these requests can no longer grant access</p>
          <p className={`mt-1 ${isDarkTheme(theme) ? 'text-amber-200/80' : 'text-amber-800'}`}>
            Self-serve employer signup was removed in August 2026. Employer accounts are created
            in the Companies tab, where you name the company and its designated owner. These rows
            are kept as history.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className='flex flex-wrap gap-2 mb-6'>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          isDarkTheme(theme) ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
        }`}>
          <Clock className='w-4 h-4' />
          <span>Pending</span>
          <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
            isDarkTheme(theme) ? 'bg-yellow-500/30' : 'bg-yellow-200'
          }`}>{accessRequestsStats.pending}</span>
        </div>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          isDarkTheme(theme) ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-700'
        }`}>
          <AlertTriangle className='w-4 h-4' />
          <span>AI Flagged</span>
          <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
            isDarkTheme(theme) ? 'bg-orange-500/30' : 'bg-orange-200'
          }`}>{accessRequestsStats.flagged}</span>
        </div>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          isDarkTheme(theme) ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700'
        }`}>
          <CheckCircle2 className='w-4 h-4' />
          <span>Approved</span>
          <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
            isDarkTheme(theme) ? 'bg-green-500/30' : 'bg-green-200'
          }`}>{accessRequestsStats.approved + (accessRequestsStats.auto_approved || 0)}</span>
        </div>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          isDarkTheme(theme) ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-700'
        }`}>
          <XCircle className='w-4 h-4' />
          <span>Rejected / Blocked</span>
          <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
            isDarkTheme(theme) ? 'bg-red-500/30' : 'bg-red-200'
          }`}>{accessRequestsStats.rejected + (accessRequestsStats.blocked || 0)}</span>
        </div>
      </div>

      {/* Requests List */}
      {accessRequests.length === 0 ? (
        <div className='text-center py-12'>
          <UserPlus className='w-12 h-12 mx-auto mb-4 opacity-30' />
          <p className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}>
            No access requests
          </p>
        </div>
      ) : (
        <div className='space-y-4'>
          {accessRequests.map((req) => (
            <div
              key={req.id}
              className={`rounded-xl border p-5 ${
                req.status === 'pending'
                  ? isDarkTheme(theme)
                    ? 'bg-yellow-500/5 border-yellow-500/30'
                    : 'bg-yellow-50 border-yellow-200'
                  : req.status === 'flagged'
                    ? isDarkTheme(theme)
                      ? 'bg-orange-500/5 border-orange-500/30'
                      : 'bg-orange-50 border-orange-200'
                    : isDarkTheme(theme)
                      ? 'bg-gray-800/50 border-gray-700'
                      : 'bg-white border-gray-200'
              }`}
            >
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 mb-1 flex-wrap'>
                    <h3 className={`font-semibold ${
                      isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                    }`}>
                      {req.company_name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      req.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : req.status === 'flagged'
                          ? 'bg-orange-500/20 text-orange-500'
                          : req.status === 'auto_approved'
                            ? 'bg-teal-500/20 text-teal-500'
                            : req.status === 'approved'
                              ? 'bg-green-500/20 text-green-500'
                              : req.status === 'blocked'
                                ? 'bg-red-500/20 text-red-500'
                                : 'bg-red-500/20 text-red-500'
                    }`}>
                      {req.status === 'auto_approved' ? 'AI Approved' : req.status === 'flagged' ? 'AI Flagged' : req.status}
                    </span>
                    {/* Domain mismatch warning */}
                    {req.email && (() => {
                      const emailDomain = req.email!.split('@')[1]?.toLowerCase() || ''
                      const companyWords = req.company_name.toLowerCase().replace(/[^a-z0-9]/g, '')
                      const domainBase = emailDomain.split('.')[0] || ''
                      const publicDomains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'protonmail']
                      const isPublicEmail = publicDomains.some(d => emailDomain.includes(d))
                      const domainMatchesCompany = companyWords.includes(domainBase) || domainBase.includes(companyWords.slice(0, 4))
                      
                      if (isPublicEmail) {
                        return (
                          <span className='px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 flex items-center gap-1'>
                            <AlertTriangle className='w-3 h-3' />
                            Personal email
                          </span>
                        )
                      } else if (!domainMatchesCompany && domainBase.length > 2) {
                        return (
                          <span className='px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400 flex items-center gap-1'>
                            <AlertTriangle className='w-3 h-3' />
                            Domain mismatch?
                          </span>
                        )
                      }
                      return null
                    })()}
                  </div>
                  <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                    Requested by: <strong>{req.name}</strong>
                  </p>
                  {req.email && (
                    <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}>
                      {req.email}
                    </p>
                  )}
                  
                  {/* Description / Role explanation */}
                  {req.description && (
                    <div className={`mt-2 p-2 rounded-lg text-sm ${
                      isDarkTheme(theme) ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <p className={`text-xs font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                        Role & Authorization:
                      </p>
                      {req.description}
                    </div>
                  )}
                  
                  {/* Stormi evaluation info */}
                  {req.ai_reason && (
                    <div className={`mt-2 p-2 rounded-lg text-xs flex items-start gap-2 ${
                      req.ai_decision === 'approve'
                        ? isDarkTheme(theme) ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-700'
                        : req.ai_decision === 'flag'
                          ? isDarkTheme(theme) ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-700'
                          : isDarkTheme(theme) ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700'
                    }`}>
                      <span className='font-medium shrink-0'>Assistant:</span>
                      <span>{req.ai_reason}</span>
                      {req.ai_confidence != null && (
                        <span className='shrink-0 opacity-60'>({Math.round(req.ai_confidence * 100)}%)</span>
                      )}
                    </div>
                  )}

                  <p className={`text-xs mt-2 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                    Submitted: {new Date(req.created_at).toLocaleDateString()} at{' '}
                    {new Date(req.created_at).toLocaleTimeString()}
                  </p>
                  <p className={`text-xs font-mono ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`}>
                    Wallet: {req.wallet_address.slice(0, 10)}...{req.wallet_address.slice(-6)}
                  </p>
                </div>

                {/* Actions — history only. Approve/reject were removed with the
                    self-serve signup flow; these rows can no longer grant access. */}
                <div className='flex gap-2 flex-shrink-0 items-center'>
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove this ${req.status} request from the list? This only removes the record; it does not change the company or user.`)) return
                      setProcessingRequestId(req.id)
                      try {
                        const res = await fetch(`/api/admin/employer-requests/${req.id}`, {
                          method: 'DELETE',
                          headers: { 'x-wallet-address': sessionUserId || '' },
                        })
                        if (res.ok) {
                          fetchData()
                        } else {
                          const data = await res.json()
                          alert(data.error || 'Failed to remove request')
                        }
                      } catch (err) {
                        console.error('Failed to remove:', err)
                        alert('Failed to remove request')
                      } finally {
                        setProcessingRequestId(null)
                      }
                    }}
                    disabled={processingRequestId === req.id}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50 ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                    title='Remove from list (does not affect company or user)'
                  >
                    {processingRequestId === req.id ? (
                      <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                      <Trash2 className='w-4 h-4' />
                    )}
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
