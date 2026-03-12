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
  Car,
  Building2,
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  UserPlus,
  Send,
  Mail,
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
  | 'companies'
  | 'accessRequests'
  | 'jobs'
  | 'applications'
  | 'outreach'
  | 'users'
  | 'dotApps'
  | 'profiles'
  | 'resumes'
  | 'mvr'
  | 'bgcheckRequests'
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
  title: string
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

// Company for admin view
interface AdminCompany {
  id: string
  name: string
  dotNumber: string | null
  mcNumber: string | null
  status: 'pending' | 'active' | 'suspended'
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  companySize: string | null
  verified: boolean
  designatedOwnerEmail: string | null
  onboardingCompleted: boolean
  adminNotes: string | null
  owner: {
    id: string
    name: string | null
    email: string | null
  } | null
  ownerEmail: string | null
  teamMemberCount: number
  approvedAt: string | null
  suspendedAt: string | null
  suspensionReason: string | null
  createdAt: string
}

// Job posting for admin view
interface AdminJob {
  id: string
  title: string
  description: string | null
  targetRole: string | null
  locationCity: string | null
  locationState: string | null
  salaryMin: number | null
  salaryMax: number | null
  jobType: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  companyId: string
  companyName: string
  companyDotNumber: string | null
  applicationCount: number
}

// Job application for admin view
interface AdminApplication {
  id: string
  status: string
  coverLetter: string | null
  createdAt: string
  updatedAt: string
  jobId: string
  jobTitle: string
  companyName: string
  applicantId: string
  applicantWallet: string | null
  applicantEmail: string | null
  applicantName: string | null
  resumeId: string | null
  resumeTitle: string | null
  dotApplicationId: string | null
  dotApplicationComplete: boolean
  dotApplicationStatus: string | null
}

// Candidate outreach invite for admin view
interface AdminOutreach {
  id: string
  token: string
  type: 'driver_dot' | 'developer_card' | 'general'
  status: string
  candidateEmail: string | null
  candidateName: string | null
  welcomeMessage: string | null
  createdAt: string
  expiresAt: string | null
  emailSentAt: string | null
  companyId: string
  companyName: string
  jobId: string | null
  jobTitle: string | null
  createdByWallet: string | null
  createdByEmail: string | null
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

interface MvrRow {
  id: string
  driverUserId: string
  walletAddress: string
  driverName: string
  status: string
  dlState: string | null
  orderedAt: string | null
  createdAt: string
  accioOrderNumber: string | null
  licenseStatus: string | null
  totalPoints: number | null
  violationCount: number | null
  resultStatus: string | null
}

interface BgcheckRequest {
  id: string
  companyId: string
  companyName: string
  candidateUserId: string
  driverName: string
  driverEmail: string | null
  driverWallet: string | null
  status: string
  requestedAt: string
  expiresAt: string | null
  hasSigned: boolean
  signedAt: string | null
  signedName: string | null
  consentId: string | null
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

interface CompanyMember {
  id: string
  userId: string | null
  role: string
  isActive: boolean
  isPending: boolean
  invitedAt: string
  acceptedAt: string | null
  inviteEmail: string | null
  name: string | null
  email: string | null
  walletAddress: string | null
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
  
  // Try Alchemy hook first, fall back to localStorage (set by main page on login)
  // Initialize from localStorage immediately to avoid waiting
  const [walletAddress, setWalletAddress] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('stormchain-admin-wallet') || undefined
    }
    return undefined
  })
  
  // Update if Alchemy provides an address (takes priority)
  useEffect(() => {
    if (account?.address) {
      setWalletAddress(account.address)
      console.log('[ADMIN] Using wallet from Alchemy:', account.address)
    }
  }, [account?.address])
  
  // Log current source on mount
  useEffect(() => {
    if (walletAddress && !account?.address) {
      console.log('[ADMIN] Using wallet from localStorage:', walletAddress)
    }
  }, [])

  const [activeTab, setActiveTab] = useState<TabId>('users')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [companyStats, setCompanyStats] = useState({ total: 0, pending: 0, active: 0, suspended: 0 })
  const [companyStatusFilter, setCompanyStatusFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all')
  
  // Access requests state
  const [accessRequests, setAccessRequests] = useState<Array<{
    id: string
    wallet_address: string
    email: string | null
    name: string
    company_name: string
    description: string | null
    status: string
    created_at: string
  }>>([])
  const [accessRequestsStats, setAccessRequestsStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 })
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [jobsFilter, setJobsFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [applications, setApplications] = useState<AdminApplication[]>([])
  const [applicationsFilter, setApplicationsFilter] = useState<'all' | 'submitted' | 'under_review' | 'hired' | 'rejected'>('all')
  const [outreach, setOutreach] = useState<AdminOutreach[]>([])
  const [outreachFilter, setOutreachFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'>('all')
  const [users, setUsers] = useState<User[]>([])
  const [dotApps, setDotApps] = useState<DotApp[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [resumes, setResumes] = useState<Resume[]>([])
  const [devProfiles, setDevProfiles] = useState<DevProfile[]>([])
  const [devProjects, setDevProjects] = useState<DevProject[]>([])
  const [verifications, setVerifications] = useState<VerificationRow[]>([])
  const [mvrOrders, setMvrOrders] = useState<MvrRow[]>([])
  const [bgcheckRequests, setBgcheckRequests] = useState<BgcheckRequest[]>([])

  // Company creation modal
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false)
  const [newCompanyForm, setNewCompanyForm] = useState({
    companyName: '',
    dotNumber: '',
    ownerEmail: '',
  })
  const [createCompanyLoading, setCreateCompanyLoading] = useState(false)
  const [createCompanyError, setCreateCompanyError] = useState<string | null>(null)

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

  // Company team members expansion
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null)
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [loadingUserDetail, setLoadingUserDetail] = useState(false)

  // MVR detail view
  const [selectedMvrDetail, setSelectedMvrDetail] = useState<{
    order: Record<string, unknown>
    results: Array<Record<string, unknown>>
  } | null>(null)
  const [loadingMvrDetail, setLoadingMvrDetail] = useState(false)
  const [mvrDetailShowXml, setMvrDetailShowXml] = useState<'none' | 'order' | 'result'>('none')

  // Fetch access request stats on mount (for sidebar badge)
  const fetchAccessRequestStats = useCallback(async () => {
    if (!walletAddress || !isAdmin) return
    try {
      const res = await fetch('/api/admin/employer-requests?status=all', {
        headers: { 'x-wallet-address': walletAddress },
      })
      const data = await res.json()
      if (data.success) {
        setAccessRequestsStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to fetch access request stats:', err)
    }
  }, [walletAddress, isAdmin])

  // Fetch access request stats on mount
  useEffect(() => {
    if (isAdmin) {
      fetchAccessRequestStats()
    }
  }, [isAdmin, fetchAccessRequestStats])

  const fetchMvrDetail = useCallback(
    async (orderId: string) => {
      if (!walletAddress) return
      setLoadingMvrDetail(true)
      setSelectedMvrDetail(null)
      setMvrDetailShowXml('none')
      try {
        const res = await fetch(`/api/admin/mvr/${orderId}`, {
          headers: { 'x-wallet-address': walletAddress },
        })
        const data = await res.json()
        if (data.success) setSelectedMvrDetail({ order: data.order, results: data.results || [] })
      } catch (err) {
        console.error('Failed to fetch MVR detail:', err)
      } finally {
        setLoadingMvrDetail(false)
      }
    },
    [walletAddress]
  )

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

  // Fetch company members for expanded view
  const fetchCompanyMembers = useCallback(async (companyId: string) => {
    if (!walletAddress) return
    
    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/members`, {
        headers: { 'x-wallet-address': walletAddress },
      })
      const data = await res.json()
      if (data.success) {
        setCompanyMembers(data.members)
      }
    } catch (err) {
      console.error('Failed to fetch company members:', err)
    } finally {
      setLoadingMembers(false)
    }
  }, [walletAddress])

  // Remove a member from a company (admin action)
  const handleRemoveCompanyMember = useCallback(async (companyId: string, memberId: string, memberName: string) => {
    if (!walletAddress) return
    
    const confirmed = confirm(`Remove "${memberName || 'this member'}" from the company?\n\nThey will lose access to company data.`)
    if (!confirmed) return
    
    setRemovingMemberId(memberId)
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'x-wallet-address': walletAddress },
      })
      const data = await res.json()
      if (data.success) {
        // Refresh members list
        fetchCompanyMembers(companyId)
        // Refresh main company data to update counts
        fetchData()
      } else {
        alert('Failed to remove member: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Failed to remove member: Network error')
    } finally {
      setRemovingMemberId(null)
    }
  }, [walletAddress, fetchCompanyMembers])

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
        case 'companies':
          response = await fetch(
            `/api/admin/companies?status=${companyStatusFilter}&search=${encodeURIComponent(searchQuery)}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setCompanies(data.companies)
            setCompanyStats(data.stats)
            setTotalCount(data.stats.total)
          }
          break

        case 'accessRequests':
          response = await fetch('/api/admin/employer-requests?status=all', { headers })
          data = await response.json()
          if (data.success) {
            setAccessRequests(data.requests)
            setAccessRequestsStats(data.stats)
            setTotalCount(data.stats.total)
          }
          break

        case 'jobs':
          response = await fetch('/api/admin/jobs', { headers })
          data = await response.json()
          if (data.jobs) {
            let filteredJobs = data.jobs
            if (jobsFilter === 'active') {
              filteredJobs = data.jobs.filter((j: AdminJob) => j.isActive)
            } else if (jobsFilter === 'inactive') {
              filteredJobs = data.jobs.filter((j: AdminJob) => !j.isActive)
            }
            if (searchQuery) {
              const q = searchQuery.toLowerCase()
              filteredJobs = filteredJobs.filter((j: AdminJob) =>
                j.title.toLowerCase().includes(q) ||
                j.companyName.toLowerCase().includes(q)
              )
            }
            setJobs(filteredJobs)
            setTotalCount(filteredJobs.length)
          }
          break

        case 'applications':
          response = await fetch(
            `/api/admin/applications?status=${applicationsFilter === 'all' ? '' : applicationsFilter}&search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setApplications(data.applications)
            setTotalCount(data.total)
          }
          break

        case 'outreach':
          response = await fetch(
            `/api/admin/outreach?status=${outreachFilter === 'all' ? '' : outreachFilter}&search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setOutreach(data.outreach)
            setTotalCount(data.total)
          }
          break

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

        case 'mvr':
          response = await fetch(
            `/api/admin/mvr?limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setMvrOrders(data.mvrOrders || [])
            setTotalCount(data.total ?? 0)
          }
          break

        case 'bgcheckRequests':
          response = await fetch(
            `/api/admin/bgcheck-requests?limit=${pageSize}&offset=${offset}`,
            { headers }
          )
          data = await response.json()
          if (data.success) {
            setBgcheckRequests(data.requests || [])
            setTotalCount(data.total ?? 0)
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
  }, [walletAddress, isAdmin, activeTab, currentPage, searchQuery, companyStatusFilter, applicationsFilter, outreachFilter])

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
        case 'mvr':
          endpoint = `/api/admin/mvr/${deleteTarget.id}`
          break
        case 'bgcheckRequest':
          endpoint = `/api/admin/bgcheck-requests/${deleteTarget.id}`
          break
        case 'application':
          endpoint = `/api/admin/applications/${deleteTarget.id}`
          break
        case 'outreach':
          endpoint = `/api/admin/outreach/${deleteTarget.id}`
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

  // Tab configuration - organized by section
  // Sidebar sections with their tabs - organized for intuitive navigation
  const sidebarSections = [
    {
      id: 'employers',
      label: 'Employers',
      tabs: [
        { id: 'accessRequests' as TabId, label: `Access Requests${accessRequestsStats.pending > 0 ? ` (${accessRequestsStats.pending})` : ''}`, icon: <UserPlus className='w-4 h-4' /> },
        { id: 'companies' as TabId, label: `Companies${companyStats.pending > 0 ? ` (${companyStats.pending})` : ''}`, icon: <Building2 className='w-4 h-4' /> },
        { id: 'jobs' as TabId, label: 'Job Postings', icon: <Briefcase className='w-4 h-4' /> },
        { id: 'applications' as TabId, label: 'Applications', icon: <ClipboardList className='w-4 h-4' /> },
        { id: 'outreach' as TabId, label: 'Candidate Outreach', icon: <Send className='w-4 h-4' /> },
        { id: 'bgcheckRequests' as TabId, label: 'Background Checks', icon: <ClipboardCheck className='w-4 h-4' /> },
      ],
    },
    {
      id: 'drivers',
      label: 'Drivers',
      tabs: [
        { id: 'profiles' as TabId, label: 'Profiles', icon: <UserCircle className='w-4 h-4' /> },
        { id: 'dotApps' as TabId, label: 'DOT Apps', icon: <ClipboardList className='w-4 h-4' /> },
        { id: 'resumes' as TabId, label: 'Resumes', icon: <FileText className='w-4 h-4' /> },
        { id: 'mvr' as TabId, label: 'MVR Orders', icon: <Car className='w-4 h-4' /> },
        { id: 'verifications' as TabId, label: 'Verifications', icon: <ClipboardCheck className='w-4 h-4' /> },
      ],
    },
    {
      id: 'developers',
      label: 'Developers',
      tabs: [
        { id: 'devProfiles' as TabId, label: 'Profiles', icon: <Code className='w-4 h-4' /> },
        { id: 'devProjects' as TabId, label: 'Projects', icon: <FolderGit2 className='w-4 h-4' /> },
      ],
    },
    {
      id: 'system',
      label: 'System',
      tabs: [
        { id: 'users' as TabId, label: 'All Users', icon: <Users className='w-4 h-4' /> },
        { id: 'tools' as TabId, label: 'Tools', icon: <Settings className='w-4 h-4' /> },
      ],
    },
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
          <Loader2 className='w-8 h-8 animate-spin text-indigo-400 mx-auto mb-4' />
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
    <div className='min-h-screen flex'>
      {/* Sidebar */}
      <aside className={`w-64 flex-shrink-0 border-r ${
        theme === 'dark' 
          ? 'bg-gray-900 border-gray-700' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className='sticky top-0 h-screen overflow-y-auto'>
          {/* Sidebar Header */}
          <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Central Admin
            </h1>
            <p className={`text-xs mt-1 font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
            </p>
          </div>

          {/* Navigation Sections */}
          <nav className='p-3 space-y-4'>
            {sidebarSections.map((section) => (
              <div key={section.id}>
                <h2 className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`}>
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
                          ? theme === 'dark'
                            ? 'bg-teal-500 text-gray-900'
                            : 'bg-teal-600 text-white'
                          : theme === 'dark'
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
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {sidebarSections.flatMap(s => s.tabs).find(t => t.id === activeTab)?.label || 'Admin'}
            </h2>
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
              <Loader2 className='w-8 h-8 animate-spin text-indigo-400' />
            </div>
          ) : (
            <>
              {/* Access Requests Section */}
              {activeTab === 'accessRequests' && (
                <div className='p-6'>
                  {/* Stats */}
                  <div className='flex flex-wrap gap-2 mb-6'>
                    <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                      theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      <Clock className='w-4 h-4' />
                      <span>Pending</span>
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                        theme === 'dark' ? 'bg-yellow-500/30' : 'bg-yellow-200'
                      }`}>{accessRequestsStats.pending}</span>
                    </div>
                    <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                      theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700'
                    }`}>
                      <CheckCircle2 className='w-4 h-4' />
                      <span>Approved</span>
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                        theme === 'dark' ? 'bg-green-500/30' : 'bg-green-200'
                      }`}>{accessRequestsStats.approved}</span>
                    </div>
                    <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                      theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-700'
                    }`}>
                      <XCircle className='w-4 h-4' />
                      <span>Rejected</span>
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                        theme === 'dark' ? 'bg-red-500/30' : 'bg-red-200'
                      }`}>{accessRequestsStats.rejected}</span>
                    </div>
                  </div>

                  {/* Requests List */}
                  {accessRequests.length === 0 ? (
                    <div className='text-center py-12'>
                      <UserPlus className='w-12 h-12 mx-auto mb-4 opacity-30' />
                      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                        No access requests
                      </p>
                    </div>
                  ) : (
                    <div className='space-y-4'>
                      {accessRequests.map((req) => (
                        <div
                          key={req.id}
                          className={`rounded-xl border p-5 ${
                            req.status === 'pending'
                              ? theme === 'dark'
                                ? 'bg-yellow-500/5 border-yellow-500/30'
                                : 'bg-yellow-50 border-yellow-200'
                              : theme === 'dark'
                                ? 'bg-gray-800/50 border-gray-700'
                                : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className='flex items-start justify-between gap-4'>
                            <div className='flex-1 min-w-0'>
                              <div className='flex items-center gap-2 mb-1 flex-wrap'>
                                <h3 className={`font-semibold ${
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {req.company_name}
                                </h3>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  req.status === 'pending'
                                    ? 'bg-yellow-500/20 text-yellow-500'
                                    : req.status === 'approved'
                                      ? 'bg-green-500/20 text-green-500'
                                      : 'bg-red-500/20 text-red-500'
                                }`}>
                                  {req.status}
                                </span>
                                {/* Domain mismatch warning */}
                                {req.email && (() => {
                                  const emailDomain = req.email.split('@')[1]?.toLowerCase() || ''
                                  const companyWords = req.company_name.toLowerCase().replace(/[^a-z0-9]/g, '')
                                  const domainBase = emailDomain.split('.')[0] || ''
                                  const publicDomains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'protonmail']
                                  const isPublicEmail = publicDomains.some(d => emailDomain.includes(d))
                                  const domainMatchesCompany = companyWords.includes(domainBase) || domainBase.includes(companyWords.slice(0, 4))
                                  
                                  if (isPublicEmail) {
                                    return (
                                      <span className='px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 flex items-center gap-1'>
                                        <AlertTriangle className='w-3 h-3' />
                                        Personal email
                                      </span>
                                    )
                                  } else if (!domainMatchesCompany && domainBase.length > 2) {
                                    return (
                                      <span className='px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400 flex items-center gap-1'>
                                        <AlertTriangle className='w-3 h-3' />
                                        Domain mismatch?
                                      </span>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                Requested by: <strong>{req.name}</strong>
                              </p>
                              {req.email && (
                                <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                  {req.email}
                                </p>
                              )}
                              
                              {/* Description / Role explanation */}
                              {req.description && (
                                <div className={`mt-2 p-2 rounded-lg text-sm ${
                                  theme === 'dark' ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  <p className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Role & Authorization:
                                  </p>
                                  {req.description}
                                </div>
                              )}
                              
                              <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                Submitted: {new Date(req.created_at).toLocaleDateString()} at{' '}
                                {new Date(req.created_at).toLocaleTimeString()}
                              </p>
                              <p className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
                                Wallet: {req.wallet_address.slice(0, 10)}...{req.wallet_address.slice(-6)}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className='flex gap-2 flex-shrink-0 items-center'>
                              {req.status === 'pending' && (
                                <>
                                  <button
                                    onClick={async () => {
                                      setProcessingRequestId(req.id)
                                      try {
                                        const res = await fetch(`/api/admin/employer-requests/${req.id}`, {
                                          method: 'PATCH',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'x-wallet-address': walletAddress || '',
                                          },
                                          body: JSON.stringify({ action: 'approve' }),
                                        })
                                        if (res.ok) {
                                          fetchData()
                                        }
                                      } catch (err) {
                                        console.error('Failed to approve:', err)
                                      } finally {
                                        setProcessingRequestId(null)
                                      }
                                    }}
                                    disabled={processingRequestId === req.id}
                                    className='px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-1'
                                  >
                                    {processingRequestId === req.id ? (
                                      <Loader2 className='w-4 h-4 animate-spin' />
                                    ) : (
                                      <CheckCircle className='w-4 h-4' />
                                    )}
                                    Approve
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm('Reject this request?')) return
                                      setProcessingRequestId(req.id)
                                      try {
                                        const res = await fetch(`/api/admin/employer-requests/${req.id}`, {
                                          method: 'PATCH',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'x-wallet-address': walletAddress || '',
                                          },
                                          body: JSON.stringify({ action: 'reject' }),
                                        })
                                        if (res.ok) {
                                          fetchData()
                                        }
                                      } catch (err) {
                                        console.error('Failed to reject:', err)
                                      } finally {
                                        setProcessingRequestId(null)
                                      }
                                    }}
                                    disabled={processingRequestId === req.id}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                      theme === 'dark'
                                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    } disabled:opacity-50`}
                                  >
                                    <XCircle className='w-4 h-4' />
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove this ${req.status} request from the list? This only removes the record; it does not change the company or user.`)) return
                                  setProcessingRequestId(req.id)
                                  try {
                                    const res = await fetch(`/api/admin/employer-requests/${req.id}`, {
                                      method: 'DELETE',
                                      headers: { 'x-wallet-address': walletAddress || '' },
                                    })
                                    if (res.ok) {
                                      fetchData()
                                    } else {
                                      const data = await res.json()
                                      alert(data.error || 'Failed to remove request')
                                    }
                                  } catch (err) {
                                    console.error('Failed to remove:', err)
                                    alert('Failed to remove request')
                                  } finally {
                                    setProcessingRequestId(null)
                                  }
                                }}
                                disabled={processingRequestId === req.id}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50 ${
                                  theme === 'dark'
                                    ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                                title='Remove from list (does not affect company or user)'
                              >
                                {processingRequestId === req.id ? (
                                  <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                  <Trash2 className='w-4 h-4' />
                                )}
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Companies Section */}
              {activeTab === 'companies' && (
                <div className='p-6'>
                  {/* Stale pending alert — companies waiting > 7 days for approval */}
                  {(() => {
                    const staleCount = companies.filter(c => {
                      if (c.status !== 'pending') return false
                      const days = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86_400_000)
                      return days >= 7
                    }).length
                    return staleCount > 0 ? (
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border ${
                        theme === 'dark'
                          ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-300'
                          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      }`}>
                        <AlertTriangle className='w-4 h-4 shrink-0' />
                        <p className='text-sm'>
                          <span className='font-semibold'>{staleCount} {staleCount === 1 ? 'company has' : 'companies have'} been pending for 7+ days</span>
                          {' '}— filter by <button onClick={() => setCompanyStatusFilter('pending')} className='underline font-medium'>Pending</button> to review.
                        </p>
                      </div>
                    ) : null
                  })()}

                  {/* Status Filter Pills */}
                  <div className='flex flex-wrap gap-2 mb-6'>
                    {(['all', 'pending', 'active', 'suspended'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setCompanyStatusFilter(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                          companyStatusFilter === status
                            ? status === 'pending'
                              ? 'bg-yellow-500 text-white'
                              : status === 'active'
                                ? 'bg-green-500 text-white'
                                : status === 'suspended'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-indigo-500 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status === 'pending' && <Clock className='w-4 h-4' />}
                        {status === 'active' && <CheckCircle2 className='w-4 h-4' />}
                        {status === 'suspended' && <XCircle className='w-4 h-4' />}
                        {status === 'all' && <Building2 className='w-4 h-4' />}
                        <span className='capitalize'>{status}</span>
                        <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                          companyStatusFilter === status
                            ? 'bg-white/20'
                            : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                        }`}>
                          {status === 'all'
                            ? companyStats.total
                            : companyStats[status as keyof typeof companyStats]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Companies Grid */}
                  {companies.length === 0 ? (
                    <div className='text-center py-12'>
                      <Building2 className='w-12 h-12 mx-auto mb-4 opacity-30' />
                      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                        No companies found
                      </p>
                    </div>
                  ) : (
                    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                      {companies.map((company) => (
                        <div
                          key={company.id}
                          className={`rounded-xl border p-5 ${
                            theme === 'dark'
                              ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          } transition-colors`}
                        >
                          {/* Header */}
                          <div className='flex items-start justify-between mb-3'>
                            <div className='flex-1 min-w-0'>
                              <h3 className={`font-semibold truncate ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>
                                {company.name}
                              </h3>
                              {company.dotNumber && (
                                <p className='text-xs text-gray-500'>DOT: {company.dotNumber}</p>
                              )}
                            </div>
                            <div className='flex flex-col items-end gap-1'>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                company.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : company.status === 'active'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {company.status}
                              </span>
                              {company.status === 'pending' && (() => {
                                const days = Math.floor((Date.now() - new Date(company.createdAt).getTime()) / 86_400_000)
                                return days >= 7 ? (
                                  <span className='flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'>
                                    <Clock className='w-2.5 h-2.5' />
                                    {days}d waiting
                                  </span>
                                ) : days > 0 ? (
                                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {days}d
                                  </span>
                                ) : null
                              })()}
                            </div>
                          </div>

                          {/* Owner Info */}
                          <div className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            <div className='flex items-center gap-2'>
                              <UserCircle className='w-4 h-4' />
                              <span className='truncate'>
                                {company.owner?.name || company.ownerEmail || 'No owner assigned'}
                              </span>
                            </div>
                            {/* Clickable team member count */}
                            <button
                              onClick={() => {
                                if (expandedCompanyId === company.id) {
                                  setExpandedCompanyId(null)
                                  setCompanyMembers([])
                                } else {
                                  setExpandedCompanyId(company.id)
                                  fetchCompanyMembers(company.id)
                                }
                              }}
                              className={`flex items-center gap-2 mt-1 hover:underline ${
                                expandedCompanyId === company.id ? 'text-blue-500' : ''
                              }`}
                            >
                              <Users className='w-4 h-4' />
                              <span>
                                {company.teamMemberCount} team member{company.teamMemberCount !== 1 ? 's' : ''}
                                {' '}
                                <span className='text-xs'>
                                  {expandedCompanyId === company.id ? '▲' : '▼'}
                                </span>
                              </span>
                            </button>
                          </div>

                          {/* Location */}
                          {(company.city || company.state) && (
                            <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                              {[company.city, company.state].filter(Boolean).join(', ')}
                            </p>
                          )}

                          {/* Actions */}
                          <div className='flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700'>
                            {company.status === 'pending' && (
                              <button
                                onClick={async () => {
                                  await fetch(`/api/admin/companies/${company.id}`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-wallet-address': walletAddress || '',
                                    },
                                    body: JSON.stringify({ action: 'approve' }),
                                  })
                                  fetchData()
                                }}
                                className='flex-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600'
                              >
                                Approve
                              </button>
                            )}
                            {company.status === 'active' && (
                              <button
                                onClick={async () => {
                                  const reason = prompt('Suspension reason (optional):')
                                  await fetch(`/api/admin/companies/${company.id}`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-wallet-address': walletAddress || '',
                                    },
                                    body: JSON.stringify({ action: 'suspend', reason }),
                                  })
                                  fetchData()
                                }}
                                className='flex-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600'
                              >
                                Suspend
                              </button>
                            )}
                            {company.status === 'suspended' && (
                              <button
                                onClick={async () => {
                                  await fetch(`/api/admin/companies/${company.id}`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-wallet-address': walletAddress || '',
                                    },
                                    body: JSON.stringify({ action: 'reactivate' }),
                                  })
                                  fetchData()
                                }}
                                className='flex-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600'
                              >
                                Reactivate
                              </button>
                            )}
                            <button
                              onClick={() => {
                                // Simple inline notes editor
                                const notes = prompt('Admin notes:', company.adminNotes || '')
                                if (notes !== null) {
                                  fetch(`/api/admin/companies/${company.id}`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-wallet-address': walletAddress || '',
                                    },
                                    body: JSON.stringify({ adminNotes: notes }),
                                  }).then(() => fetchData())
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                theme === 'dark'
                                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              Notes
                            </button>
                            <button
                              onClick={async () => {
                                const confirmed = confirm(
                                  `DELETE "${company.name}"?\n\nThis will permanently remove the company and all associated:\n- Team members\n- Job postings\n- Applications\n\nThis cannot be undone.`
                                )
                                if (confirmed) {
                                  try {
                                    const res = await fetch(`/api/admin/companies/${company.id}`, {
                                      method: 'DELETE',
                                      headers: { 'x-wallet-address': walletAddress || '' },
                                    })
                                    const data = await res.json()
                                    if (data.success) {
                                      fetchData()
                                    } else {
                                      alert('Delete failed: ' + (data.error || 'Unknown error'))
                                    }
                                  } catch (err) {
                                    alert('Delete failed: Network error')
                                  }
                                }
                              }}
                              className='px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30'
                              title='Delete company permanently'
                            >
                              Delete
                            </button>
                          </div>

                          {/* Admin Notes Preview */}
                          {company.adminNotes && (
                            <p className='mt-3 text-xs text-gray-500 italic line-clamp-2'>
                              {company.adminNotes}
                            </p>
                          )}

                          {/* Expanded Team Members */}
                          {expandedCompanyId === company.id && (
                            <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
                              <h4 className={`text-sm font-medium mb-3 ${
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                Team Members
                              </h4>
                              {loadingMembers ? (
                                <div className='flex items-center justify-center py-4'>
                                  <Loader2 className='w-5 h-5 animate-spin text-gray-400' />
                                </div>
                              ) : companyMembers.length === 0 ? (
                                <p className='text-sm text-gray-500'>No team members</p>
                              ) : (
                                <div className='space-y-2'>
                                  {companyMembers.map(member => (
                                    <div
                                      key={member.id}
                                      className={`flex items-center justify-between p-2 rounded-lg ${
                                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                                      }`}
                                    >
                                      <div className='flex-1 min-w-0'>
                                        <div className='flex items-center gap-2'>
                                          <span className={`text-sm font-medium truncate ${
                                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                                          }`}>
                                            {member.name || member.email || 'Unknown'}
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                                            member.role === 'owner'
                                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                              : member.role === 'admin'
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                                          }`}>
                                            {member.role}
                                          </span>
                                          {member.isPending && (
                                            <span className='px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'>
                                              pending
                                            </span>
                                          )}
                                        </div>
                                        {member.walletAddress && (
                                          <p className='text-xs text-gray-500 truncate'>
                                            {member.walletAddress.slice(0, 6)}...{member.walletAddress.slice(-4)}
                                          </p>
                                        )}
                                        {member.email && member.email !== member.name && (
                                          <p className='text-xs text-gray-500 truncate'>{member.email}</p>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleRemoveCompanyMember(company.id, member.id, member.name || member.email || '')}
                                        disabled={removingMemberId === member.id}
                                        className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-50'
                                        title='Remove member'
                                      >
                                        {removingMemberId === member.id ? (
                                          <Loader2 className='w-4 h-4 animate-spin' />
                                        ) : (
                                          <Trash2 className='w-4 h-4' />
                                        )}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Company Button */}
                  <div className='mt-6 pt-6 border-t border-gray-200 dark:border-gray-700'>
                    <button
                      onClick={() => {
                        setNewCompanyForm({ companyName: '', dotNumber: '', ownerEmail: '' })
                        setCreateCompanyError(null)
                        setShowCreateCompanyModal(true)
                      }}
                      className='flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-indigo-500 text-white hover:bg-indigo-600'
                    >
                      <UserPlus className='w-4 h-4' />
                      Pre-Create Company
                    </button>
                    <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      Pre-create a company for a client. When the designated owner logs in with their email, they will automatically be linked as the owner.
                    </p>
                  </div>
                </div>
              )}

              {/* Jobs Section */}
              {activeTab === 'jobs' && (
                <div className='p-6'>
                  {/* Filter Pills */}
                  <div className='flex flex-wrap gap-2 mb-6'>
                    {(['all', 'active', 'inactive'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setJobsFilter(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          jobsFilter === status
                            ? 'bg-indigo-500 text-white'
                            : theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                        {status === 'all' && ` (${jobs.length})`}
                        {status === 'active' && ` (${jobs.filter(j => j.isActive).length})`}
                        {status === 'inactive' && ` (${jobs.filter(j => !j.isActive).length})`}
                      </button>
                    ))}
                  </div>

                  {/* Jobs Grid */}
                  <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className={`p-4 rounded-xl border ${
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        {/* Header */}
                        <div className='flex items-start justify-between mb-3'>
                          <div className='flex-1 min-w-0'>
                            <h3 className={`font-semibold truncate ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                              {job.title}
                            </h3>
                            <p className={`text-sm truncate ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {job.companyName}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            job.isActive
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {job.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {/* Details */}
                        <div className='space-y-1 text-sm mb-3'>
                          {job.locationCity && job.locationState && (
                            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                              📍 {job.locationCity}, {job.locationState}
                            </p>
                          )}
                          {job.targetRole && (
                            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                              👤 {job.targetRole}
                            </p>
                          )}
                          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                            📝 {job.applicationCount} application{job.applicationCount !== 1 ? 's' : ''}
                          </p>
                          <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                            Created {new Date(job.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className='flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700'>
                          <button
                            onClick={async () => {
                              await fetch(`/api/admin/jobs/${job.id}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'x-wallet-address': walletAddress || '',
                                },
                                body: JSON.stringify({ isActive: !job.isActive }),
                              })
                              fetchData()
                            }}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
                              job.isActive
                                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                : 'bg-green-500 text-white hover:bg-green-600'
                            }`}
                          >
                            {job.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Delete "${job.title}" permanently? This cannot be undone.`)) {
                                const res = await fetch(`/api/admin/jobs/${job.id}`, {
                                  method: 'DELETE',
                                  headers: { 'x-wallet-address': walletAddress || '' },
                                })
                                if (res.ok) {
                                  fetchData()
                                } else {
                                  const data = await res.json()
                                  alert(data.error || 'Failed to delete job. It may have applications linked to it.')
                                }
                              }
                            }}
                            className='px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600'
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {jobs.length === 0 && (
                    <div className='text-center py-12'>
                      <Briefcase className={`w-12 h-12 mx-auto mb-4 ${
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                      }`} />
                      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        No job postings found
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Applications Section */}
              {activeTab === 'applications' && (
                <div className='p-6'>
                  {/* Filter Pills */}
                  <div className='flex flex-wrap gap-2 mb-6'>
                    {(['all', 'submitted', 'under_review', 'hired', 'rejected'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setApplicationsFilter(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          applicationsFilter === status
                            ? 'bg-indigo-500 text-white'
                            : theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </button>
                    ))}
                  </div>

                  {/* Applications Table */}
                  <div className='overflow-x-auto'>
                    <table className='w-full'>
                      <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
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
                      <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                        {applications.map((app) => (
                          <tr
                            key={app.id}
                            className={`${theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}
                          >
                            <td className={tableCellClass}>
                              <div>
                                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {app.applicantName || 'Unnamed'}
                                </p>
                                <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
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
                                app.status === 'under_review' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                app.status === 'interview' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                app.status === 'offer' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                                app.status === 'hired' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                app.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {app.status.replace('_', ' ')}
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
                                  setDeleteTarget({
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
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                      }`} />
                      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        No applications found
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Candidate Outreach Section */}
              {activeTab === 'outreach' && (
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
                            : theme === 'dark'
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
                      <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
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
                      <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                        {outreach.map((invite) => (
                          <tr
                            key={invite.id}
                            className={`${theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}
                          >
                            <td className={tableCellClass}>
                              <div>
                                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {invite.candidateName || 'Unnamed'}
                                </p>
                                <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {invite.candidateEmail || '—'}
                                </p>
                              </div>
                            </td>
                            <td className={tableCellClass}>
                              <div>
                                <p className='truncate max-w-[120px]' title={invite.companyName}>
                                  {invite.companyName}
                                </p>
                                <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {invite.createdByEmail || invite.createdByWallet?.slice(0, 10) + '...'}
                                </p>
                              </div>
                            </td>
                            <td className={tableCellClass}>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                invite.type === 'driver_dot' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                                invite.type === 'developer_card' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {invite.type === 'driver_dot' ? 'DOT App' :
                                 invite.type === 'developer_card' ? 'Dev Card' : 'General'}
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
                                  setDeleteTarget({
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
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                      }`} />
                      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        No outreach invites found
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                            <div className='font-medium'>{project.title}</div>
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
                                  name: project.title,
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

              {/* MVR Table */}
              {activeTab === 'mvr' && (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead
                      className={
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }
                    >
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Driver
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Wallet
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          State
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Order Status
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Result
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Ordered
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {mvrOrders.map((mvr) => (
                        <tr
                          key={mvr.id}
                          className={
                            theme === 'dark'
                              ? 'hover:bg-gray-800/50'
                              : 'hover:bg-gray-50'
                          }
                        >
                          <td className={tableCellClass}>
                            {mvr.driverName}
                          </td>
                          <td className={tableCellClass}>
                            <code className='text-xs'>
                              {mvr.walletAddress.slice(0, 8)}...
                              {mvr.walletAddress.slice(-4)}
                            </code>
                          </td>
                          <td className={tableCellClass}>
                            {mvr.dlState || '-'}
                          </td>
                          <td className={tableCellClass}>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                mvr.status === 'completed'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : mvr.status === 'pending' || mvr.status === 'processing'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                              }`}
                            >
                              {mvr.status || '-'}
                            </span>
                          </td>
                          <td className={tableCellClass}>
                            {mvr.licenseStatus ? (
                              <span className='text-xs'>
                                {mvr.licenseStatus}
                                {mvr.totalPoints != null && ` • ${mvr.totalPoints} pts`}
                                {mvr.violationCount != null && ` • ${mvr.violationCount} viol`}
                              </span>
                            ) : (
                              <span className='text-xs opacity-50'>-</span>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            {mvr.orderedAt
                              ? new Date(mvr.orderedAt).toLocaleDateString()
                              : new Date(mvr.createdAt).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            <div className='flex items-center gap-1'>
                              <button
                                onClick={() => fetchMvrDetail(mvr.id)}
                                className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400'
                                title='View MVR data'
                              >
                                <Eye className='w-4 h-4' />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'mvr',
                                    id: mvr.id,
                                    name: `MVR ${mvr.dlState || 'order'} (${mvr.driverName})`,
                                  })
                                }
                                className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                                title='Remove MVR order and results'
                              >
                                <Trash2 className='w-4 h-4' />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mvrOrders.length === 0 && (
                    <div className='text-center py-12 text-gray-500'>
                      No MVR orders found
                    </div>
                  )}
                </div>
              )}

              {/* Background Check Requests Table */}
              {activeTab === 'bgcheckRequests' && (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead
                      className={
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }
                    >
                      <tr>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Company
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Driver
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Request Status
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Consent
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Requested
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Signed
                        </th>
                        <th className={`${tableHeaderClass} px-4 py-3`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {bgcheckRequests.map((req) => (
                        <tr
                          key={req.id}
                          className={
                            theme === 'dark'
                              ? 'hover:bg-gray-800/50'
                              : 'hover:bg-gray-50'
                          }
                        >
                          <td className={tableCellClass}>
                            {req.companyName}
                          </td>
                          <td className={tableCellClass}>
                            <div>
                              <div>{req.driverName}</div>
                              {req.driverEmail && (
                                <div className='text-xs text-gray-500'>{req.driverEmail}</div>
                              )}
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                req.status === 'completed'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : req.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : req.status === 'viewed'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className={tableCellClass}>
                            {req.hasSigned ? (
                              <div className='flex items-center gap-1 text-green-600 dark:text-green-400'>
                                <CheckCircle className='w-4 h-4' />
                                <span className='text-xs'>Signed</span>
                              </div>
                            ) : (
                              <div className='flex items-center gap-1 text-yellow-600 dark:text-yellow-400'>
                                <Clock className='w-4 h-4' />
                                <span className='text-xs'>Awaiting</span>
                              </div>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            {new Date(req.requestedAt).toLocaleDateString()}
                          </td>
                          <td className={tableCellClass}>
                            {req.signedAt
                              ? new Date(req.signedAt).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className={tableCellClass}>
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'bgcheckRequest',
                                  id: req.id,
                                  name: `${req.companyName} → ${req.driverName}`,
                                })
                              }
                              className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                              title='Remove request'
                            >
                              <Trash2 className='w-4 h-4' />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bgcheckRequests.length === 0 && (
                    <div className='text-center py-12 text-gray-500'>
                      No background check requests found
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
                <Loader2 className='w-8 h-8 animate-spin text-indigo-400' />
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
                            {[selectedUser.devProfile.first_name, selectedUser.devProfile.last_name].filter(Boolean).join(' ') || selectedUser.devProfile.display_name || '-'}
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

      {/* MVR Detail Modal */}
      {(selectedMvrDetail || loadingMvrDetail) && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'>
          <div
            className={`rounded-xl border max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}
          >
            {loadingMvrDetail ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 animate-spin text-indigo-400' />
              </div>
            ) : selectedMvrDetail && (
              <>
                <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
                  <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    MVR Order Details
                  </h3>
                  <button
                    onClick={() => setSelectedMvrDetail(null)}
                    className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  >
                    <X className='w-5 h-5' />
                  </button>
                </div>
                <div className='p-4 overflow-y-auto flex-1 space-y-6'>
                  {/* Order info */}
                  <div>
                    <h4 className={`font-medium mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Order</h4>
                    <div className={`p-4 rounded-lg text-sm grid grid-cols-2 md:grid-cols-3 gap-2 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <div><span className='opacity-70'>Driver:</span> {String(selectedMvrDetail.order.driverName || selectedMvrDetail.order.walletAddress || '-')}</div>
                      <div><span className='opacity-70'>Wallet:</span> <code className='text-xs'>{String(selectedMvrDetail.order.walletAddress || '-')}</code></div>
                      <div><span className='opacity-70'>Status:</span> {String(selectedMvrDetail.order.status)}</div>
                      <div><span className='opacity-70'>DL State:</span> {String(selectedMvrDetail.order.dlState)}</div>
                      <div><span className='opacity-70'>Accio #:</span> {String(selectedMvrDetail.order.accioOrderNumber || '-')}</div>
                      <div><span className='opacity-70'>Ordered:</span> {selectedMvrDetail.order.orderedAt ? new Date(selectedMvrDetail.order.orderedAt as string).toLocaleString() : '-'}</div>
                      <div><span className='opacity-70'>Completed:</span> {selectedMvrDetail.order.completedAt ? new Date(selectedMvrDetail.order.completedAt as string).toLocaleString() : '-'}</div>
                      <div><span className='opacity-70'>Expires:</span> {selectedMvrDetail.order.expiresAt ? new Date(selectedMvrDetail.order.expiresAt as string).toLocaleDateString() : '-'}</div>
                      <div><span className='opacity-70'>Fee:</span> {selectedMvrDetail.order.feeAmount != null ? `${selectedMvrDetail.order.feeAmount} ${selectedMvrDetail.order.feeCurrency || 'USD'}` : '-'}</div>
                      {selectedMvrDetail.order.errorMessage && (
                        <div className='col-span-full text-red-500'><span className='opacity-70'>Error:</span> {String(selectedMvrDetail.order.errorMessage)}</div>
                      )}
                    </div>
                  </div>

                  {/* Results */}
                  {selectedMvrDetail.results.length === 0 ? (
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>No results yet.</p>
                  ) : (
                    selectedMvrDetail.results.map((res, idx) => (
                      <div key={idx}>
                        <h4 className={`font-medium mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                          Result {selectedMvrDetail.results.length > 1 ? idx + 1 : ''}
                        </h4>
                        <div className={`p-4 rounded-lg text-sm space-y-3 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                          <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
                            <div><span className='opacity-70'>License status:</span> {String(res.licenseStatus ?? '-')}</div>
                            <div><span className='opacity-70'>Class:</span> {String(res.licenseClass ?? '-')}</div>
                            <div><span className='opacity-70'>State:</span> {String(res.licenseState ?? '-')}</div>
                            <div><span className='opacity-70'>Expiration:</span> {res.licenseExpirationDate ? new Date(res.licenseExpirationDate as string).toLocaleDateString() : '-'}</div>
                            <div><span className='opacity-70'>Total points:</span> {res.totalPoints != null ? res.totalPoints : '-'}</div>
                            <div><span className='opacity-70'>Violations:</span> {res.violationCount != null ? res.violationCount : '-'}</div>
                            <div><span className='opacity-70'>Accidents:</span> {res.accidentCount != null ? res.accidentCount : '-'}</div>
                            <div><span className='opacity-70'>Suspensions:</span> {res.suspensionCount != null ? res.suspensionCount : '-'}</div>
                          </div>
                          {Array.isArray(res.cdlEndorsements) && (res.cdlEndorsements as string[]).length > 0 && (
                            <div><span className='opacity-70'>CDL Endorsements:</span> {(res.cdlEndorsements as string[]).join(', ')}</div>
                          )}
                          {Array.isArray(res.cdlRestrictions) && (res.cdlRestrictions as string[]).length > 0 && (
                            <div><span className='opacity-70'>CDL Restrictions:</span> {(res.cdlRestrictions as string[]).join(', ')}</div>
                          )}
                          {Array.isArray(res.violations) && (res.violations as unknown[]).length > 0 && (
                            <div>
                              <span className='opacity-70'>Violations detail:</span>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto max-h-40 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                {JSON.stringify(res.violations, null, 2)}
                              </pre>
                            </div>
                          )}
                          {Array.isArray(res.accidents) && (res.accidents as unknown[]).length > 0 && (
                            <div>
                              <span className='opacity-70'>Accidents:</span>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto max-h-32 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                {JSON.stringify(res.accidents, null, 2)}
                              </pre>
                            </div>
                          )}
                          {Array.isArray(res.suspensions) && (res.suspensions as unknown[]).length > 0 && (
                            <div>
                              <span className='opacity-70'>Suspensions:</span>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto max-h-32 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                {JSON.stringify(res.suspensions, null, 2)}
                              </pre>
                            </div>
                          )}
                          {res.parsedData && (
                            <div>
                              <span className='opacity-70'>Parsed data (full):</span>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto max-h-48 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                {JSON.stringify(res.parsedData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Raw XML (collapsible) */}
                  {(selectedMvrDetail.order.orderXml || selectedMvrDetail.order.resultXml) && (
                    <div>
                      <h4 className={`font-medium mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Raw XML</h4>
                      <div className='flex gap-2 mb-2'>
                        {selectedMvrDetail.order.orderXml && (
                          <button
                            onClick={() => setMvrDetailShowXml(mvrDetailShowXml === 'order' ? 'none' : 'order')}
                            className={`px-3 py-1.5 rounded text-sm ${mvrDetailShowXml === 'order' ? 'bg-brand-mint text-gray-900' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                          >
                            Order XML
                          </button>
                        )}
                        {selectedMvrDetail.order.resultXml && (
                          <button
                            onClick={() => setMvrDetailShowXml(mvrDetailShowXml === 'result' ? 'none' : 'result')}
                            className={`px-3 py-1.5 rounded text-sm ${mvrDetailShowXml === 'result' ? 'bg-brand-mint text-gray-900' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
                          >
                            Result XML
                          </button>
                        )}
                      </div>
                      {mvrDetailShowXml === 'order' && selectedMvrDetail.order.orderXml && (
                        <pre className={`p-3 rounded text-xs overflow-x-auto max-h-64 whitespace-pre-wrap ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
                          {String(selectedMvrDetail.order.orderXml)}
                        </pre>
                      )}
                      {mvrDetailShowXml === 'result' && selectedMvrDetail.order.resultXml && (
                        <pre className={`p-3 rounded text-xs overflow-x-auto max-h-64 whitespace-pre-wrap ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
                          {String(selectedMvrDetail.order.resultXml)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'>
          <div className={`rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-6 max-w-md w-full`}>
            <div className='flex items-center gap-3 mb-4'>
              <div className='p-2 rounded-full bg-red-100 dark:bg-red-900/30'>
                <AlertTriangle className='w-6 h-6 text-red-500' />
              </div>
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Confirm Delete
              </h3>
            </div>
            <p className={`mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </p>
            <div className='mb-4'>
              <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Type DELETE to confirm
              </label>
              <input
                type='text'
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-red-500`}
                placeholder='DELETE'
              />
            </div>
            <div className='flex gap-3'>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className='flex-1 px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {deleting ? <Loader2 className='w-4 h-4 animate-spin mx-auto' /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Company Modal */}
      {showCreateCompanyModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'>
          <div className={`rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-6 max-w-md w-full`}>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className={`p-2 rounded-full ${theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                  <Building2 className='w-6 h-6 text-indigo-500' />
                </div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Pre-Create Company
                </h3>
              </div>
              <button
                onClick={() => setShowCreateCompanyModal(false)}
                className={`p-1 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Pre-create a company for a client. When the designated owner logs in with their email, they will automatically be linked as the owner.
            </p>

            <div className='space-y-4'>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Company Name <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={newCompanyForm.companyName}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, companyName: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  placeholder='e.g. PACE Drivers LLC'
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  DOT Number <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>(optional)</span>
                </label>
                <input
                  type='text'
                  value={newCompanyForm.dotNumber}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, dotNumber: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  placeholder='e.g. 1234567'
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Designated Owner Email <span className='text-red-500'>*</span>
                </label>
                <input
                  type='email'
                  value={newCompanyForm.ownerEmail}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, ownerEmail: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  placeholder='owner@company.com'
                />
                <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  This email address will become the owner when they sign up.
                </p>
              </div>

              {createCompanyError && (
                <div className='p-3 rounded-lg bg-red-500/20 text-red-400 text-sm'>
                  {createCompanyError}
                </div>
              )}
            </div>

            <div className='flex gap-3 mt-6'>
              <button
                onClick={() => setShowCreateCompanyModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newCompanyForm.companyName.trim() || !newCompanyForm.ownerEmail.trim()) {
                    setCreateCompanyError('Company name and owner email are required')
                    return
                  }

                  setCreateCompanyLoading(true)
                  setCreateCompanyError(null)

                  try {
                    const res = await fetch('/api/admin/companies', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-wallet-address': walletAddress || '',
                      },
                      body: JSON.stringify({
                        companyName: newCompanyForm.companyName.trim(),
                        dotNumber: newCompanyForm.dotNumber.trim() || undefined,
                        designatedOwnerEmail: newCompanyForm.ownerEmail.trim(),
                        status: 'active',
                      }),
                    })
                    const data = await res.json()

                    if (data.success) {
                      setShowCreateCompanyModal(false)
                      setNewCompanyForm({ companyName: '', dotNumber: '', ownerEmail: '' })
                      fetchData()
                    } else {
                      setCreateCompanyError(data.error || 'Failed to create company')
                    }
                  } catch (err) {
                    setCreateCompanyError('Failed to create company')
                  } finally {
                    setCreateCompanyLoading(false)
                  }
                }}
                disabled={createCompanyLoading || !newCompanyForm.companyName.trim() || !newCompanyForm.ownerEmail.trim()}
                className='flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {createCompanyLoading ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <>
                    <UserPlus className='w-4 h-4' />
                    Create Company
                  </>
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
        <Loader2 className='w-8 h-8 animate-spin text-indigo-400' />
      </div>
    )
  }

  return <AdminDashboardContent />
}
