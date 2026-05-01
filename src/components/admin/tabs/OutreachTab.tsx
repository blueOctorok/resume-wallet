'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { Send, Mail, Trash2 } from 'lucide-react'
import type { AdminTabProps, AdminOutreach } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

export default function OutreachTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [outreach, setOutreach] = useState<AdminOutreach[]>([])
  const [outreachFilter, setOutreachFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'>('all')

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    const offset = (currentPage - 1) * pageSize
    try {
      const res = await fetch(
        `/api/admin/outreach?status=${outreachFilter === 'all' ? '' : outreachFilter}&search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } }
      )
      const data = await res.json()
      if (data.success) {
        setOutreach(data.outreach)
        setTotalCount(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch outreach:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, outreachFilter, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className='p-6'>
      {/* Status Filter Pills */}
      <div className='flex flex-wrap gap-2 mb-6'>
        {(['all', 'pending', 'in_progress', 'completed', 'cancelled'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setOutreachFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              outreachFilter === status
                ? 'bg-teal-500 text-white'
                : isDarkTheme(theme)
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Outreach Table */}
      <div className='overflow-x-auto'>
        <table className='w-full'>
          <thead className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}>
            <tr>
              <th className={`${tableHeaderClass} px-4 py-3`}>Candidate</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Company</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Type</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Job</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Email Sent</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkTheme(theme) ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {outreach.map((invite) => (
              <tr
                key={invite.id}
                className={`${isDarkTheme(theme) ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}
              >
                <td className={tableCellClass}>
                  <div>
                    <p className={`font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                      {invite.candidateName || 'Unnamed'}
                    </p>
                    <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                      {invite.candidateEmail || '—'}
                    </p>
                  </div>
                </td>
                <td className={tableCellClass}>
                  <div>
                    <p className='truncate max-w-[120px]' title={invite.companyName}>
                      {invite.companyName}
                    </p>
                    <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                      {invite.createdByEmail || invite.createdByWallet?.slice(0, 10) + '...'}
                    </p>
                  </div>
                </td>
                <td className={tableCellClass}>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    invite.type === 'block' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {invite.type === 'block' ? 'Block' : 'General'}
                  </span>
                </td>
                <td className={tableCellClass}>
                  <p className='truncate max-w-[150px]' title={invite.jobTitle || ''}>
                    {invite.jobTitle || '—'}
                  </p>
                </td>
                <td className={tableCellClass}>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    invite.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    invite.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    invite.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    invite.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {invite.status === 'in_progress' ? 'In Progress' : invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                  </span>
                </td>
                <td className={tableCellClass}>
                  {invite.emailSentAt ? (
                    <div className='flex items-center gap-1 text-green-500'>
                      <Mail className='w-3.5 h-3.5' />
                      <span className='text-xs'>{new Date(invite.emailSentAt).toLocaleDateString()}</span>
                    </div>
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </td>
                <td className={tableCellClass}>
                  <p className='text-xs'>
                    {new Date(invite.createdAt).toLocaleDateString()}
                  </p>
                </td>
                <td className={tableCellClass}>
                  <button
                    onClick={() =>
                      onDelete({
                        type: 'outreach',
                        id: invite.id,
                        name: `outreach to "${invite.candidateName || invite.candidateEmail || 'Unknown'}"`,
                      })
                    }
                    className='p-1.5 rounded-lg text-red-500 hover:bg-red-500/10'
                    title='Delete outreach invite'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {outreach.length === 0 && (
        <div className='text-center py-12'>
          <Send className={`w-12 h-12 mx-auto mb-4 ${
            isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'
          }`} />
          <p className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}>
            No outreach invites found
          </p>
        </div>
      )}
    </div>
  )
}
