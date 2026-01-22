'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAccount } from '@account-kit/react'
import {
  Users,
  FileText,
  ClipboardList,
  UserCircle,
  Settings,
  Search,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import AdminResetWallet from '@/components/admin/AdminResetWallet'
import dynamic from 'next/dynamic'

const TBackendSetup = dynamic(() => import('@/components/admin/TBackendSetup'), {
  ssr: false,
})

type TabId = 'users' | 'dotApps' | 'profiles' | 'resumes' | 'tools'

interface User {
  id: string
  wallet_address: string
  email: string | null
  name: string | null
  role: string | null
  is_active: boolean
  created_at: string
  hasProfile: boolean
  resumeCount: number
  dotAppCount: number
  isAdmin: boolean // True if wallet is in ADMIN_WALLETS
}

interface DotApp {
  id: string
  user_id: string
  is_complete: boolean
  current_step: number
  verification_status: string
  created_at: string
  walletAddress: string
  applicantName: string
}

interface Profile {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  cdl_number: string | null
  last_updated_from: string | null
  updated_at: string
  walletAddress: string
  fullName: string
}

interface Resume {
  id: string
  user_id: string
  title: string | null
  filename: string | null
  verification_status: string
  resume_type: string
  created_at: string
  walletAddress: string
  ownerName: string
}

// Inner component that uses the Alchemy hook
function AdminDashboardContent() {
  const { theme } = useTheme()
  const account = useAccount({ type: 'LightAccount' })
  const walletAddress = account?.address

  const [activeTab, setActiveTab] = useState<TabId>('users')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [users, setUsers] = useState<User[]>([])
  const [dotApps, setDotApps] = useState<DotApp[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [resumes, setResumes] = useState<Resume[]>([])
  
  // Pagination
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Check admin status
  useEffect(() => {
    if (walletAddress) {
      fetch('/api/admin/users?limit=1', {
        headers: { 'x-wallet-address': walletAddress },
      })
        .then(res => {
          setIsAdmin(res.ok)
        })
        .catch(() => setIsAdmin(false))
    } else {
      setIsAdmin(null)
    }
  }, [walletAddress])

  // Fetch data based on active tab
  const fetchData = useCallback(async () => {
    if (!walletAddress || !isAdmin) return

    setLoading(true)
    setError(null)

    const offset = (currentPage - 1) * pageSize
    const headers = { 'x-wallet-address': walletAddress }

    try {
      let response: Response
      let data: any

      switch (activeTab) {
        case 'users':
          response = await fetch(
            `/api/admin/users?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setUsers(data.users)
            setTotalCount(data.total)
          }
          break

        case 'dotApps':
          response = await fetch(
            `/api/admin/dot-apps?limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setDotApps(data.dotApps)
            setTotalCount(data.total)
          }
          break

        case 'profiles':
          response = await fetch(
            `/api/admin/profiles?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setProfiles(data.profiles)
            setTotalCount(data.total)
          }
          break

        case 'resumes':
          response = await fetch(
            `/api/admin/resumes?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setResumes(data.resumes)
            setTotalCount(data.total)
          }
          break
      }
    } catch (err) {
      setError('Failed to fetch data')
      console.error('Admin fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [walletAddress, isAdmin, activeTab, currentPage, searchQuery])

  useEffect(() => {
    if (activeTab !== 'tools') {
      fetchData()
    }
  }, [fetchData, activeTab])

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== 'DELETE' || !walletAddress) return

    setDeleting(true)
    try {
      let endpoint = ''
      switch (deleteTarget.type) {
        case 'user':
          endpoint = `/api/admin/users/${deleteTarget.id}`
          break
        case 'dotApp':
          endpoint = `/api/admin/dot-apps/${deleteTarget.id}`
          break
        case 'profile':
          endpoint = `/api/admin/profiles/${deleteTarget.id}`
          break
        case 'resume':
          endpoint = `/api/admin/resumes/${deleteTarget.id}`
          break
      }

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'x-wallet-address': walletAddress },
      })

      if (response.ok) {
        setDeleteTarget(null)
        setDeleteConfirmText('')
        fetchData()
      } else {
        const data = await response.json()
        setError(data.error || 'Delete failed')
      }
    } catch (err) {
      setError('Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // Tab configuration
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'dotApps', label: 'DOT Apps', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'profiles', label: 'Profiles', icon: <UserCircle className="w-4 h-4" /> },
    { id: 'resumes', label: 'Resumes', icon: <FileText className="w-4 h-4" /> },
    { id: 'tools', label: 'Tools', icon: <Settings className="w-4 h-4" /> },
  ]

  // Styling
  const cardClass = `rounded-xl border ${
    theme === 'dark'
      ? 'bg-gray-800/50 border-gray-700'
      : 'bg-white border-gray-200'
  }`

  const tableHeaderClass = `text-left text-xs font-semibold uppercase tracking-wider ${
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  }`

  const tableCellClass = `px-4 py-3 text-sm ${
    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
  }`

  // Not admin
  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className={`${cardClass} p-8 text-center max-w-md`}>
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Access Denied
          </h2>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Your wallet is not authorized to access the admin panel.
          </p>
          {walletAddress && (
            <p className={`mt-4 text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              {walletAddress}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Loading/checking state
  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-mint mx-auto mb-4" />
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            {walletAddress ? 'Checking admin access...' : 'Waiting for wallet connection...'}
          </p>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Admin Panel
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage users, applications, and system settings
            </p>
          </div>
          <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
          </div>
        </div>

        {/* Tabs */}
        <div className={`${cardClass} p-1 flex flex-wrap gap-1`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setCurrentPage(1)
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search & Refresh (not for tools tab) */}
        {activeTab !== 'tools' && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search..."
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-brand-mint`}
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                theme === 'dark'
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className={`p-4 rounded-lg ${
            theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {/* Content */}
        <div className={cardClass}>
          {activeTab === 'tools' ? (
            <div className="p-6 space-y-8">
              <AdminResetWallet initialWalletAddress={walletAddress || ''} />
              <TBackendSetup />
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-mint" />
            </div>
          ) : (
            <>
              {/* Users Table */}
              {activeTab === 'users' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Wallet</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Name/Email</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Role</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Data</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {users.map(user => (
                        <tr key={user.id} className={theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                          <td className={tableCellClass}>
                            <code className="text-xs">{user.wallet_address.slice(0, 8)}...{user.wallet_address.slice(-6)}</code>
                          </td>
                          <td className={tableCellClass}>
                            <div>{user.name || '-'}</div>
                            <div className="text-xs opacity-60">{user.email || '-'}</div>
                          </td>
                          <td className={tableCellClass}>
                            <div className="flex flex-wrap gap-1">
                              {user.isAdmin && (
                                <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-semibold">
                                  Admin
                                </span>
                              )}
                              <span className={`px-2 py-1 rounded text-xs ${
                                user.role === 'driver' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : user.role === 'employer'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {user.role || 'none'}
                              </span>
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            <div className="flex gap-2 text-xs">
                              {user.hasProfile && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Profile</span>}
                              {user.resumeCount > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{user.resumeCount} Resume{user.resumeCount > 1 ? 's' : ''}</span>}
                              {user.dotAppCount > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">{user.dotAppCount} App{user.dotAppCount > 1 ? 's' : ''}</span>}
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            {user.isAdmin ? (
                              <span 
                                className="p-1.5 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                title="Cannot delete admin accounts"
                              >
                                <Trash2 className="w-4 h-4" />
                              </span>
                            ) : (
                              <button
                                onClick={() => setDeleteTarget({ type: 'user', id: user.id, name: user.wallet_address })}
                                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                title="Delete user and all data"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No users found</div>
                  )}
                </div>
              )}

              {/* DOT Apps Table */}
              {activeTab === 'dotApps' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Applicant</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Wallet</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Step</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {dotApps.map(app => (
                        <tr key={app.id} className={theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                          <td className={tableCellClass}>{app.applicantName}</td>
                          <td className={tableCellClass}>
                            <code className="text-xs">{app.walletAddress.slice(0, 8)}...</code>
                          </td>
                          <td className={tableCellClass}>
                            <span className={`px-2 py-1 rounded text-xs ${
                              app.is_complete
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {app.is_complete ? 'Complete' : 'In Progress'}
                            </span>
                          </td>
                          <td className={tableCellClass}>Step {app.current_step}</td>
                          <td className={tableCellClass}>
                            {new Date(app.created_at).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              onClick={() => setDeleteTarget({ type: 'dotApp', id: app.id, name: `${app.applicantName}'s application` })}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                              title="Delete application"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dotApps.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No DOT applications found</div>
                  )}
                </div>
              )}

              {/* Profiles Table */}
              {activeTab === 'profiles' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Name</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Wallet</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>CDL</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Source</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Updated</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {profiles.map(profile => (
                        <tr key={profile.id} className={theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                          <td className={tableCellClass}>{profile.fullName}</td>
                          <td className={tableCellClass}>
                            <code className="text-xs">{profile.walletAddress.slice(0, 8)}...</code>
                          </td>
                          <td className={tableCellClass}>{profile.cdl_number || '-'}</td>
                          <td className={tableCellClass}>
                            <span className="text-xs opacity-75">{profile.last_updated_from || '-'}</span>
                          </td>
                          <td className={tableCellClass}>
                            {new Date(profile.updated_at).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              onClick={() => setDeleteTarget({ type: 'profile', id: profile.id, name: profile.fullName })}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                              title="Delete profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {profiles.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No profiles found</div>
                  )}
                </div>
              )}

              {/* Resumes Table */}
              {activeTab === 'resumes' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Title</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Owner</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Type</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Status</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {resumes.map(resume => (
                        <tr key={resume.id} className={theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                          <td className={tableCellClass}>{resume.title || resume.filename || 'Untitled'}</td>
                          <td className={tableCellClass}>{resume.ownerName}</td>
                          <td className={tableCellClass}>
                            <span className={`px-2 py-1 rounded text-xs ${
                              resume.resume_type === 'built'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {resume.resume_type || 'uploaded'}
                            </span>
                          </td>
                          <td className={tableCellClass}>
                            {resume.verification_status === 'VERIFIED' ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <span className="text-xs opacity-75">{resume.verification_status}</span>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            {new Date(resume.created_at).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              onClick={() => setDeleteTarget({ type: 'resume', id: resume.id, name: resume.title || resume.filename || 'resume' })}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                              title="Delete resume"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {resumes.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No resumes found</div>
                  )}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Page {currentPage} of {totalPages} ({totalCount} total)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`p-2 rounded ${
                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      } disabled:opacity-50`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded ${
                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      } disabled:opacity-50`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`rounded-xl border ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } p-6 max-w-md w-full`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Confirm Delete
              </h3>
            </div>
            
            <p className={`mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? 
              This action cannot be undone.
            </p>

            <div className="mb-4">
              <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Type DELETE to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-red-500`}
                placeholder="DELETE"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteConfirmText('')
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                  theme === 'dark'
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Wrapper component that handles mounting before using Alchemy hooks
export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Show loading until mounted (Alchemy provider needs to be ready)
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-mint" />
      </div>
    )
  }

  return <AdminDashboardContent />
}
