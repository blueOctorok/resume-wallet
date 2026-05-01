'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { Trash2, Github } from 'lucide-react'
import type { AdminTabProps, DevProfile } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

export default function DevProfilesTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [devProfiles, setDevProfiles] = useState<DevProfile[]>([])

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/dev-profiles?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } }
      )
      const data = await res.json()
      if (data.success) {
        setDevProfiles(data.profiles)
        setTotalCount(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch dev profiles:', err)
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
            <th className={`${tableHeaderClass} px-4 py-3`}>Developer</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Headline</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>GitHub</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Skills</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Projects</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Available</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
          {devProfiles.map((profile) => (
            <tr
              key={profile.id}
              className={
                isDarkTheme(theme)
                  ? 'hover:bg-gray-800/50'
                  : 'hover:bg-gray-50'
              }
            >
              <td className={tableCellClass}>
                <div>{profile.full_name || 'Unnamed'}</div>
                <div className='text-xs opacity-60'>
                  {profile.email || '-'}
                </div>
              </td>
              <td className={tableCellClass}>
                <span className='text-xs line-clamp-1'>
                  {profile.headline || '-'}
                </span>
              </td>
              <td className={tableCellClass}>
                {profile.github_username ? (
                  <a
                    href={`https://github.com/${profile.github_username}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline'
                  >
                    <Github className='w-3 h-3 opacity-60' />
                    <span className='text-xs'>
                      @{profile.github_username}
                    </span>
                  </a>
                ) : (
                  <span className='text-xs opacity-50'>-</span>
                )}
              </td>
              <td className={tableCellClass}>
                {profile.skillCount > 0 ? (
                  <span className='px-1.5 py-0.5 rounded text-xs bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'>
                    {profile.skillCount} skill
                    {profile.skillCount > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className='text-xs opacity-50'>0</span>
                )}
              </td>
              <td className={tableCellClass}>
                {profile.projectCount > 0 ? (
                  <span className='px-1.5 py-0.5 rounded text-xs bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'>
                    {profile.projectCount}
                  </span>
                ) : (
                  <span className='text-xs opacity-50'>0</span>
                )}
              </td>
              <td className={tableCellClass}>
                {profile.available_for_work ? (
                  <span className='px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>
                    Yes
                  </span>
                ) : (
                  <span className='px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'>
                    No
                  </span>
                )}
              </td>
              <td className={tableCellClass}>
                {new Date(profile.created_at).toLocaleDateString()}
              </td>
              <td className={tableCellClass}>
                <button
                  onClick={() =>
                    onDelete({
                      type: 'devProfile',
                      id: profile.id,
                      name:
                        profile.full_name ||
                        profile.github_username ||
                        'developer profile',
                    })
                  }
                  className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                  title='Delete developer profile'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {devProfiles.length === 0 && (
        <div className='text-center py-12 text-gray-500'>
          No developer profiles found
        </div>
      )}
    </div>
  )
}
