'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import type { AdminTabProps, Profile } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

export default function ProfilesTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/profiles?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } }
      )
      const data = await res.json()
      if (data.success) {
        setProfiles(data.profiles)
        setTotalCount(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch profiles:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className='overflow-x-auto'>
      <table className='w-full'>
        <thead
          className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}
        >
          <tr>
            <th className={`${tableHeaderClass} px-4 py-3`}>Name</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Email</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>CDL</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Source</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Updated</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
          {profiles.map((profile) => (
            <tr
              key={profile.id}
              className={
                theme === 'dark'
                  ? 'hover:bg-gray-800/50'
                  : 'hover:bg-gray-50'
              }
            >
              <td className={tableCellClass}>{profile.fullName}</td>
              <td className={tableCellClass}>
                {profile.email || (
                  <code className='text-xs'>
                    {profile.walletAddress.slice(0, 8)}...
                  </code>
                )}
              </td>
              <td className={tableCellClass}>
                {profile.cdl_number ? (
                  <span>
                    {profile.cdl_number}
                    {profile.cdl_state && (
                      <span className='text-xs opacity-75 ml-1'>
                        ({profile.cdl_state})
                      </span>
                    )}
                  </span>
                ) : (
                  '-'
                )}
              </td>
              <td className={tableCellClass}>
                <span className='text-xs opacity-75'>
                  {profile.last_updated_from || '-'}
                </span>
              </td>
              <td className={tableCellClass}>
                {new Date(profile.updated_at).toLocaleDateString()}
              </td>
              <td className={tableCellClass}>
                <button
                  onClick={() =>
                    onDelete({
                      type: 'profile',
                      id: profile.id,
                      name: profile.fullName,
                    })
                  }
                  className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                  title='Delete profile'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {profiles.length === 0 && (
        <div className='text-center py-12 text-gray-500'>
          No profiles found
        </div>
      )}
    </div>
  )
}
