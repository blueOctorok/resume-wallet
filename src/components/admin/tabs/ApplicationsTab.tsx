'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Trash2 } from 'lucide-react'
import type { AdminTabProps, AdminApplication } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

export default function ApplicationsTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [applications, setApplications] = useState<AdminApplication[]>([])
  const [applicationsFilter, setApplicationsFilter] = useState<
    'all' | 'submitted' | 'contacted' | 'archived'
  >('all')

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    const offset = (currentPage - 1) * pageSize
    try {
      const res = await fetch(
        `/api/admin/applications?status=${applicationsFilter === 'all' ? '' : applicationsFilter}&search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } }
      )
      const data = await res.json()
      if (data.success) {
        setApplications(data.applications)
        setTotalCount(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch applications:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, applicationsFilter, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className='p-6'>
      {/* Filter Pills */}
      <div className='flex flex-wrap gap-2 mb-6'>
        {(['all', 'submitted', 'contacted', 'archived'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setApplicationsFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              applicationsFilter === status
                ? 'bg-indigo-500 text-white'
                : isDarkTheme(theme)
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'all'
              ? 'All'
              : status === 'submitted'
                ? 'New'
                : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Applications Table */}
      <div className='overflow-x-auto'>
        <table className='w-full'>
          <thead className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}>
            <tr>
              <th className={`${tableHeaderClass} px-4 py-3`}>Applicant</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Job</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Company</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Resume</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>DOT App</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Applied</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkTheme(theme) ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {applications.map((app) => (
              <tr
                key={app.id}
                className={`${isDarkTheme(theme) ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}
              >
                <td className={tableCellClass}>
                  <div>
                    <p className={`font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                      {app.applicantName || 'Unnamed'}
                    </p>
                    <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                      {app.applicantEmail || app.applicantWallet?.slice(0, 10) + '...'}
                    </p>
                  </div>
                </td>
                <td className={tableCellClass}>
                  <p className='truncate max-w-[150px]' title={app.jobTitle}>
                    {app.jobTitle}
                  </p>
                </td>
                <td className={tableCellClass}>
                  <p className='truncate max-w-[120px]' title={app.companyName}>
                    {app.companyName}
                  </p>
                </td>
                <td className={tableCellClass}>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    app.status === 'submitted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    app.status === 'contacted' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' :
                    app.status === 'archived' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {app.status === 'submitted' ? 'New' : app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                </td>
                <td className={tableCellClass}>
                  {app.resumeId ? (
                    <span className='text-green-500' title={app.resumeTitle || 'Linked'}>✓</span>
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </td>
                <td className={tableCellClass}>
                  {app.dotApplicationId ? (
                    <span className={app.dotApplicationComplete ? 'text-green-500' : 'text-yellow-500'}>
                      {app.dotApplicationComplete ? '✓' : '...'}
                    </span>
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </td>
                <td className={tableCellClass}>
                  <p className='text-xs'>
                    {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                </td>
                <td className={tableCellClass}>
                  <button
                    onClick={() =>
                      onDelete({
                        type: 'application',
                        id: app.id,
                        name: `${app.applicantName || 'Unknown'}'s application to "${app.jobTitle}"`,
                      })
                    }
                    className='p-1.5 rounded-lg text-red-500 hover:bg-red-500/10'
                    title='Delete application'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {applications.length === 0 && (
        <div className='text-center py-12'>
          <ClipboardList className={`w-12 h-12 mx-auto mb-4 ${
            isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'
          }`} />
          <p className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}>
            No applications found
          </p>
        </div>
      )}
    </div>
  )
}
