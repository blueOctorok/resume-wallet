'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import type {
  AdminTabProps,
  User,
  UserDetail,
} from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'
import UserDetailModal from '@/components/admin/modals/UserDetailModal'

export default function UsersTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [loadingUserDetail, setLoadingUserDetail] = useState(false)

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } }
      )
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
        setTotalCount(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, setTotalCount])

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
          const userFromList = users.find((u) => u.id === userId)
          setSelectedUser({
            user: {
              ...data.user,
              isAdmin: userFromList?.isAdmin || false,
              displayName: userFromList?.displayName,
              displayEmail: userFromList?.displayEmail,
              hasDevProfile: userFromList?.hasDevProfile || false,
              devProjectCount: userFromList?.devProjectCount || 0,
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
      <div className='overflow-x-auto'>
        <table className='w-full'>
          <thead
            className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}
          >
            <tr>
              <th className={`${tableHeaderClass} px-4 py-3`}>User</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Role</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Data</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Joined</th>
              <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
            {users.map((user) => (
              <tr
                key={user.id}
                className={`cursor-pointer ${
                  theme === 'dark'
                    ? 'hover:bg-gray-800/50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => fetchUserDetail(user.id)}
              >
                <td className={tableCellClass}>
                  <div className={user.displayName ? '' : 'opacity-50'}>
                    {user.displayName || user.name || 'No name'}
                  </div>
                  <div className='text-xs opacity-60'>
                    {user.displayEmail || user.email || '-'}
                  </div>
                  <code className='text-xs opacity-40'>
                    {user.wallet_address.slice(0, 8)}...
                    {user.wallet_address.slice(-6)}
                  </code>
                </td>
                <td className={tableCellClass}>
                  <div className='flex flex-wrap gap-1'>
                    {user.isAdmin && (
                      <span className='px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-semibold'>
                        Admin
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        user.role === 'candidate'
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
                          : user.role === 'employer'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {user.role || 'none'}
                    </span>
                  </div>
                </td>
                <td className={tableCellClass}>
                  <div className='flex flex-wrap gap-1 text-xs'>
                    {user.hasProfile && (
                      <span className='px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>
                        Driver Profile
                      </span>
                    )}
                    {user.hasDevProfile && (
                      <span className='px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'>
                        Dev Profile
                      </span>
                    )}
                    {user.resumeCount > 0 && (
                      <span className='px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'>
                        {user.resumeCount} Resume
                        {user.resumeCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {user.dotAppCount > 0 && (
                      <span className='px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'>
                        {user.dotAppCount} DOT
                      </span>
                    )}
                    {user.devProjectCount > 0 && (
                      <span className='px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'>
                        {user.devProjectCount} Project
                        {user.devProjectCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </td>
                <td className={tableCellClass}>
                  {user.is_active ? (
                    <span className='px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>
                      Active
                    </span>
                  ) : (
                    <span className='px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'>
                      Inactive
                    </span>
                  )}
                </td>
                <td className={tableCellClass}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td
                  className={tableCellClass}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className='flex items-center gap-1'>
                    <button
                      onClick={() => fetchUserDetail(user.id)}
                      className={`p-1.5 rounded ${
                        theme === 'dark'
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-100'
                      } text-indigo-500`}
                      title='View user details'
                    >
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        width='16'
                        height='16'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      >
                        <path d='M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' />
                        <circle cx='12' cy='12' r='3' />
                      </svg>
                    </button>
                    {user.isAdmin ? (
                      <span
                        className='p-1.5 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        title='Cannot delete admin accounts'
                      >
                        <Trash2 className='w-4 h-4' />
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          onDelete({
                            type: 'user',
                            id: user.id,
                            name:
                              user.displayName || user.wallet_address,
                          })
                        }
                        className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                        title='Delete user and all data'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className='text-center py-12 text-gray-500'>
            No users found
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
