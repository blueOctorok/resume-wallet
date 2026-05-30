'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useWalletAddress } from '@/stores/auth-store'
import {
  Users,
  FileText,
  ClipboardList,
  ClipboardCheck,
  UserCircle,
  Settings,
  Search,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  Car,
  ShieldCheck,
  Building2,
  Briefcase,
  UserPlus,
  Send,
} from 'lucide-react'
import type { TabId, SidebarSection, DeleteTarget } from './admin-types'
import { getCardClass } from './admin-styles'

import AccessRequestsTab from './tabs/AccessRequestsTab'
import CompaniesTab from './tabs/CompaniesTab'
import JobsTab from './tabs/JobsTab'
import ApplicationsTab from './tabs/ApplicationsTab'
import OutreachTab from './tabs/OutreachTab'
import BgcheckRequestsTab from './tabs/BgcheckRequestsTab'
import CandidatesTab from './tabs/CandidatesTab'
import DotAppsTab from './tabs/DotAppsTab'
import ResumesTab from './tabs/ResumesTab'
import MvrTab from './tabs/MvrTab'
import PspTab from './tabs/PspTab'
import VerificationsTab from './tabs/VerificationsTab'
import DevProjectsTab from './tabs/DevProjectsTab'
import UsersTab from './tabs/UsersTab'
import ToolsTab from './tabs/ToolsTab'
import DeleteConfirmModal from './modals/DeleteConfirmModal'
import CreateCompanyModal from './modals/CreateCompanyModal'

function AdminDashboardContent() {
  const { theme } = useTheme()
  /** Admin tabs/modals only branch on dark vs not-dark; paper/icy use the light styling path. */
  const adminUiTheme: 'light' | 'dark' = isDarkTheme(theme) ? 'dark' : 'light'

  // Admin identity now comes from the synced Supabase session (auth-store is
  // persisted, so the boss's DB wallet survives navigating from / to /admin).
  // The boss's DB wallet is in ADMIN_WALLETS, so requireAdmin still gates every
  // admin route on the x-wallet-address header. Proper email/role allowlist is
  // future work (T1.8-admin).
  const walletAddress = useWalletAddress() ?? undefined

  const [activeTab, setActiveTab] = useState<TabId>('users')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Create company modal
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false)

  // Badge counts for sidebar
  const [accessRequestsBadge, setAccessRequestsBadge] = useState(0)
  const [companyPendingBadge, setCompanyPendingBadge] = useState(0)

  // A key that increments to force tab re-fetch after delete or create
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch sidebar badge counts
  const fetchBadgeCounts = useCallback(async () => {
    if (!walletAddress || !isAdmin) return
    try {
      const [reqRes, compRes] = await Promise.all([
        fetch('/api/admin/employer-requests?status=all', {
          headers: { 'x-wallet-address': walletAddress },
        }),
        fetch('/api/admin/companies?status=all', {
          headers: { 'x-wallet-address': walletAddress },
        }),
      ])
      const reqData = await reqRes.json()
      if (reqData.success && reqData.stats) {
        setAccessRequestsBadge((reqData.stats.pending || 0) + (reqData.stats.flagged || 0))
      }
      const compData = await compRes.json()
      if (compData.success && compData.stats) {
        setCompanyPendingBadge(compData.stats.pending || 0)
      }
    } catch {
      // Badge counts are non-critical
    }
  }, [walletAddress, isAdmin])

  useEffect(() => {
    if (isAdmin) fetchBadgeCounts()
  }, [isAdmin, fetchBadgeCounts])

  // Check admin status
  useEffect(() => {
    if (walletAddress) {
      fetch('/api/admin/users?limit=1', {
        headers: { 'x-wallet-address': walletAddress },
      })
        .then((res) => setIsAdmin(res.ok))
        .catch(() => setIsAdmin(false))
    } else {
      setIsAdmin(null)
    }
  }, [walletAddress])

  // Handle delete — supports force-delete for admin wallets (prompts confirmation)
  const handleDelete = async () => {
    if (!deleteTarget || !walletAddress) return

    setDeleting(true)
    setDeleteError(null)
    try {
      const endpointMap: Record<string, string> = {
        user: `/api/admin/users/${deleteTarget.id}`,
        dotApp: `/api/admin/dot-apps/${deleteTarget.id}`,
        profile: `/api/admin/profiles/${deleteTarget.id}`,
        resume: `/api/admin/resumes/${deleteTarget.id}`,
        devProfile: `/api/admin/dev-profiles/${deleteTarget.id}`,
        devProject: `/api/admin/dev-projects/${deleteTarget.id}`,
        verification: `/api/admin/verifications/${deleteTarget.id}`,
        mvr: `/api/admin/mvr/${deleteTarget.id}`,
        psp: `/api/admin/psp/${deleteTarget.id}`,
        bgcheckRequest: `/api/admin/bgcheck-requests/${deleteTarget.id}`,
        application: `/api/admin/applications/${deleteTarget.id}`,
        outreach: `/api/admin/outreach/${deleteTarget.id}`,
      }
      const endpoint = endpointMap[deleteTarget.type]
      if (!endpoint) return

      const headers: Record<string, string> = { 'x-wallet-address': walletAddress }

      const response = await fetch(endpoint, { method: 'DELETE', headers })

      if (response.ok) {
        setDeleteTarget(null)
        setDeleteError(null)
        setRefreshKey((k) => k + 1)
      } else {
        const data = await response.json().catch(() => ({}))
        setDeleteError(data.error || 'Delete failed. Please try again.')
      }
    } catch {
      setDeleteError('Network error. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const cardClass = getCardClass(adminUiTheme)

  const sidebarSections: SidebarSection[] = [
    {
      id: 'employers',
      label: 'Employers',
      tabs: [
        {
          id: 'accessRequests',
          label: `Access Requests${accessRequestsBadge > 0 ? ` (${accessRequestsBadge})` : ''}`,
          icon: <UserPlus className='w-4 h-4' />,
        },
        {
          id: 'companies',
          label: `Companies${companyPendingBadge > 0 ? ` (${companyPendingBadge})` : ''}`,
          icon: <Building2 className='w-4 h-4' />,
        },
        { id: 'jobs', label: 'Job Postings', icon: <Briefcase className='w-4 h-4' /> },
        { id: 'applications', label: 'Applications', icon: <ClipboardList className='w-4 h-4' /> },
        { id: 'outreach', label: 'Candidate Outreach', icon: <Send className='w-4 h-4' /> },
        { id: 'bgcheckRequests', label: 'Background Checks', icon: <ClipboardCheck className='w-4 h-4' /> },
      ],
    },
    {
      id: 'candidates',
      label: 'Candidates',
      tabs: [
        { id: 'candidates', label: 'All Candidates', icon: <UserCircle className='w-4 h-4' /> },
        { id: 'dotApps', label: 'DOT Apps', icon: <ClipboardList className='w-4 h-4' /> },
        { id: 'resumes', label: 'Resumes', icon: <FileText className='w-4 h-4' /> },
        { id: 'mvr', label: 'MVR Orders', icon: <Car className='w-4 h-4' /> },
        { id: 'psp', label: 'PSP Orders', icon: <ShieldCheck className='w-4 h-4' /> },
        { id: 'verifications', label: 'Verifications', icon: <ClipboardCheck className='w-4 h-4' /> },
        { id: 'devProjects', label: 'Projects', icon: <FolderGit2 className='w-4 h-4' /> },
      ],
    },
    {
      id: 'system',
      label: 'System',
      tabs: [
        { id: 'users', label: 'All Users', icon: <Users className='w-4 h-4' /> },
        { id: 'tools', label: 'Tools', icon: <Settings className='w-4 h-4' /> },
      ],
    },
  ]

  // Access denied
  if (isAdmin === false) {
    return (
      <div className='min-h-screen flex items-center justify-center p-8'>
        <div className={`${cardClass} p-8 text-center max-w-md`}>
          <AlertTriangle className='w-12 h-12 mx-auto mb-4 text-yellow-500' />
          <h2 className={`text-xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            Access Denied
          </h2>
          <p className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}>
            Your wallet is not authorized to access the admin panel.
          </p>
          {walletAddress && (
            <p className={`mt-4 text-xs font-mono ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
              {walletAddress}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Loading / checking
  if (isAdmin === null) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='w-8 h-8 animate-spin text-indigo-400 mx-auto mb-4' />
          <p className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}>
            {walletAddress ? 'Checking admin access...' : 'Waiting for wallet connection...'}
          </p>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  const tabProps = {
    theme: adminUiTheme,
    walletAddress: walletAddress || '',
    searchQuery,
    currentPage,
    pageSize,
    setTotalCount,
    onDelete: setDeleteTarget,
  }

  function renderActiveTab() {
    switch (activeTab) {
      case 'accessRequests':
        return <AccessRequestsTab key={refreshKey} {...tabProps} />
      case 'companies':
        return (
          <CompaniesTab
            key={refreshKey}
            {...tabProps}
            onCreateCompany={() => setShowCreateCompanyModal(true)}
          />
        )
      case 'jobs':
        return <JobsTab key={refreshKey} {...tabProps} />
      case 'applications':
        return <ApplicationsTab key={refreshKey} {...tabProps} />
      case 'outreach':
        return <OutreachTab key={refreshKey} {...tabProps} />
      case 'bgcheckRequests':
        return <BgcheckRequestsTab key={refreshKey} {...tabProps} />
      case 'candidates':
        return <CandidatesTab key={refreshKey} {...tabProps} />
      case 'dotApps':
        return <DotAppsTab key={refreshKey} {...tabProps} />
      case 'resumes':
        return <ResumesTab key={refreshKey} {...tabProps} />
      case 'mvr':
        return <MvrTab key={refreshKey} {...tabProps} />
      case 'psp':
        return <PspTab key={refreshKey} {...tabProps} />
      case 'verifications':
        return <VerificationsTab key={refreshKey} {...tabProps} />
      case 'devProjects':
        return <DevProjectsTab key={refreshKey} {...tabProps} />
      case 'users':
        return <UsersTab key={refreshKey} {...tabProps} />
      case 'tools':
        return <ToolsTab theme={adminUiTheme} walletAddress={walletAddress || ''} />
      default:
        return null
    }
  }

  return (
    <div className='min-h-screen flex'>
      {/* Sidebar */}
      <aside
        className={`w-64 flex-shrink-0 border-r ${
          isDarkTheme(theme) ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className='sticky top-0 h-screen overflow-y-auto'>
          <div className={`p-4 border-b ${isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'}`}>
            <h1 className={`text-xl font-bold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
              Central Admin
            </h1>
            <p className={`text-xs mt-1 font-mono ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
              {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
            </p>
          </div>

          <nav className='p-3 space-y-4'>
            {sidebarSections.map((section) => (
              <div key={section.id}>
                <h2
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                    isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  {section.label}
                </h2>
                <div className='space-y-1'>
                  {section.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id)
                        setCurrentPage(1)
                        setSearchQuery('')
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? isDarkTheme(theme)
                            ? 'bg-teal-500 text-gray-900'
                            : 'bg-teal-600 text-white'
                          : isDarkTheme(theme)
                            ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className='flex-1 min-w-0 p-6'>
        <div className='max-w-6xl mx-auto space-y-6'>
          {/* Page Header */}
          <div>
            <h2 className={`text-2xl font-bold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
              {sidebarSections.flatMap((s) => s.tabs).find((t) => t.id === activeTab)?.label || 'Admin'}
            </h2>
          </div>

          {/* Search & Refresh */}
          {activeTab !== 'tools' && (
            <div className='flex flex-col sm:flex-row gap-3'>
              <div className='relative flex-1'>
                <Search
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'
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
                    isDarkTheme(theme)
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-teal-500`}
                />
              </div>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  isDarkTheme(theme)
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <RefreshCw className='w-4 h-4' />
                Refresh
              </button>
            </div>
          )}

          {/* Tab Content */}
          <div className={cardClass}>{renderActiveTab()}</div>

          {/* Pagination */}
          {activeTab !== 'tools' && totalPages > 1 && (
            <div className='flex items-center justify-between'>
              <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                Page {currentPage} of {totalPages} ({totalCount} total)
              </p>
              <div className='flex gap-2'>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg ${
                    isDarkTheme(theme)
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <ChevronLeft className='w-4 h-4' />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg ${
                    isDarkTheme(theme)
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <ChevronRight className='w-4 h-4' />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Shared Modals */}
      <DeleteConfirmModal
        theme={adminUiTheme}
        target={deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(null) }}
        onConfirm={handleDelete}
        deleting={deleting}
        error={deleteError}
      />

      <CreateCompanyModal
        theme={adminUiTheme}
        walletAddress={walletAddress || ''}
        open={showCreateCompanyModal}
        onClose={() => setShowCreateCompanyModal(false)}
        onCreated={() => {
          setShowCreateCompanyModal(false)
          setRefreshKey((k) => k + 1)
          fetchBadgeCounts()
        }}
      />
    </div>
  )
}

export default function AdminDashboardShell() {
  const [mounted, setMounted] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <Loader2 className='w-8 h-8 animate-spin text-indigo-400' />
      </div>
    )
  }

  return <AdminDashboardContent />
}
