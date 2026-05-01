'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { Trash2, Filter } from 'lucide-react'
import type { AdminTabProps, User, UserDetail } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'
import UserDetailModal from '@/components/admin/modals/UserDetailModal'
import { BLOCK_DEFINITIONS } from '@/lib/block-registry'

const blockLabelMap = new Map(BLOCK_DEFINITIONS.map(b => [b.id, b.label]))

const BLOCK_PILL_COLORS: Record<string, { bg: string; text: string }> = {
  drivers:    { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-800 dark:text-blue-400' },
  developers: { bg: 'bg-cyan-100 dark:bg-cyan-900/30',    text: 'text-cyan-800 dark:text-cyan-400' },
  general:    { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-400' },
}

function pillColor(blockType: string) {
  if (blockType.startsWith('driver-')) return BLOCK_PILL_COLORS.drivers
  if (blockType.startsWith('developer-')) return BLOCK_PILL_COLORS.developers
  if (blockType.startsWith('general-')) return BLOCK_PILL_COLORS.general
  return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-400' }
}

type BlockFilterValue = '' | 'drivers' | 'developers' | 'general' | 'none'

const FILTER_OPTIONS: { value: BlockFilterValue; label: string }[] = [
  { value: '',           label: 'All Candidates' },
  { value: 'drivers',    label: 'Driver Blocks' },
  { value: 'developers', label: 'Developer Blocks' },
  { value: 'general',    label: 'General Only' },
  { value: 'none',       label: 'No Blocks' },
]

export default function CandidatesTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [users, setUsers] = useState<User[]>([])
  const [blockFilter, setBlockFilter] = useState<BlockFilterValue>('')
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [loadingUserDetail, setLoadingUserDetail] = useState(false)

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    try {
      const offset = (currentPage - 1) * pageSize
      const params = new URLSearchParams({
        search: searchQuery,
        limit: String(pageSize),
        offset: String(offset),
      })
      if (blockFilter) params.set('blockFilter', blockFilter)

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { 'x-wallet-address': walletAddress },
      })
      const data = await res.json()
      if (data.success) {
        // Exclude employers — this tab is candidates only
        const candidates = (data.users as User[]).filter(u => u.role !== 'employer')
        setUsers(candidates)
        setTotalCount(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch candidates:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, setTotalCount, blockFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchUserDetail = useCallback(
    async (userId: string) => {
      if (!walletAddress) return
      setLoadingUserDetail(true)
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          headers: { 'x-wallet-address': walletAddress },
        })
        const data = await response.json()
        if (data.success) {
          const userFromList = users.find(u => u.id === userId)
          setSelectedUser({
            user: {
              ...data.user,
              isAdmin: userFromList?.isAdmin || false,
              displayName: userFromList?.displayName,
              displayEmail: userFromList?.displayEmail,
              hasDevProfile: userFromList?.hasDevProfile || false,
              devProjectCount: userFromList?.devProjectCount || 0,
              installedBlocks: userFromList?.installedBlocks || [],
              blockCategories: userFromList?.blockCategories || [],
            },
            profile: data.profile,
            devProfile: data.devProfile || null,
            devProjects: data.devProjects || [],
            resumes: data.resumes || [],
            dotApps: data.dotApps || [],
          })
        }
      } catch (err) {
        console.error('Failed to fetch user detail:', err)
      } finally {
        setLoadingUserDetail(false)
      }
    },
    [walletAddress, users]
  )

  return (
    <>
      {/* Block category filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className={`w-4 h-4 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`} />
        <div className="flex flex-wrap gap-1">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setBlockFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                blockFilter === opt.value
                  ? isDarkTheme(theme)
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40'
                    : 'bg-teal-50 text-teal-700 border border-teal-300'
                  : isDarkTheme(theme)
                    ? 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}>
            <tr>
              <th className={`${tableHeaderClass} px-4 py-3`}>Candidate</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Blocks</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Data</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Joined</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map(user => (
              <tr
                key={user.id}
                className={`cursor-pointer ${
                  isDarkTheme(theme) ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                }`}
                onClick={() => fetchUserDetail(user.id)}
              >
                {/* Candidate info */}
                <td className={tableCellClass}>
                  <div className={user.displayName ? '' : 'opacity-50'}>
                    {user.displayName || 'No name'}
                  </div>
                  <div className="text-xs opacity-60">
                    {user.displayEmail || user.email || '-'}
                  </div>
                  <code className="text-xs opacity-40">
                    {user.wallet_address.slice(0, 8)}...{user.wallet_address.slice(-6)}
                  </code>
                </td>

                {/* Block pills */}
                <td className={tableCellClass}>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {user.installedBlocks.length === 0 ? (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500">
                        No blocks
                      </span>
                    ) : (
                      user.installedBlocks.map(bt => {
                        const colors = pillColor(bt)
                        return (
                          <span
                            key={bt}
                            className={`px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}
                          >
                            {blockLabelMap.get(bt) || bt}
                          </span>
                        )
                      })
                    )}
                  </div>
                </td>

                {/* Data counts */}
                <td className={tableCellClass}>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {user.resumeCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        {user.resumeCount} Resume{user.resumeCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {user.dotAppCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        {user.dotAppCount} DOT
                      </span>
                    )}
                    {user.devProjectCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400">
                        {user.devProjectCount} Project{user.devProjectCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className={tableCellClass}>
                  {user.is_active ? (
                    <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      Inactive
                    </span>
                  )}
                </td>

                {/* Joined */}
                <td className={tableCellClass}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>

                {/* Actions */}
                <td className={tableCellClass} onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => fetchUserDetail(user.id)}
                      className={`p-1.5 rounded ${
                        isDarkTheme(theme) ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      } text-indigo-500`}
                      title="View details"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete({ type: 'user', id: user.id, name: user.displayName || user.wallet_address })}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                      title="Delete user and all data"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {blockFilter ? 'No candidates match this filter' : 'No candidates found'}
          </div>
        )}
      </div>

      <UserDetailModal
        theme={theme}
        user={selectedUser}
        loading={loadingUserDetail}
        onClose={() => setSelectedUser(null)}
        onDelete={onDelete}
      />
    </>
  )
}
