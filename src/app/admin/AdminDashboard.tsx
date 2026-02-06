'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAccount } from '@account-kit/react'
import {
  Users,
  FileText,
  ClipboardList,
  ClipboardCheck,
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
  X,
  Eye,
  Code,
  FolderGit2,
  Github,
  ExternalLink,
} from 'lucide-react'
import AdminResetWallet from '@/components/admin/AdminResetWallet'
import dynamic from 'next/dynamic'

const TBackendSetup = dynamic(
  () => import('@/components/admin/TBackendSetup'),
  {
    ssr: false,
  }
)

type TabId =
  | 'users'
  | 'dotApps'
  | 'profiles'
  | 'resumes'
  | 'devProfiles'
  | 'devProjects'
  | 'verifications'
  | 'tools'

interface User {
  id: string
  wallet_address: string
  email: string | null
  name: string | null
  displayName: string | null // From driver_profiles first/last name
  displayEmail: string | null // From driver_profiles or users.email
  role: string | null
  is_active: boolean
  created_at: string
  hasProfile: boolean
  hasDevProfile: boolean
  resumeCount: number
  dotAppCount: number
  devProjectCount: number
  isAdmin: boolean // True if wallet is in ADMIN_WALLETS
}

// Developer profile for admin view
interface DevProfile {
  id: string
  user_id: string
  email: string | null
  full_name: string | null
  headline: string | null
  github_username: string | null
  skills: Array<{ name: string; category?: string }> | null
  available_for_work: boolean
  created_at: string
  updated_at: string
  walletAddress: string
  projectCount: number
  skillCount: number
}

// Developer project for admin view
interface DevProject {
  id: string
  user_id: string
  developer_profile_id: string | null
  name: string
  description: string | null
  tech_stack: string[] | null
  live_url: string | null
  repo_url: string | null
  is_featured: boolean
  is_public: boolean
  role: string | null
  created_at: string
  updated_at: string
  walletAddress: string
  ownerName: string
  techCount: number
}

// User detail data when viewing a specific user
interface UserDetail {
  user: User
  profile: Profile | null
  devProfile: DevProfile | null
  devProjects: DevProject[]
  resumes: Resume[]
  dotApps: DotApp[]
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

interface VerificationRow {
  id: string
  driverId: string
  applicantWallet: string | null
  employmentId: string
  initiatedBy: string
  applicantType: string
  previousEmployerName: string
  previousEmployerEmail: string | null
  claimedPosition: string
  claimedStartDate: string | null
  claimedEndDate: string | null
  status: string
  attemptCount: number
  createdAt: string
}

interface Profile {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  cdl_number: string | null
  cdl_state: string | null
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
  const [devProfiles, setDevProfiles] = useState<DevProfile[]>([])
  const [devProjects, setDevProjects] = useState<DevProject[]>([])
  const [verifications, setVerifications] = useState<VerificationRow[]>([])

  // Pagination
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    type: string
    id: string
    name: string
  } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // User detail view
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [loadingUserDetail, setLoadingUserDetail] = useState(false)

  // Fetch user detail when user is selected
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
          // Find the user from our list to include admin status and dev profile info
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

  // Check admin status
  useEffect(() => {
    if (walletAddress) {
      fetch('/api/admin/users?limit=1', {
        headers: { 'x-wallet-address': walletAddress },
      })
        .then((res) => {
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

        case 'devProfiles':
          response = await fetch(
            `/api/admin/dev-profiles?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setDevProfiles(data.profiles)
            setTotalCount(data.total)
          }
          break

        case 'devProjects':
          response = await fetch(
            `/api/admin/dev-projects?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setDevProjects(data.projects)
            setTotalCount(data.total)
          }
          break

        case 'verifications':
          response = await fetch(
            `/api/admin/verifications?limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setVerifications(data.verifications)
            setTotalCount(data.total ?? data.verifications?.length ?? 0)
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
    if (!deleteTarget || deleteConfirmText !== 'DELETE' || !walletAddress)
      return

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
        case 'devProfile':
          endpoint = `/api/admin/dev-profiles/${deleteTarget.id}`
          break
        case 'devProject':
          endpoint = `/api/admin/dev-projects/${deleteTarget.id}`
          break
        case 'verification':
          endpoint = `/api/admin/verifications/${deleteTarget.id}`
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
    { id: 'users', label: 'Users', icon: <Users className='w-4 h-4' /> },
    {
      id: 'dotApps',
      label: 'DOT Apps',
      icon: <ClipboardList className='w-4 h-4' />,
    },
    {
      id: 'profiles',
      label: 'Driver Profiles',
      icon: <UserCircle className='w-4 h-4' />,
    },
    { id: 'resumes', label: 'Resumes', icon: <FileText className='w-4 h-4' /> },
    {
      id: 'devProfiles',
      label: 'Dev Profiles',
      icon: <Code className='w-4 h-4' />,
    },
    {
      id: 'devProjects',
      label: 'Projects',
      icon: <FolderGit2 className='w-4 h-4' />,
    },
    {
      id: 'verifications',
      label: 'Verifications',
      icon: <ClipboardCheck className='w-4 h-4' />,
    },
    { id: 'tools', label: 'Tools', icon: <Settings className='w-4 h-4' /> },
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
      <div className='min-h-screen flex items-center justify-center p-8'>
        <div className={`${cardClass} p-8 text-center max-w-md`}>
          <AlertTriangle className='w-12 h-12 mx-auto mb-4 text-yellow-500' />
          <h2
            className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            Access Denied
          </h2>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Your wallet is not authorized to access the admin panel.
          </p>
          {walletAddress && (
            <p
              className={`mt-4 text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
            >
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
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='w-8 h-8 animate-spin text-brand-mint mx-auto mb-4' />
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            {walletAddress
              ? 'Checking admin access...'
              : 'Waiting for wallet connection...'}
          </p>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className='min-h-screen p-4 md:p-8'>
      <div className='max-w-7xl mx-auto space-y-6'>
        {/* Header */}
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
          <div>
            <h1
              className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Admin Panel
            </h1>
            <p
              className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Manage users, applications, and system settings
            </p>
          </div>
          <div
            className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
          >
            {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
          </div>
        </div>

        {/* Tabs */}
        <div className={`${cardClass} p-1 flex flex-wrap gap-1`}>
          {tabs.map((tab) => (
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
              <span className='hidden sm:inline'>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search & Refresh (not for tools tab) */}
        {activeTab !== 'tools' && (
          <div className='flex flex-col sm:flex-row gap-3'>
            <div className='relative flex-1'>
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`}
              />
              <input
                type='text'
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder='Search...'
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
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div
            className={`p-4 rounded-lg ${
              theme === 'dark'
                ? 'bg-red-900/30 text-red-400'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {error}
          </div>
        )}

        {/* Content */}
        <div className={cardClass}>
          {activeTab === 'tools' ? (
            <div className='p-6 space-y-8'>
              <AdminResetWallet initialWalletAddress={walletAddress || ''} />
              <TBackendSetup />
            </div>
          ) : loading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='w-8 h-8 animate-spin text-brand-mint' />
            </div>
          ) : (
            <>
              {/* Users Table */}
              {activeTab === 'users' && (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead
                      className={
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }
                    >
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Wallet
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Name/Email
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Role
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Data
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Created
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {users.map((user) => (
                        <tr
                          key={user.id}
                          className={`cursor-pointer ${theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}
                          onClick={() => fetchUserDetail(user.id)}
                        >
                          <td className={tableCellClass}>
                            <code className='text-xs'>
                              {user.wallet_address.slice(0, 8)}...
                              {user.wallet_address.slice(-6)}
                            </code>
                          </td>
                          <td className={tableCellClass}>
                            <div
                              className={user.displayName ? '' : 'opacity-50'}
                            >
                              {user.displayName || 'No name'}
                            </div>
                            <div className='text-xs opacity-60'>
                              {user.displayEmail || '-'}
                            </div>
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
                                  user.role === 'driver'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
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
                                  Driver
                                </span>
                              )}
                              {user.hasDevProfile && (
                                <span className='px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'>
                                  Dev
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
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td
                            className={tableCellClass}
                            onClick={(e) => e.stopPropagation()}
                          >
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
                                  setDeleteTarget({
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
              )}

              {/* DOT Apps Table */}
              {activeTab === 'dotApps' && (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead
                      className={
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }
                    >
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Applicant
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Wallet
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Status
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Step
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Created
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {dotApps.map((app) => (
                        <tr
                          key={app.id}
                          className={
                            theme === 'dark'
                              ? 'hover:bg-gray-800/50'
                              : 'hover:bg-gray-50'
                          }
                        >
                          <td className={tableCellClass}>
                            {app.applicantName}
                          </td>
                          <td className={tableCellClass}>
                            <code className='text-xs'>
                              {app.walletAddress.slice(0, 8)}...
                            </code>
                          </td>
                          <td className={tableCellClass}>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                app.is_complete
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}
                            >
                              {app.is_complete ? 'Complete' : 'In Progress'}
                            </span>
                          </td>
                          <td className={tableCellClass}>
                            Step {app.current_step}
                          </td>
                          <td className={tableCellClass}>
                            {new Date(app.created_at).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              onClick={() =>
                                setDeleteTarget({
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
              )}

              {/* Profiles Table */}
              {activeTab === 'profiles' && (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead
                      className={
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }
                    >
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Name
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Wallet
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>CDL</th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Source
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Updated
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Actions
                        </th>
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
                            <code className='text-xs'>
                              {profile.walletAddress.slice(0, 8)}...
                            </code>
                          </td>
                          <td className={tableCellClass}>
                            {profile.cdl_number || '-'}
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
                                setDeleteTarget({
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
              )}

              {/* Resumes Table */}
              {activeTab === 'resumes' && (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead
                      className={
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }
                    >
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Title
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Owner
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Type
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Status
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Created
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {resumes.map((resume) => (
                        <tr
                          key={resume.id}
                          className={
                            theme === 'dark'
                              ? 'hover:bg-gray-800/50'
                              : 'hover:bg-gray-50'
                          }
                        >
                          <td className={tableCellClass}>
                            {resume.title || resume.filename || 'Untitled'}
                          </td>
                          <td className={tableCellClass}>{resume.ownerName}</td>
                          <td className={tableCellClass}>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                resume.resume_type === 'built'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : resume.resume_type === 'developer_built'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                              }`}
                            >
                              {resume.resume_type === 'built'
                                ? 'Driver Resume'
                                : resume.resume_type === 'developer_built'
                                  ? 'Developer Resume'
                                  : 'Uploaded'}
                            </span>
                          </td>
                          <td className={tableCellClass}>
                            {resume.verification_status === 'VERIFIED' ? (
                              <CheckCircle className='w-4 h-4 text-green-500' />
                            ) : (
                              <span className='text-xs opacity-75'>
                                {resume.verification_status}
                              </span>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            {new Date(resume.created_at).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'resume',
                                  id: resume.id,
                                  name:
                                    resume.title || resume.filename || 'resume',
                                })
                              }
                              className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                              title='Delete resume'
                            >
                              <Trash2 className='w-4 h-4' />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {resumes.length === 0 && (
                    <div className='text-center py-12 text-gray-500'>
                      No resumes found
                    </div>
                  )}
                </div>
              )}

              {/* Dev Profiles Table */}
              {activeTab === 'devProfiles' && (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead
                      className={
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }
                    >
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Name
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          GitHub
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Headline
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Data
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Status
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Updated
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {devProfiles.map((profile) => (
                        <tr
                          key={profile.id}
                          className={
                            theme === 'dark'
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
                            {profile.github_username ? (
                              <div className='flex items-center gap-1'>
                                <Github className='w-3 h-3 opacity-60' />
                                <span className='text-xs'>
                                  @{profile.github_username}
                                </span>
                              </div>
                            ) : (
                              <span className='text-xs opacity-50'>-</span>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            <span className='text-xs line-clamp-1'>
                              {profile.headline || '-'}
                            </span>
                          </td>
                          <td className={tableCellClass}>
                            <div className='flex gap-1 text-xs'>
                              {profile.skillCount > 0 && (
                                <span className='px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'>
                                  {profile.skillCount} skill
                                  {profile.skillCount > 1 ? 's' : ''}
                                </span>
                              )}
                              {profile.projectCount > 0 && (
                                <span className='px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'>
                                  {profile.projectCount} project
                                  {profile.projectCount > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            {profile.available_for_work ? (
                              <span className='px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>
                                Available
                              </span>
                            ) : (
                              <span className='px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'>
                                Not looking
                              </span>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            {new Date(profile.updated_at).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              onClick={() =>
                                setDeleteTarget({
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
              )}

              {/* Dev Projects Table */}
              {activeTab === 'devProjects' && (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead
                      className={
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }
                    >
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Project
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Owner
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Tech Stack
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Links
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Status
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Created
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {devProjects.map((project) => (
                        <tr
                          key={project.id}
                          className={
                            theme === 'dark'
                              ? 'hover:bg-gray-800/50'
                              : 'hover:bg-gray-50'
                          }
                        >
                          <td className={tableCellClass}>
                            <div className='font-medium'>{project.name}</div>
                            <div className='text-xs opacity-60 line-clamp-1'>
                              {project.description || '-'}
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            {project.ownerName}
                          </td>
                          <td className={tableCellClass}>
                            <div className='flex flex-wrap gap-1'>
                              {project.tech_stack
                                ?.slice(0, 3)
                                .map((tech, i) => (
                                  <span
                                    key={i}
                                    className='px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                  >
                                    {tech}
                                  </span>
                                ))}
                              {(project.techCount || 0) > 3 && (
                                <span className='text-xs opacity-60'>
                                  +{project.techCount - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            <div className='flex gap-2'>
                              {project.live_url && (
                                <a
                                  href={project.live_url}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='text-brand-mint hover:underline'
                                >
                                  <ExternalLink className='w-4 h-4' />
                                </a>
                              )}
                              {project.repo_url && (
                                <a
                                  href={project.repo_url}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='opacity-60 hover:opacity-100'
                                >
                                  <Github className='w-4 h-4' />
                                </a>
                              )}
                              {!project.live_url && !project.repo_url && (
                                <span className='text-xs opacity-50'>-</span>
                              )}
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            <div className='flex gap-1'>
                              {project.is_featured && (
                                <span className='px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'>
                                  Featured
                                </span>
                              )}
                              {project.is_public ? (
                                <span className='px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>
                                  Public
                                </span>
                              ) : (
                                <span className='px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'>
                                  Private
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            {new Date(project.created_at).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'devProject',
                                  id: project.id,
                                  name: project.name,
                                })
                              }
                              className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                              title='Delete project'
                            >
                              <Trash2 className='w-4 h-4' />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {devProjects.length === 0 && (
                    <div className='text-center py-12 text-gray-500'>
                      No developer projects found
                    </div>
                  )}
                </div>
              )}

              {/* Verifications Table */}
              {activeTab === 'verifications' && (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead
                      className={
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }
                    >
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Applicant
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Type
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Previous employer
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Position
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Status
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Created
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {verifications.map((v) => (
                        <tr
                          key={v.id}
                          className={
                            theme === 'dark'
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
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                v.applicantType === 'developer'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}
                            >
                              {v.applicantType}
                            </span>
                            {v.initiatedBy === 'applicant' && (
                              <span className='ml-1 text-xs opacity-75'>
                                (self)
                              </span>
                            )}
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
                            {new Date(v.createdAt).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              onClick={() =>
                                setDeleteTarget({
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
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className='flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700'>
                  <div
                    className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    Page {currentPage} of {totalPages} ({totalCount} total)
                  </div>
                  <div className='flex gap-2'>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`p-2 rounded ${
                        theme === 'dark'
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-100'
                      } disabled:opacity-50`}
                    >
                      <ChevronLeft className='w-4 h-4' />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded ${
                        theme === 'dark'
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-100'
                      } disabled:opacity-50`}
                    >
                      <ChevronRight className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* User Detail Modal */}
      {(selectedUser || loadingUserDetail) && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'>
          <div
            className={`rounded-xl border ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            } p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto`}
          >
            {loadingUserDetail ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 animate-spin text-brand-mint' />
              </div>
            ) : (
              selectedUser && (
                <>
                  {/* Header */}
                  <div className='flex items-center justify-between mb-6'>
                    <div>
                      <h3
                        className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                      >
                        {selectedUser.user.displayName || 'Unnamed User'}
                        {selectedUser.user.isAdmin && (
                          <span className='ml-2 px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-semibold'>
                            Admin
                          </span>
                        )}
                      </h3>
                      <p
                        className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                      >
                        <code>{selectedUser.user.wallet_address}</code>
                      </p>
                      {selectedUser.user.displayEmail && (
                        <p
                          className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                        >
                          {selectedUser.user.displayEmail}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    >
                      <X className='w-5 h-5' />
                    </button>
                  </div>

                  {/* Profile Section */}
                  {selectedUser.profile && (
                    <div className='mb-6'>
                      <div className='flex items-center justify-between mb-3'>
                        <h4
                          className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                        >
                          Driver Profile
                        </h4>
                        {!selectedUser.user.isAdmin && (
                          <button
                            onClick={() => {
                              setSelectedUser(null)
                              setDeleteTarget({
                                type: 'profile',
                                id: selectedUser.profile!.id,
                                name: `${selectedUser.user.displayName}'s profile`,
                              })
                            }}
                            className='text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                          >
                            Delete Profile
                          </button>
                        )}
                      </div>
                      <div
                        className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                      >
                        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                          <div>
                            <span className='opacity-60'>CDL:</span>{' '}
                            {selectedUser.profile.cdl_number || '-'}
                          </div>
                          <div>
                            <span className='opacity-60'>State:</span>{' '}
                            {selectedUser.profile.cdl_state || '-'}
                          </div>
                          <div>
                            <span className='opacity-60'>Phone:</span>{' '}
                            {selectedUser.profile.phone || '-'}
                          </div>
                          <div>
                            <span className='opacity-60'>Updated:</span>{' '}
                            {selectedUser.profile.updated_at
                              ? new Date(
                                  selectedUser.profile.updated_at
                                ).toLocaleDateString()
                              : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DOT Applications */}
                  <div className='mb-6'>
                    <h4
                      className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                    >
                      DOT Applications ({selectedUser.dotApps.length})
                    </h4>
                    {selectedUser.dotApps.length === 0 ? (
                      <p
                        className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                      >
                        No DOT applications
                      </p>
                    ) : (
                      <div className='space-y-2'>
                        {selectedUser.dotApps.map((app) => (
                          <div
                            key={app.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                          >
                            <div className='flex items-center gap-3'>
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  app.is_complete
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}
                              >
                                {app.is_complete
                                  ? 'Complete'
                                  : `Step ${app.current_step}`}
                              </span>
                              <span className='text-sm'>
                                {new Date(app.created_at).toLocaleDateString()}
                              </span>
                              <span
                                className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                              >
                                {app.verification_status}
                              </span>
                            </div>
                            {!selectedUser.user.isAdmin && (
                              <button
                                onClick={() => {
                                  setSelectedUser(null)
                                  setDeleteTarget({
                                    type: 'dotApp',
                                    id: app.id,
                                    name: `DOT application from ${new Date(app.created_at).toLocaleDateString()}`,
                                  })
                                }}
                                className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                              >
                                <Trash2 className='w-4 h-4' />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Resumes */}
                  <div className='mb-6'>
                    <h4
                      className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                    >
                      Resumes ({selectedUser.resumes.length})
                    </h4>
                    {selectedUser.resumes.length === 0 ? (
                      <p
                        className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                      >
                        No resumes
                      </p>
                    ) : (
                      <div className='space-y-2'>
                        {selectedUser.resumes.map((resume) => (
                          <div
                            key={resume.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                          >
                            <div className='flex items-center gap-3'>
                              <FileText className='w-4 h-4 opacity-60' />
                              <span className='text-sm'>
                                {resume.title || resume.filename || 'Untitled'}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  resume.resume_type === 'built'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                    : resume.resume_type === 'developer_built'
                                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                                }`}
                              >
                                {resume.resume_type === 'built'
                                  ? 'Driver Resume'
                                  : resume.resume_type === 'developer_built'
                                    ? 'Developer Resume'
                                    : 'Uploaded'}
                              </span>
                              {resume.verification_status === 'VERIFIED' && (
                                <CheckCircle className='w-4 h-4 text-green-500' />
                              )}
                            </div>
                            {!selectedUser.user.isAdmin && (
                              <button
                                onClick={() => {
                                  setSelectedUser(null)
                                  setDeleteTarget({
                                    type: 'resume',
                                    id: resume.id,
                                    name:
                                      resume.title ||
                                      resume.filename ||
                                      'resume',
                                  })
                                }}
                                className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                              >
                                <Trash2 className='w-4 h-4' />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Developer Profile */}
                  {selectedUser.devProfile && (
                    <div className='mb-6'>
                      <div className='flex items-center justify-between mb-3'>
                        <h4
                          className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                        >
                          <Code className='w-4 h-4 text-teal-500' />
                          Developer Profile
                        </h4>
                        {!selectedUser.user.isAdmin && (
                          <button
                            onClick={() => {
                              setSelectedUser(null)
                              setDeleteTarget({
                                type: 'devProfile',
                                id: selectedUser.devProfile!.id,
                                name: `${selectedUser.user.displayName}'s developer profile`,
                              })
                            }}
                            className='text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                          >
                            Delete Dev Profile
                          </button>
                        )}
                      </div>
                      <div
                        className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                      >
                        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                          <div>
                            <span className='opacity-60'>Name:</span>{' '}
                            {selectedUser.devProfile.full_name || '-'}
                          </div>
                          <div>
                            <span className='opacity-60'>GitHub:</span>{' '}
                            {selectedUser.devProfile.github_username ? (
                              <a
                                href={`https://github.com/${selectedUser.devProfile.github_username}`}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-brand-mint hover:underline'
                              >
                                @{selectedUser.devProfile.github_username}
                              </a>
                            ) : (
                              '-'
                            )}
                          </div>
                          <div className='col-span-2'>
                            <span className='opacity-60'>Headline:</span>{' '}
                            {selectedUser.devProfile.headline || '-'}
                          </div>
                        </div>
                        {selectedUser.devProfile.skills &&
                          selectedUser.devProfile.skills.length > 0 && (
                            <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-600'>
                              <span className='text-xs opacity-60'>
                                Skills:
                              </span>
                              <div className='flex flex-wrap gap-1 mt-1'>
                                {selectedUser.devProfile.skills
                                  .slice(0, 10)
                                  .map((skill, i) => (
                                    <span
                                      key={i}
                                      className='px-2 py-0.5 rounded text-xs bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
                                    >
                                      {typeof skill === 'string'
                                        ? skill
                                        : skill.name}
                                    </span>
                                  ))}
                                {selectedUser.devProfile.skills.length > 10 && (
                                  <span className='text-xs opacity-60'>
                                    +
                                    {selectedUser.devProfile.skills.length - 10}{' '}
                                    more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Developer Projects */}
                  {selectedUser.devProjects &&
                    selectedUser.devProjects.length > 0 && (
                      <div className='mb-6'>
                        <h4
                          className={`font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                        >
                          <FolderGit2 className='w-4 h-4 text-cyan-500' />
                          Developer Projects ({selectedUser.devProjects.length})
                        </h4>
                        <div className='space-y-2'>
                          {selectedUser.devProjects.map((project) => (
                            <div
                              key={project.id}
                              className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                            >
                              <div className='flex-1'>
                                <div className='flex items-center gap-2'>
                                  <span className='text-sm font-medium'>
                                    {project.name}
                                  </span>
                                  {project.is_featured && (
                                    <span className='px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'>
                                      Featured
                                    </span>
                                  )}
                                  {project.is_public ? (
                                    <span className='px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>
                                      Public
                                    </span>
                                  ) : (
                                    <span className='px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'>
                                      Private
                                    </span>
                                  )}
                                </div>
                                {project.tech_stack &&
                                  project.tech_stack.length > 0 && (
                                    <div className='flex flex-wrap gap-1 mt-1'>
                                      {project.tech_stack
                                        .slice(0, 5)
                                        .map((tech, i) => (
                                          <span
                                            key={i}
                                            className='px-1 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                          >
                                            {tech}
                                          </span>
                                        ))}
                                    </div>
                                  )}
                              </div>
                              <div className='flex items-center gap-2'>
                                {project.live_url && (
                                  <a
                                    href={project.live_url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-brand-mint hover:underline'
                                  >
                                    <ExternalLink className='w-4 h-4' />
                                  </a>
                                )}
                                {project.repo_url && (
                                  <a
                                    href={project.repo_url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='opacity-60 hover:opacity-100'
                                  >
                                    <Github className='w-4 h-4' />
                                  </a>
                                )}
                                {!selectedUser.user.isAdmin && (
                                  <button
                                    onClick={() => {
                                      setSelectedUser(null)
                                      setDeleteTarget({
                                        type: 'devProject',
                                        id: project.id,
                                        name: project.name,
                                      })
                                    }}
                                    className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                                  >
                                    <Trash2 className='w-4 h-4' />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Delete All User Data Button */}
                  {!selectedUser.user.isAdmin && (
                    <div className='pt-4 border-t border-gray-200 dark:border-gray-700'>
                      <button
                        onClick={() => {
                          setSelectedUser(null)
                          setDeleteTarget({
                            type: 'user',
                            id: selectedUser.user.id,
                            name:
                              selectedUser.user.displayName ||
                              selectedUser.user.wallet_address,
                          })
                        }}
                        className='w-full px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700'
                      >
                        Delete User and All Data
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'>
          <div
            className={`rounded-xl border ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            } p-6 max-w-md w-full`}
          >
            <div className='flex items-center gap-3 mb-4'>
              <div className='p-2 rounded-full bg-red-100 dark:bg-red-900/30'>
                <AlertTriangle className='w-6 h-6 text-red-500' />
              </div>
              <h3
                className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                Confirm Delete
              </h3>
            </div>

            <p
              className={`mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
            >
              Are you sure you want to delete{' '}
              <strong>{deleteTarget.name}</strong>? This action cannot be
              undone.
            </p>

            <div className='mb-4'>
              <label
                className={`block text-sm mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Type DELETE to confirm
              </label>
              <input
                type='text'
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-red-500`}
                placeholder='DELETE'
              />
            </div>

            <div className='flex gap-3'>
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
                className='flex-1 px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {deleting ? (
                  <Loader2 className='w-4 h-4 animate-spin mx-auto' />
                ) : (
                  'Delete'
                )}
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
      <div className='min-h-screen flex items-center justify-center'>
        <Loader2 className='w-8 h-8 animate-spin text-brand-mint' />
      </div>
    )
  }

  return <AdminDashboardContent />
}
