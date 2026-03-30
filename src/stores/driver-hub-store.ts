import { create } from 'zustand'
import type {
  ResumeData,
  DotApplicationRecord,
  MvrRecord,
  JobApplication,
  DriverHubStats,
} from './types'
import type { ResumeUploadEvent } from '@/types/assistant'

/**
 * Driver Hub Store - Manages data displayed in the Driver Hub dashboard
 * 
 * This store handles:
 * - Resumes list and upload events
 * - DOT applications list
 * - MVR records
 * - Job applications
 * - Hub statistics
 * - Driver profile data
 * 
 * Data is fetched from the API and cached here.
 * Unlike the DOT application store, this data is NOT persisted
 * to localStorage - it's always fetched fresh from the server.
 */

interface DriverProfile {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  cdlNumber: string | null
  cdlState: string | null
  [key: string]: unknown
}

interface DriverHubState {
  // Profile
  profile: DriverProfile | null
  displayNameFallback: string | null
  
  // Data collections
  resumes: ResumeData[]
  dotApplications: DotApplicationRecord[]
  mvrRecords: MvrRecord[]
  jobApplications: JobApplication[]
  /** Portfolio URL from block_dev_portfolio (for My Files + Stormi journey) */
  portfolio: { portfolioUrl: string | null } | null
  /** GitHub from block_dev_github (for My Files + Stormi journey) */
  github: { username: string | null } | null
  
  // Statistics
  stats: DriverHubStats | null
  
  // Loading states
  isLoading: boolean
  isRefreshing: boolean
  lastFetchedAt: string | null
  fetchError: string | null
  
  // Resume state
  hasResume: boolean
  latestResumeIpfsHash: string | null
  resumeUploadEvent: ResumeUploadEvent | null
  
  // MVR state
  selectedMvrOrderId: string | null
  isMvrModalOpen: boolean
  isMvrManagementOpen: boolean
}

interface DriverHubActions {
  // Data setters
  setProfile: (profile: DriverProfile | null) => void
  setDisplayNameFallback: (name: string | null) => void
  setResumes: (resumes: ResumeData[]) => void
  setDotApplications: (apps: DotApplicationRecord[]) => void
  setMvrRecords: (records: MvrRecord[]) => void
  setJobApplications: (apps: JobApplication[]) => void
  setStats: (stats: DriverHubStats | null) => void
  setPortfolio: (portfolio: { portfolioUrl: string | null } | null) => void
  setGithub: (github: { username: string | null } | null) => void
  
  // Loading state
  setIsLoading: (loading: boolean) => void
  setIsRefreshing: (refreshing: boolean) => void
  setFetchError: (error: string | null) => void
  
  // Resume actions
  setHasResume: (has: boolean) => void
  setLatestResumeIpfsHash: (hash: string | null) => void
  setResumeUploadEvent: (event: ResumeUploadEvent | null) => void
  addResume: (resume: ResumeData) => void
  updateResume: (id: string, updates: Partial<ResumeData>) => void
  removeResume: (id: string) => void
  
  // DOT application actions
  addDotApplication: (app: DotApplicationRecord) => void
  updateDotApplication: (id: string, updates: Partial<DotApplicationRecord>) => void
  
  // MVR actions
  setSelectedMvrOrderId: (id: string | null) => void
  setIsMvrModalOpen: (open: boolean) => void
  setIsMvrManagementOpen: (open: boolean) => void
  addMvrRecord: (record: MvrRecord) => void
  
  // Compound actions
  loadHubData: (data: {
    profile?: DriverProfile | null
    displayNameFallback?: string | null
    resumes?: ResumeData[]
    dotApplications?: DotApplicationRecord[]
    mvrRecords?: MvrRecord[]
    jobApplications?: JobApplication[]
    stats?: DriverHubStats | null
    portfolio?: { portfolioUrl: string | null } | null
    github?: { username: string | null } | null
  }) => void
  
  clearHubData: () => void
  
  // Refresh trigger
  triggerRefresh: () => void
}

const initialStats: DriverHubStats = {
  profileCompleteness: 0,
  totalResumes: 0,
  verifiedResumes: 0,
  totalDotApps: 0,
  verifiedDotApps: 0,
  completedDotApps: 0,
  inProgressDotApps: 0,
  totalMvrRecords: 0,
  validMvrRecords: 0,
  totalJobApplications: 0,
  pendingApplications: 0,
  totalSpentUSDC: 0,
}

const initialState: DriverHubState = {
  profile: null,
  displayNameFallback: null,
  resumes: [],
  dotApplications: [],
  mvrRecords: [],
  jobApplications: [],
  portfolio: null,
  github: null,
  stats: initialStats,
  isLoading: true,
  isRefreshing: false,
  lastFetchedAt: null,
  fetchError: null,
  hasResume: false,
  latestResumeIpfsHash: null,
  resumeUploadEvent: null,
  selectedMvrOrderId: null,
  isMvrModalOpen: false,
  isMvrManagementOpen: false,
}

export const useDriverHubStore = create<DriverHubState & DriverHubActions>()(
  (set, get) => ({
    ...initialState,

    // Data setters
    setProfile: (profile) => set({ profile }),
    setDisplayNameFallback: (name) => set({ displayNameFallback: name }),
    setResumes: (resumes) => set({ 
      resumes, 
      hasResume: resumes.length > 0,
      latestResumeIpfsHash: resumes[0]?.ipfsHash ?? null,
    }),
    setDotApplications: (apps) => set({ dotApplications: apps }),
    setMvrRecords: (records) => set({ mvrRecords: records }),
    setJobApplications: (apps) => set({ jobApplications: apps }),
    setStats: (stats) => set({ stats }),
    setPortfolio: (portfolio) => set({ portfolio }),
    setGithub: (github) => set({ github }),

    // Loading state
    setIsLoading: (loading) => set({ isLoading: loading }),
    setIsRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
    setFetchError: (error) => set({ fetchError: error }),

    // Resume actions
    setHasResume: (has) => set({ hasResume: has }),
    setLatestResumeIpfsHash: (hash) => set({ latestResumeIpfsHash: hash }),
    setResumeUploadEvent: (event) => set({ resumeUploadEvent: event }),
    
    addResume: (resume) => set((state) => ({
      resumes: [resume, ...state.resumes],
      hasResume: true,
      latestResumeIpfsHash: resume.ipfsHash,
    })),
    
    updateResume: (id, updates) => set((state) => ({
      resumes: state.resumes.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),
    
    removeResume: (id) => set((state) => {
      const newResumes = state.resumes.filter((r) => r.id !== id)
      return {
        resumes: newResumes,
        hasResume: newResumes.length > 0,
        latestResumeIpfsHash: newResumes[0]?.ipfsHash ?? null,
      }
    }),

    // DOT application actions
    addDotApplication: (app) => set((state) => ({
      dotApplications: [app, ...state.dotApplications],
      stats: state.stats ? {
        ...state.stats,
        totalDotApps: state.stats.totalDotApps + 1,
        completedDotApps: app.isComplete 
          ? state.stats.completedDotApps + 1 
          : state.stats.completedDotApps,
        inProgressDotApps: app.isInProgress 
          ? state.stats.inProgressDotApps + 1 
          : state.stats.inProgressDotApps,
      } : null,
    })),
    
    updateDotApplication: (id, updates) => set((state) => ({
      dotApplications: state.dotApplications.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

    // MVR actions
    setSelectedMvrOrderId: (id) => set({ selectedMvrOrderId: id }),
    setIsMvrModalOpen: (open) => set({ isMvrModalOpen: open }),
    setIsMvrManagementOpen: (open) => set({ isMvrManagementOpen: open }),
    
    addMvrRecord: (record) => set((state) => ({
      mvrRecords: [record, ...state.mvrRecords],
      stats: state.stats ? {
        ...state.stats,
        totalMvrRecords: state.stats.totalMvrRecords + 1,
      } : null,
    })),

    // Compound actions
    loadHubData: (data) => set({
      profile: data.profile ?? get().profile,
      displayNameFallback: data.displayNameFallback ?? get().displayNameFallback,
      resumes: data.resumes ?? get().resumes,
      dotApplications: data.dotApplications ?? get().dotApplications,
      mvrRecords: data.mvrRecords ?? get().mvrRecords,
      jobApplications: data.jobApplications ?? get().jobApplications,
      stats: data.stats ?? get().stats,
      portfolio: data.portfolio ?? get().portfolio,
      github: data.github ?? get().github,
      hasResume: (data.resumes ?? get().resumes).length > 0,
      latestResumeIpfsHash: (data.resumes ?? get().resumes)[0]?.ipfsHash ?? null,
      isLoading: false,
      isRefreshing: false,
      lastFetchedAt: new Date().toISOString(),
      fetchError: null,
    }),

    clearHubData: () => set(initialState),

    triggerRefresh: () => set({ isRefreshing: true }),
  })
)

// Selector hooks for common patterns
export const useDotApplications = () => useDriverHubStore((state) => state.dotApplications)
export const useResumes = () => useDriverHubStore((state) => state.resumes)
export const useHubStats = () => useDriverHubStore((state) => state.stats)
export const useHubIsLoading = () => useDriverHubStore((state) => state.isLoading)
