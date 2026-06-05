'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import type { AdminTabProps, VerificationRow } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

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

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!sessionUserId) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/verifications?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': sessionUserId } }
      )
      const data = await res.json()
      if (data.success) {
        setVerifications(data.verifications)
        setTotalCount(data.total ?? data.verifications?.length ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch verifications:', err)
    }
  }, [sessionUserId, searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className='overflow-x-auto'>
      <table className='w-full'>
        <thead
          className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}
        >
          <tr>
            <th className={`${tableHeaderClass} px-4 py-3`}>Applicant</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Previous Employer</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Position</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Attempts</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
          {verifications.map((v) => (
            <tr
              key={v.id}
              className={
                isDarkTheme(theme)
                  ? 'hover:bg-gray-800/50'
                  : 'hover:bg-gray-50'
              }
            >
              <td className={tableCellClass}>
                <span className='font-mono text-xs'>
                  {v.applicantWallet
                    ? `${v.applicantWallet.slice(0, 6)}...${v.applicantWallet.slice(-4)}`
                    : '-'}
                </span>
              </td>
              <td className={tableCellClass}>
                <div>{v.previousEmployerName}</div>
                {v.previousEmployerEmail && (
                  <div className='text-xs opacity-75'>
                    {v.previousEmployerEmail}
                  </div>
                )}
              </td>
              <td className={tableCellClass}>
                {v.claimedPosition}
              </td>
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
              </td>
              <td className={tableCellClass}>
                {v.attemptCount}
              </td>
              <td className={tableCellClass}>
                {new Date(v.createdAt).toLocaleDateString()}
              </td>
              <td className={tableCellClass}>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {verifications.length === 0 && (
        <div className='text-center py-12 text-gray-500'>
          No verification requests
        </div>
      )}
    </div>
  )
}
