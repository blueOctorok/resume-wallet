'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Clock, Trash2 } from 'lucide-react'
import type { AdminTabProps, BgcheckRequest } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

export default function BgcheckRequestsTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [bgcheckRequests, setBgcheckRequests] = useState<BgcheckRequest[]>([])

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    const offset = (currentPage - 1) * pageSize
    try {
      const res = await fetch(
        `/api/admin/bgcheck-requests?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } }
      )
      const data = await res.json()
      if (data.success) {
        setBgcheckRequests(data.requests || [])
        setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch bgcheck requests:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData, searchQuery])

  return (
    <div className='overflow-x-auto'>
      <table className='w-full'>
        <thead className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}>
          <tr>
            <th className={`${tableHeaderClass} px-4 py-3`}>Company</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Candidate</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Request Status</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Consent</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Requested</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Signed</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
          {bgcheckRequests.map((req) => (
            <tr
              key={req.id}
              className={
                isDarkTheme(theme)
                  ? 'hover:bg-gray-800/50'
                  : 'hover:bg-gray-50'
              }
            >
              <td className={tableCellClass}>
                {req.companyName}
              </td>
              <td className={tableCellClass}>
                <div>
                  <div>{req.driverName}</div>
                  {req.driverEmail && (
                    <div className='text-xs text-gray-500'>{req.driverEmail}</div>
                  )}
                </div>
              </td>
              <td className={tableCellClass}>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    req.status === 'completed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : req.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : req.status === 'viewed'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {req.status}
                </span>
              </td>
              <td className={tableCellClass}>
                {req.hasSigned ? (
                  <div className='flex items-center gap-1 text-green-600 dark:text-green-400'>
                    <CheckCircle className='w-4 h-4' />
                    <span className='text-xs'>Signed</span>
                  </div>
                ) : (
                  <div className='flex items-center gap-1 text-yellow-600 dark:text-yellow-400'>
                    <Clock className='w-4 h-4' />
                    <span className='text-xs'>Awaiting</span>
                  </div>
                )}
              </td>
              <td className={tableCellClass}>
                {new Date(req.requestedAt).toLocaleDateString()}
              </td>
              <td className={tableCellClass}>
                {req.signedAt
                  ? new Date(req.signedAt).toLocaleDateString()
                  : '-'}
              </td>
              <td className={tableCellClass}>
                <button
                  onClick={() =>
                    onDelete({
                      type: 'bgcheckRequest',
                      id: req.id,
                      name: `${req.companyName} → ${req.driverName}`,
                    })
                  }
                  className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                  title='Remove request'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {bgcheckRequests.length === 0 && (
        <div className='text-center py-12 text-gray-500'>
          No background check requests found
        </div>
      )}
    </div>
  )
}
