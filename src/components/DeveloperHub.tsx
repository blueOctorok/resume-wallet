'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh'
import ShareProfileCard from './ShareProfileCard'
import DeveloperEmploymentVerificationSection from './verification/DeveloperEmploymentVerificationSection'
import CandidateRequestsSection from './CandidateRequestsSection'
import DeveloperResumeBuilder from './DeveloperResumeBuilder'
import DeveloperResumePreviewModal from './DeveloperResumePreviewModal'
import UploadResumeModal from './UploadResumeModal'
import type { DeveloperResumeData } from './DeveloperResumeBuilder'
import {
  Code2,
  FileText,
  Github,
  Briefcase,
  Plus,
  Upload,
  Folder,
  ExternalLink,
  Loader2,
  User,
  TrendingUp,
  Sparkles,
  Globe,
  Terminal,
  Star,
  Edit,
  X,
  Check,
  Shield,
  Download,
  Eye,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface DeveloperHubProps {
  userAddress: string | null
  onNavigate: (
    page: 'portfolio' | 'resume' | 'github' | 'jobs' | 'applications'
  ) => void
}

interface DeveloperStats {
  profileCompleteness: number
  totalProjects: number
  featuredProjects: number
  githubConnected: boolean
  totalJobApplications: number
}

interface CareerScore {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: {
    github: { score: number; weight: number; factors: Record<string, number> }
    portfolio: {
      score: number
      weight: number
      factors: Record<string, number>
    }
    profile: { score: number; weight: number; factors: Record<string, number> }
  }
  suggestions: string[]
  analyzedAt: string
}

interface Project {
  id: string
  title: string
  description: string | null
  techStack: string[]
  liveUrl: string | null
  repoUrl: string | null
  thumbnailUrl: string | null
  isFeatured: boolean
}

interface DeveloperProfile {
  id: string
  firstName: string | null
  lastName: string | null
  displayName: string | null
  headline: string | null
  bio: string | null
  portfolioUrl: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  personalWebsite: string | null
  githubUsername: string | null
  githubConnected: boolean // True if OAuth token is stored
}

interface HubData {
  success: boolean
  isNewUser: boolean
  userId?: string // The users table ID - needed for career score API
  profile: DeveloperProfile | null
  projects: Project[]
  stats: DeveloperStats
}

// ============================================================
// DEVELOPER HUB COMPONENT
// ============================================================

export default function DeveloperHub({
  userAddress,
  onNavigate,
}: DeveloperHubProps) {
  const { theme } = useTheme()
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<DeveloperProfile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<DeveloperStats>({
    profileCompleteness: 15,
    totalProjects: 0,
    featuredProjects: 0,
    githubConnected: false,
    totalJobApplications: 0,
  })

  // Resume state
  interface DeveloperResume {
    id: string
    title: string
    structured_data: DeveloperResumeData
    verification_status: string
    blockchain_tx_hash?: string
    ipfs_hash?: string
    created_at: string
  }
  const [resumes, setResumes] = useState<DeveloperResume[]>([])
  const [showResumeBuilder, setShowResumeBuilder] = useState(false)
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null)
  const [previewResume, setPreviewResume] = useState<DeveloperResume | null>(
    null
  )
  const [showUploadResumeModal, setShowUploadResumeModal] = useState(false)

  // Career Score state
  const [careerScore, setCareerScore] = useState<CareerScore | null>(null)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [showScoreDetails, setShowScoreDetails] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Fetch developer resumes
  const fetchResumes = useCallback(async () => {
    if (!userAddress) return
    try {
      const res = await fetch('/api/developer/resume', {
        headers: { 'x-wallet-address': userAddress },
      })
      if (res.ok) {
        const data = await res.json()
        setResumes(data.resumes || [])
      }
    } catch (error) {
      console.error('Error fetching resumes:', error)
    }
  }, [userAddress])

  // Calculate career score using AI
  const calculateCareerScore = useCallback(
    async (forceRefresh = false) => {
      if (!userAddress || !userId) return

      setScoreLoading(true)
      try {
        const res = await fetch('/api/ai/career-score', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': userAddress,
          },
          body: JSON.stringify({ userId, forceRefresh }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setCareerScore({
              score: data.score,
              grade: data.grade,
              breakdown: data.breakdown,
              suggestions: data.suggestions,
              analyzedAt: data.analyzedAt,
            })
          }
        }
      } catch (error) {
        console.error('[DEVELOPER HUB] Error calculating career score:', error)
      } finally {
        setScoreLoading(false)
      }
    },
    [userAddress, userId]
  )

  // Fetch hub data from API
  const fetchHubData = useCallback(async () => {
    if (!userAddress) {
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/developer/hub', {
        headers: { 'x-wallet-address': userAddress },
      })

      if (!response.ok) throw new Error('Failed to fetch hub data')

      const data: HubData = await response.json()

      setProfile(data.profile || null)
      setProjects(data.projects || [])
      setStats(
        data.stats || {
          profileCompleteness: 15,
          totalProjects: 0,
          featuredProjects: 0,
          githubConnected: false,
          totalJobApplications: 0,
        }
      )

      // Store userId for career score calculation (from users table, not profile table)
      if (data.userId) {
        setUserId(data.userId)
      }
    } catch (error) {
      console.error('[DEVELOPER HUB] Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    fetchHubData()
    fetchResumes()
  }, [fetchHubData, fetchResumes])

  // Combined refresh function for all hub data
  const refreshAllData = useCallback(async () => {
    await Promise.all([fetchHubData(), fetchResumes()])
  }, [fetchHubData, fetchResumes])

  // Auto-refresh when tab becomes visible (solves stale data after changes in other tabs)
  const { refresh: triggerRefresh, isStale } = useVisibilityRefresh(refreshAllData, {
    staleTime: 30000, // Consider data stale after 30 seconds
    enabled: !!userAddress,
  })

  // Auto-calculate career score when profile is loaded
  useEffect(() => {
    if (userId && profile) {
      calculateCareerScore()
    }
  }, [userId, profile, calculateCareerScore])

  // ============================================================
  // PROFILE COMPLETENESS
  // ============================================================

  const getCompletenessHint = () => {
    if (stats.totalProjects === 0)
      return 'Add your first project to your portfolio'
    if (!stats.githubConnected)
      return 'Connect your GitHub to showcase your work'
    if (stats.totalJobApplications === 0)
      return 'Apply to jobs to get discovered'
    return 'Your profile is looking great!'
  }

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const StatCard = ({
    icon: Icon,
    label,
    value,
    subValue,
    color,
    iconClassName,
    onClick,
  }: {
    icon: React.ElementType
    label: string
    value: number | string
    subValue?: string
    color: string
    iconClassName?: string
    onClick?: () => void
  }) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`p-4 rounded-xl border text-left transition-all ${
        onClick ? 'hover:scale-[1.02] cursor-pointer' : 'cursor-default'
      } ${
        theme === 'dark'
          ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
          : 'bg-white/70 border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className='flex items-center gap-3'>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className={`w-5 h-5 ${iconClassName ?? 'text-white'}`} />
        </div>
        <div>
          <p
            className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            {value}
          </p>
          <p
            className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {label}
          </p>
          {subValue && (
            <p
              className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
            >
              {subValue}
            </p>
          )}
        </div>
      </div>
    </button>
  )

  const EmptySection = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    color,
    iconClassName,
  }: {
    icon: React.ElementType
    title: string
    description: string
    actionLabel: string
    onAction: () => void
    color: string
    iconClassName?: string
  }) => (
    <div
      className={`text-center py-12 px-6 rounded-xl border-2 border-dashed ${
        theme === 'dark'
          ? 'border-gray-700 bg-gray-800/30'
          : 'border-gray-300 bg-gray-50/50'
      }`}
    >
      <div className={`inline-flex p-4 rounded-full ${color} mb-4`}>
        <Icon className={`w-8 h-8 ${iconClassName ?? 'text-white'}`} />
      </div>
      <h3
        className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
      >
        {title}
      </h3>
      <p
        className={`text-sm mb-4 max-w-sm mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
      >
        {description}
      </p>
      <button
        onClick={onAction}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium transition-all ${
          theme === 'dark'
            ? 'border-gray-600 bg-indigo-500/20 text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/30'
            : 'border-gray-300 bg-indigo-50 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-100'
        }`}
      >
        <Plus className='w-4 h-4' />
        {actionLabel}
      </button>
    </div>
  )

  // Project card for hub view (compact version)
  const ProjectCard = ({ project }: { project: Project }) => (
    <div
      className={`p-3 rounded-lg border ${
        theme === 'dark'
          ? 'bg-gray-700/50 border-gray-600'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2'>
            <h4
              className={`font-medium truncate ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {project.title}
            </h4>
            {project.isFeatured && (
              <Star className='w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0' />
            )}
          </div>
          {project.description && (
            <p
              className={`text-sm truncate ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {project.description}
            </p>
          )}
          {project.techStack.length > 0 && (
            <div className='flex flex-wrap gap-1 mt-1'>
              {project.techStack.slice(0, 3).map((tech) => (
                <span
                  key={tech}
                  className={`px-1.5 py-0.5 rounded text-xs ${
                    theme === 'dark'
                      ? 'bg-gray-600 text-gray-300'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {tech}
                </span>
              ))}
              {project.techStack.length > 3 && (
                <span
                  className={`text-xs ${
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  +{project.techStack.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
        <div className='flex items-center gap-1 flex-shrink-0'>
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target='_blank'
              rel='noopener noreferrer'
              className={`p-1 rounded ${
                theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
              }`}
            >
              <Globe className={`w-4 h-4 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </a>
          )}
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target='_blank'
              rel='noopener noreferrer'
              className={`p-1 rounded ${
                theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
              }`}
            >
              <Github className='w-4 h-4' />
            </a>
          )}
        </div>
      </div>
    </div>
  )

  // ============================================================
  // MAIN RENDER
  // ============================================================

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <div className='text-center'>
          <Loader2
            className={`w-12 h-12 animate-spin mx-auto mb-4 ${
              theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
            }`}
          />
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Loading your developer hub...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-6xl mx-auto space-y-6 px-4 pb-8'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-2'>
            <h1
              className={`text-2xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Developer Hub
            </h1>
            {/* Manual refresh button */}
            <button
              onClick={triggerRefresh}
              disabled={isLoading}
              title={isStale ? 'Data may be stale - click to refresh' : 'Refresh data'}
              className={`p-1.5 rounded-lg transition-all ${
                isLoading
                  ? 'opacity-50 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              } ${isStale ? 'text-amber-500' : ''}`}
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p
            className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
          >
            Showcase your work, connect with employers
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Terminal
            className={`w-8 h-8 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}
          />
        </div>
      </div>

      {/* Profile Completeness */}
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          theme === 'dark'
            ? 'bg-gray-800/50 border-gray-700'
            : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <User
              className={`w-5 h-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}
            />
            <span
              className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Profile Completeness
            </span>
          </div>
          <span
            className={`text-lg font-bold ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}
          >
            {stats.profileCompleteness}%
          </span>
        </div>
        <div
          className={`h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
        >
          <div
            className='h-full bg-indigo-500/50 rounded-full transition-all duration-500'
            style={{ width: `${stats.profileCompleteness}%` }}
          />
        </div>
        <p
          className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
        >
          <TrendingUp className='w-4 h-4 inline mr-1' />
          {getCompletenessHint()}
        </p>
      </div>

      {/* Quick Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        <StatCard
          icon={Folder}
          label='Projects'
          value={stats.totalProjects}
          subValue={
            stats.featuredProjects > 0
              ? `${stats.featuredProjects} featured`
              : 'in portfolio'
          }
          color={theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-50'}
          iconClassName={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}
          onClick={() => onNavigate('portfolio')}
        />
        <StatCard
          icon={FileText}
          label='Resumes'
          value={resumes.length}
          subValue={
            resumes.some((r) => r.verification_status === 'VERIFIED')
              ? 'verified'
              : resumes.length > 0
                ? 'pending'
                : undefined
          }
          color='bg-purple-500'
          onClick={() => onNavigate('resume')}
        />
        <StatCard
          icon={Github}
          label='GitHub'
          value={stats.githubConnected ? 'Connected' : 'Not Connected'}
          color='bg-gray-700'
          onClick={() => onNavigate('github')}
        />
        <StatCard
          icon={Briefcase}
          label='Applications'
          value={stats.totalJobApplications}
          subValue='submitted'
          color='bg-emerald-500'
          onClick={() => onNavigate('applications')}
        />
      </div>

      {/* StormChain Tokens (Coming Soon) */}
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          theme === 'dark'
            ? 'bg-gray-800/50 border-gray-700'
            : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500'>
              <Sparkles className='w-5 h-5 text-white' />
            </div>
            <div>
              <p
                className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                StormChain Tokens
              </p>
              <p
                className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Coming Soon — Earn tokens for verified work
              </p>
            </div>
          </div>
          <span
            className={`text-2xl font-bold ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}
          >
            0
          </span>
        </div>
      </div>

      {/* AI Career Score */}
      <div
        className={`p-4 sm:p-6 rounded-xl border ${
          theme === 'dark'
            ? 'bg-gray-800/50 border-gray-700'
            : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <div
              className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200'
              }`}
            >
              <TrendingUp className={`w-5 h-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <div>
              <p
                className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                AI Career Score
              </p>
              <p
                className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                AI-analyzed based on GitHub, portfolio & profile
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <button
              onClick={triggerRefresh}
              disabled={isLoading}
              title='Refresh section'
              className={`p-2 rounded-lg transition-all ${
                isLoading ? 'opacity-50 cursor-not-allowed' : theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              } ${isStale ? 'text-amber-500' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

          {/* Score Display */}
          <div className='flex items-center gap-4'>
            {scoreLoading ? (
              <Loader2 className='w-6 h-6 animate-spin text-indigo-400' />
            ) : careerScore ? (
              <button
                onClick={() => setShowScoreDetails(!showScoreDetails)}
                className='flex items-center gap-2 group'
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-all group-hover:scale-105 ${
                    careerScore.grade === 'A'
                      ? 'bg-green-500/20 text-green-400 border-green-500/50'
                      : careerScore.grade === 'B'
                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                        : careerScore.grade === 'C'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                          : careerScore.grade === 'D'
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/50'
                  }`}
                >
                  {careerScore.grade}
                </div>
                <div className='text-left'>
                  <p
                    className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    {careerScore.score}
                  </p>
                  <p className='text-xs text-gray-500'>/ 100</p>
                </div>
              </button>
            ) : profile ? (
              <button
                onClick={() => calculateCareerScore()}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                }`}
              >
                Calculate Score
              </button>
            ) : (
              <p
                className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
              >
                Complete profile first
              </p>
            )}
          </div>

        {/* Score Breakdown (expandable) */}
        {showScoreDetails && careerScore && (
          <div
            className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}
          >
            {/* Category Scores */}
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4'>
              <div
                className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}
              >
                <div className='flex items-center justify-between mb-2'>
                  <span
                    className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    <Github className='w-4 h-4 inline mr-1' />
                    GitHub
                  </span>
                  <span
                    className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    {careerScore.breakdown.github.score}/100
                  </span>
                </div>
                <div
                  className={`h-2 rounded-full ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`}
                >
                  <div
                    className='h-full rounded-full bg-gray-500'
                    style={{ width: `${careerScore.breakdown.github.score}%` }}
                  />
                </div>
              </div>

              <div
                className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}
              >
                <div className='flex items-center justify-between mb-2'>
                  <span
                    className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    <Folder className='w-4 h-4 inline mr-1' />
                    Portfolio
                  </span>
                  <span
                    className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    {careerScore.breakdown.portfolio.score}/100
                  </span>
                </div>
                <div
                  className={`h-2 rounded-full ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`}
                >
                  <div
                    className='h-full rounded-full bg-indigo-500/60'
                    style={{
                      width: `${careerScore.breakdown.portfolio.score}%`,
                    }}
                  />
                </div>
              </div>

              <div
                className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}
              >
                <div className='flex items-center justify-between mb-2'>
                  <span
                    className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    <User className='w-4 h-4 inline mr-1' />
                    Profile
                  </span>
                  <span
                    className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    {careerScore.breakdown.profile.score}/100
                  </span>
                </div>
                <div
                  className={`h-2 rounded-full ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`}
                >
                  <div
                    className='h-full rounded-full bg-purple-500'
                    style={{ width: `${careerScore.breakdown.profile.score}%` }}
                  />
                </div>
              </div>
            </div>

            {/* AI Suggestions */}
            {careerScore.suggestions.length > 0 && (
              <div
                className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-indigo-50 border border-indigo-200'}`}
              >
                <p
                  className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'}`}
                >
                  <Sparkles className='w-4 h-4 inline mr-1' />
                  AI Suggestions to Improve
                </p>
                <ul className='space-y-1'>
                  {careerScore.suggestions.map((suggestion, i) => (
                    <li
                      key={i}
                      className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      • {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Last analyzed & refresh */}
            <div className='flex items-center justify-between mt-3'>
              <p
                className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
              >
                Last analyzed:{' '}
                {new Date(careerScore.analyzedAt).toLocaleDateString()}
              </p>
              <button
                onClick={() => calculateCareerScore(true)}
                disabled={scoreLoading}
                className={`text-xs px-2 py-1 rounded ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                {scoreLoading ? 'Analyzing...' : 'Refresh Score'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Career Card */}
      <ShareProfileCard userAddress={userAddress} userRole='developer' />

      {/* Employment Verification - Developer only (resume / profile data) */}
      <div className="mb-6">
        <DeveloperEmploymentVerificationSection userAddress={userAddress} />
      </div>

      {/* Employer Requests - Requests from interested employers */}
      <div className="mb-6">
        <CandidateRequestsSection
          userAddress={userAddress}
          onNavigateToResume={() => onNavigate('resume')}
        />
      </div>

      {/* Main Sections Grid */}
      <div className='grid lg:grid-cols-2 gap-6'>
        {/* Portfolio Section */}
        <div
          className={`p-4 sm:p-6 rounded-xl border ${
            theme === 'dark'
              ? 'bg-gray-800/50 border-gray-700'
              : 'bg-white/70 border-gray-200'
          }`}
        >
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              <Folder
                className={`w-5 h-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}
              />
              <h2
                className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                Portfolio
              </h2>
            </div>
            <div className='flex items-center gap-2'>
              <button
                onClick={triggerRefresh}
                disabled={isLoading}
                title='Refresh section'
                className={`p-2 rounded-lg transition-all ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : theme === 'dark'
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                } ${isStale ? 'text-amber-500' : ''}`}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate('portfolio')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  theme === 'dark'
                    ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                    : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                }`}
              >
                {stats.totalProjects > 0 ? 'View All →' : 'Add Projects →'}
              </button>
            </div>
          </div>

          {stats.totalProjects === 0 ? (
            <EmptySection
              icon={Code2}
              title='No Projects Yet'
              description='Add your projects, side hustles, and case studies. Show employers what you can build.'
              actionLabel='Add Project'
              onAction={() => onNavigate('portfolio')}
              color={theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-50'}
              iconClassName={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}
            />
          ) : (
            <div className='space-y-2'>
              {projects.slice(0, 3).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {projects.length > 3 && (
                <button
                  onClick={() => onNavigate('portfolio')}
                  className={`w-full rounded-lg border py-2 text-center text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                      : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  View all {projects.length} projects →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Resume Section */}
        <div
          className={`p-4 sm:p-6 rounded-xl border ${
            theme === 'dark'
              ? 'bg-gray-800/50 border-gray-700'
              : 'bg-white/70 border-gray-200'
          }`}
        >
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              <FileText
                className={`w-5 h-5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}
              />
              <h2
                className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                Tech Resume
              </h2>
            </div>
            <div className='flex items-center gap-2'>
              <button
                onClick={triggerRefresh}
                disabled={isLoading}
                title='Refresh section'
                className={`p-2 rounded-lg transition-all ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : theme === 'dark'
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                } ${isStale ? 'text-amber-500' : ''}`}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowUploadResumeModal(true)}
                className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  theme === 'dark'
                    ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                    : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                }`}
              >
                <Upload className='w-4 h-4' />
                Upload Resume
              </button>
              {resumes.length > 0 && (
                <button
                  onClick={() => {
                    setEditingResumeId(null)
                    setShowResumeBuilder(true)
                  }}
                  className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'border-gray-600 text-indigo-400 hover:border-indigo-500/50 hover:text-indigo-300'
                      : 'border-gray-300 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  <Plus className='w-4 h-4' />
                  New Resume
                </button>
              )}
            </div>
          </div>

          {resumes.length === 0 ? (
            <EmptySection
              icon={FileText}
              title='Tech Resume Builder'
              description='Build a tech-focused resume highlighting your skills, projects, and experience. Verify it on blockchain!'
              actionLabel='Create Resume'
              onAction={() => {
                setEditingResumeId(null)
                setShowResumeBuilder(true)
              }}
              color='bg-purple-500'
            />
          ) : (
            <div className='space-y-3'>
              {resumes.map((resume) => (
                <div
                  key={resume.id}
                  className={`p-4 rounded-xl border ${
                    theme === 'dark'
                      ? 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  } transition-colors`}
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-2'>
                        <h3
                          className={`font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {resume.title}
                        </h3>
                        {resume.verification_status === 'VERIFIED' && (
                          <span className='flex items-center gap-1 text-xs text-green-400'>
                            <CheckCircle className='w-3 h-3' />
                            Verified
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-1 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        Created{' '}
                        {new Date(resume.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => setPreviewResume(resume)}
                        className={`p-2 rounded-lg ${
                          theme === 'dark'
                            ? 'hover:bg-gray-600 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                        }`}
                        title='Preview'
                      >
                        <Eye className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => {
                          setEditingResumeId(resume.id)
                          setShowResumeBuilder(true)
                        }}
                        className={`p-2 rounded-lg ${
                          theme === 'dark'
                            ? 'hover:bg-gray-600 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                        }`}
                        title='Edit'
                      >
                        <Edit className='w-4 h-4' />
                      </button>
                      {resume.verification_status !== 'VERIFIED' && (
                        <button
                          onClick={() => setPreviewResume(resume)}
                          className='p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                          title='Verify on Blockchain'
                        >
                          <Shield className='w-4 h-4' />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GitHub Section */}
        <div
          className={`p-4 sm:p-6 rounded-xl border ${
            theme === 'dark'
              ? 'bg-gray-800/50 border-gray-700'
              : 'bg-white/70 border-gray-200'
          }`}
        >
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              <Github
                className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}
              />
              <h2
                className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                GitHub
              </h2>
            </div>
            <div className='flex items-center gap-2'>
              <button
                onClick={triggerRefresh}
                disabled={isLoading}
                title='Refresh section'
                className={`p-2 rounded-lg transition-all ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : theme === 'dark'
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                } ${isStale ? 'text-amber-500' : ''}`}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {profile?.githubConnected && (
                <span className='flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400'>
                  <Check className='w-3 h-3' />
                  Connected
                </span>
              )}
            </div>
          </div>

          {profile?.githubConnected ? (
            <div className='space-y-3'>
              <div
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                }`}
              >
                <Github
                  className={`w-8 h-8 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                />
                <div>
                  <p
                    className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    @{profile.githubUsername}
                  </p>
                  <p
                    className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    Private repos included on Career Card
                  </p>
                </div>
              </div>
              <p
                className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Your GitHub is connected! Your Career Card now shows private
                repo stats and full contribution data.
              </p>
            </div>
          ) : (
            <div className='text-center py-6'>
              <div
                className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gray-700`}
              >
                <Github className='w-8 h-8 text-white' />
              </div>
              <h3
                className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                Connect GitHub
              </h3>
              <p
                className={`text-sm mb-4 max-w-xs mx-auto ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Link your GitHub to show private repos, real contribution stats,
                and give employers the full picture.
              </p>
              <button
                onClick={() => {
                  if (userAddress) {
                    window.location.href = `/api/github/oauth?wallet=${encodeURIComponent(userAddress)}`
                  }
                }}
                disabled={!userAddress}
                className='inline-flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50'
              >
                <Github className='w-5 h-5' />
                Connect GitHub
              </button>
              <p
                className={`text-xs mt-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
              >
                We only read repo data — we never modify anything
              </p>
            </div>
          )}
        </div>

        {/* Job Applications Section */}
        <div
          className={`p-4 sm:p-6 rounded-xl border ${
            theme === 'dark'
              ? 'bg-gray-800/50 border-gray-700'
              : 'bg-white/70 border-gray-200'
          }`}
        >
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              <Briefcase
                className={`w-5 h-5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}
              />
              <h2
                className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                Job Applications
              </h2>
            </div>
            <div className='flex items-center gap-2'>
              <button
                onClick={triggerRefresh}
                disabled={isLoading}
                title='Refresh section'
                className={`p-2 rounded-lg transition-all ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : theme === 'dark'
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                } ${isStale ? 'text-amber-500' : ''}`}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate('jobs')}
                className={`text-sm font-medium ${theme === 'dark' ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
              >
                Browse Jobs →
              </button>
            </div>
          </div>

          {stats.totalJobApplications === 0 ? (
            <EmptySection
              icon={Briefcase}
              title='No Applications Yet'
              description='Browse open positions and apply with your Career Card. Stand out from the crowd.'
              actionLabel='Find Jobs'
              onAction={() => onNavigate('jobs')}
              color='bg-emerald-500'
            />
          ) : (
            <div className='space-y-3'>
              {/* Applications would render here */}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div
        className={`p-4 rounded-xl border ${
          theme === 'dark'
            ? 'bg-gray-800/30 border-gray-700'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <h3
          className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Quick Links
        </h3>
        <div className='flex flex-wrap gap-2'>
          {[
            { label: 'Portfolio', icon: Folder, page: 'portfolio' as const },
            { label: 'Resume', icon: FileText, page: 'resume' as const },
            { label: 'GitHub', icon: Github, page: 'github' as const },
            { label: 'Jobs', icon: Briefcase, page: 'jobs' as const },
          ].map(({ label, icon: Icon, page }) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Icon className='w-4 h-4' />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Resume Builder Full Screen */}
      {showResumeBuilder && (
        <div className='fixed inset-0 z-50 flex flex-col overflow-hidden bg-gray-900'>
          <DeveloperResumeBuilder
            userAddress={userAddress}
            existingResumeId={editingResumeId || undefined}
            onBack={() => {
              setShowResumeBuilder(false)
              setEditingResumeId(null)
              fetchResumes()
            }}
            onSave={() => {
              fetchResumes()
            }}
          />
        </div>
      )}

      {/* Resume Preview Modal */}
      {previewResume && userAddress && (
        <DeveloperResumePreviewModal
          resume={previewResume}
          userAddress={userAddress}
          onClose={() => setPreviewResume(null)}
          onEdit={() => {
            setEditingResumeId(previewResume.id)
            setPreviewResume(null)
            setShowResumeBuilder(true)
          }}
          onVerify={() => {
            fetchResumes()
            setPreviewResume(null)
          }}
          onDelete={() => {
            fetchResumes()
            setPreviewResume(null)
          }}
        />
      )}

      <UploadResumeModal
        isOpen={showUploadResumeModal}
        onClose={() => setShowUploadResumeModal(false)}
        user={userAddress ? { address: userAddress } : null}
        onUploadComplete={() => fetchResumes()}
      />
    </div>
  )
}
