'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import ShareProfileCard from './ShareProfileCard'
import DeveloperResumeBuilder from './DeveloperResumeBuilder'
import DeveloperResumePreviewModal from './DeveloperResumePreviewModal'
import type { DeveloperResumeData } from './DeveloperResumeBuilder'
import {
  Code2,
  FileText,
  Github,
  Briefcase,
  Plus,
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
    onClick,
  }: {
    icon: React.ElementType
    label: string
    value: number | string
    subValue?: string
    color: string
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
          <Icon className='w-5 h-5 text-white' />
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
  }: {
    icon: React.ElementType
    title: string
    description: string
    actionLabel: string
    onAction: () => void
    color: string
  }) => (
    <div
      className={`text-center py-12 px-6 rounded-xl border-2 border-dashed ${
        theme === 'dark'
          ? 'border-gray-700 bg-gray-800/30'
          : 'border-gray-300 bg-gray-50/50'
      }`}
    >
      <div className={`inline-flex p-4 rounded-full ${color} mb-4`}>
        <Icon className='w-8 h-8 text-white' />
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
        className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 transition-all'
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
              <Globe className='w-4 h-4 text-indigo-500' />
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
          <h1
            className={`text-2xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            Developer Hub
          </h1>
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
            className='h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500'
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
          color='bg-indigo-500'
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

      {/* Career Card */}
      <ShareProfileCard userAddress={userAddress} userRole='developer' />

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
            <button
              onClick={() => onNavigate('portfolio')}
              className={`text-sm font-medium ${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
            >
              {stats.totalProjects > 0 ? 'View All →' : 'Add Projects →'}
            </button>
          </div>

          {stats.totalProjects === 0 ? (
            <EmptySection
              icon={Code2}
              title='No Projects Yet'
              description='Add your projects, side hustles, and case studies. Show employers what you can build.'
              actionLabel='Add Project'
              onAction={() => onNavigate('portfolio')}
              color='bg-indigo-500'
            />
          ) : (
            <div className='space-y-2'>
              {projects.slice(0, 3).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {projects.length > 3 && (
                <button
                  onClick={() => onNavigate('portfolio')}
                  className={`w-full text-center py-2 text-sm font-medium rounded-lg ${
                    theme === 'dark'
                      ? 'text-indigo-400 hover:bg-gray-700/50'
                      : 'text-indigo-600 hover:bg-gray-100'
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
            {resumes.length > 0 && (
              <button
                onClick={() => {
                  setEditingResumeId(null)
                  setShowResumeBuilder(true)
                }}
                className='flex items-center gap-1 text-sm text-brand-mint hover:underline'
              >
                <Plus className='w-4 h-4' />
                New Resume
              </button>
            )}
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
            {profile?.githubConnected && (
              <span className='flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400'>
                <Check className='w-3 h-3' />
                Connected
              </span>
            )}
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
            <button
              onClick={() => onNavigate('jobs')}
              className={`text-sm font-medium ${theme === 'dark' ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
            >
              Browse Jobs →
            </button>
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
    </div>
  )
}
