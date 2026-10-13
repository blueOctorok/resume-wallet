'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Download, Trash2 } from 'lucide-react'
import type { AdminTabProps, VerificationOutreachSummary, VerificationRow } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

const VIEWS = [
  { id: '', label: 'All' },
  { id: 'in_cadence', label: 'In cadence' },
  { id: 'needs_contact', label: 'Needs contact' },
  { id: 'exhausted', label: 'Exhausted' },
] as const

const pct = (rate: number) => `${Math.round(rate * 100)}%`

export default function VerificationsTab({
  theme,
  sessionUserId,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [verifications, setVerifications] = useState<VerificationRow[]>([])
  const [summary, setSummary] = useState<VerificationOutreachSummary | null>(null)
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)
  const dark = isDarkTheme(theme)

  const fetchData = useCallback(async () => {
    if (!sessionUserId) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/verifications?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}&view=${view}`,
        { headers: { 'x-wallet-address': sessionUserId } },
      )
      const data = await res.json()
      if (data.success) {
        setVerifications(data.verifications)
        setSummary(data.summary ?? null)
        setTotalCount(data.total ?? data.verifications?.length ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch verifications:', err)
    }
  }, [sessionUserId, searchQuery, currentPage, pageSize, setTotalCount, view])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div>
      {summary && (
        <div className={`mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
          <div className={`rounded-lg border px-3 py-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className='opacity-70'>Packets</div>
            <div className='text-sm font-semibold'>{summary.total}</div>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className='opacity-70'>Reply rate by email</div>
            <div className='text-sm font-semibold'>
              {summary.replyRateByAttempt.map((r) => `${r.attemptNumber}:${pct(r.rate)}`).join(' · ')}
            </div>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className='opacity-70'>Bounce rate</div>
            <div className='text-sm font-semibold'>{pct(summary.bounceRate)}</div>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className='opacity-70'>Exhausted</div>
            <div className='text-sm font-semibold'>{pct(summary.exhaustedRate)}</div>
          </div>
        </div>
      )}

      <div className='mb-3 flex flex-wrap gap-2'>
        {VIEWS.map((chip) => (
          <button
            key={chip.id || 'all'}
            type='button'
            onClick={() => setView(chip.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              view === chip.id
                ? 'bg-[#173150] text-white'
                : dark
                  ? 'bg-gray-800 text-gray-300'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full'>
          <thead className={dark ? 'bg-gray-800' : 'bg-gray-50'}>
            <tr>
              <th className={`${tableHeaderClass} px-4 py-3`}>Applicant</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Previous Employer</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Position</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Delivery</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Research</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
            {verifications.map((v) => {
              const open = expandedId === v.id
              return (
                <React.Fragment key={v.id}>
                  <tr className={dark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                    <td className={tableCellClass}>
                      <span className='font-mono text-xs'>
                        {v.applicantWallet ? `${v.applicantWallet.slice(0, 6)}...${v.applicantWallet.slice(-4)}` : '-'}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <div>{v.previousEmployerName}</div>
                      {v.previousEmployerEmail && <div className='text-xs opacity-75'>{v.previousEmployerEmail}</div>}
                    </td>
                    <td className={tableCellClass}>{v.claimedPosition}</td>
                    <td className={tableCellClass}>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          v.status === 'VERIFIED' || v.status === 'PARTIALLY_VERIFIED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : v.status === 'VERIFICATION_REQUESTED' || v.status === 'VERIFICATION_IN_PROGRESS'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {v.status.replace(/_/g, ' ')}
                      </span>
                      {v.outreachExhaustedAt && (
                        <div className='mt-1 text-[10px] opacity-70'>
                          Exhausted {new Date(v.outreachExhaustedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      <button
                        type='button'
                        className='inline-flex items-center gap-1 text-xs'
                        onClick={() => setExpandedId(open ? null : v.id)}
                      >
                        {open ? <ChevronDown className='h-3 w-3' /> : <ChevronRight className='h-3 w-3' />}
                        {v.attemptCount} email{v.attemptCount === 1 ? '' : 's'}
                        {v.lastDeliveryStatus ? ` · ${v.lastDeliveryStatus}` : ''}
                      </button>
                    </td>
                    <td className={tableCellClass}>{v.contactResearchStatus ?? '—'}</td>
                    <td className={tableCellClass}>{new Date(v.createdAt).toLocaleDateString()}</td>
                    <td className={tableCellClass}>
                      <div className='flex items-center gap-1'>
                        <a
                          href={`/api/candidate/verification/${v.id}/attempt-record`}
                          className='p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700'
                          title='Download attempt record'
                        >
                          <Download className='w-4 h-4' />
                        </a>
                        <button
                          onClick={() =>
                            onDelete({
                              type: 'verification',
                              id: v.id,
                              name: `${v.previousEmployerName} – ${v.claimedPosition}`,
                            })
                          }
                          className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                          title='Remove verification (applicant can request again)'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className={dark ? 'bg-gray-900/40' : 'bg-gray-50'}>
                      <td colSpan={8} className='px-4 py-2 text-xs'>
                        {v.attempts.length === 0 ? (
                          <span className='opacity-70'>No attempts recorded.</span>
                        ) : (
                          <ul className='space-y-1'>
                            {v.attempts.map((a) => (
                              <li key={a.attemptNumber}>
                                #{a.attemptNumber} · {a.method} · {a.deliveryStatus ?? 'sent'} ·{' '}
                                {new Date(a.sentAt).toLocaleString()}
                                {a.contactEmail ? ` · ${a.contactEmail}` : ''}
                                {a.triggeredBy ? ` · ${a.triggeredBy}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
        {verifications.length === 0 && <div className='text-center py-12 text-gray-500'>No verification requests</div>}
      </div>
    </div>
  )
}
