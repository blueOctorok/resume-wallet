'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import type { AdminTabProps, DotApp } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

export default function DotAppsTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [dotApps, setDotApps] = useState<DotApp[]>([])

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/dot-apps?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } }
      )
      const data = await res.json()
      if (data.success) {
        setDotApps(data.dotApps)
        setTotalCount(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch DOT apps:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, setTotalCount])

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
            <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Verification</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
          {dotApps.map((app) => (
            <tr
              key={app.id}
              className={
                isDarkTheme(theme)
                  ? 'hover:bg-gray-800/50'
                  : 'hover:bg-gray-50'
              }
            >
              <td className={tableCellClass}>
                <div>
                  <div>{app.applicantName}</div>
                  <code className='text-xs opacity-75'>
                    {app.walletAddress.slice(0, 8)}...
                  </code>
                </div>
              </td>
              <td className={tableCellClass}>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    app.is_complete
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {app.is_complete
                    ? 'Complete'
                    : `Step ${app.current_step}/7`}
                </span>
              </td>
              <td className={tableCellClass}>
                <span className='text-xs opacity-75'>
                  {app.verification_status || '-'}
                </span>
              </td>
              <td className={tableCellClass}>
                {new Date(app.created_at).toLocaleDateString()}
              </td>
              <td className={tableCellClass}>
                <button
                  onClick={() =>
                    onDelete({
                      type: 'dotApp',
                      id: app.id,
                      name: `${app.applicantName}'s application`,
                    })
                  }
                  className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                  title='Delete application'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {dotApps.length === 0 && (
        <div className='text-center py-12 text-gray-500'>
          No DOT applications found
        </div>
      )}
    </div>
  )
}
