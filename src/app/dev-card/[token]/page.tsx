'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  MapPin,
  FileText,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  Github,
  Briefcase,
  Mail,
  Phone,
  Globe,
  Code,
  Play,
  Star,
  Sparkles,
  User,
  Folder,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react'
import GitHubContributionGraph from '@/components/GitHubContributionGraph'

interface PublicProfile {
  id: string
  firstName: string | null
  lastName: string | null
  displayName: string | null
  location: string | null
  headline: string | null
  bio: string | null
  yearsExperience: number | null
  skills: Array<
    { name?: string; category?: string; proficiency?: string } | string
  >
  education: unknown[]
  certifications: unknown[]
  portfolioUrl: string | null
  githubUsername: string | null
  linkedinUrl: string | null
  personalWebsite: string | null
  contact?: { email: string | null; phone: string | null }
}

interface Project {
  id: string
  title: string
  description: string | null
  techStack: string[]
  liveUrl: string | null
  repoUrl: string | null
  demoVideoUrl: string | null
  isFeatured: boolean
}

interface ResumeStructuredData {
  personalInfo: {
    firstName: string
    lastName: string
    email: string
    phone: string
    location: string
    headline: string
    summary: string
    githubUrl: string
    linkedinUrl: string
    portfolioUrl: string
    personalWebsite: string
  }
  skills: Array<{
    id: string
    name: string
    category: string
    proficiency: string
  }>
  experience: Array<{
    id: string
    company: string
    title: string
    location: string
    startDate: string
    endDate: string
    isCurrent: boolean
    description: string
    achievements: string[]
    technologies: string[]
  }>
  projects: Array<{
    id: string
    name: string
    description: string
    role: string
    technologies: string[]
    liveUrl: string
    repoUrl: string
    highlights: string[]
  }>
  education: Array<{
    id: string
    institution: string
    degree: string
    field: string
    startDate: string
    endDate: string
    gpa: string
  }>
  certifications: Array<{
    id: string
    name: string
    issuer: string
    date: string
    url: string
  }>
}

interface Resume {
  id: string
  title: string
  filename: string
  verified: boolean
  blockchainVerified: boolean
  type: string
  createdAt: string
  ipfsHash: string | null
  structuredData?: ResumeStructuredData
}

interface GitHubData {
  connected: boolean
  publicRepos: number
  privateRepos: number
  totalRepos: number
  followers: number
  following: number
  publicGists: number
  avatarUrl: string
  bio: string | null
  repos: Array<{
    name: string
    description: string | null
    stars: number
    forks: number
    language: string | null
    url: string
    isPrivate: boolean
  }>
  languages: Array<{ language: string; count: number; percentage: number }>
}


interface VerifiedEmployment {
  companyName: string
  position: string
  startDate: string | null
  endDate: string | null
  status: string
}

interface ProfileData {
  success: boolean
  profile: PublicProfile
  projects: Project[]
  resume: Resume | null
  githubData: GitHubData | null
  verifiedEmployments?: VerifiedEmployment[]
  settings: { allowConnect: boolean }
  viewCount: number
}

export default function PublicDeveloperCard() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portfolioLoaded, setPortfolioLoaded] = useState(false)
  useEffect(() => {
    if (token) fetchProfile()
  }, [token])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/developer/public/${token}`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('Profile not found or sharing is disabled')
        } else {
          setError('Failed to load profile')
        }
        return
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Error fetching developer profile:', err)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  // Helper to extract YouTube video ID
  const getYouTubeId = (url: string) => {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    )
    return match ? match[1] : null
  }

  // Helper to extract Loom video ID
  const getLoomId = (url: string) => {
    const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
    return match ? match[1] : null
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 animate-spin text-indigo-400 mx-auto mb-4' />
          <p className='text-gray-400'>Loading Career Card...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4'>
        <div className='text-center max-w-md'>
          <AlertCircle className='w-16 h-16 text-red-500 mx-auto mb-4' />
          <h1 className='text-2xl font-bold text-white mb-2'>
            Profile Not Found
          </h1>
          <p className='text-gray-400 mb-6'>
            {error ||
              'This profile may have been removed or the link is invalid.'}
          </p>
          <a
            href='/'
            className='inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-500 transition-colors'
          >
            Go to Storm
          </a>
        </div>
      </div>
    )
  }

  const { profile, projects, resume, verifiedEmployments, settings } = data
  const displayName =
    profile.displayName ||
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    'Developer'

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'>
      {/* Decorative background elements */}
      <div className='fixed inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute top-0 right-0 w-96 h-96 bg-teal-600/5 rounded-full blur-3xl' />
        <div className='absolute bottom-0 left-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl' />
      </div>

      <header className='border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-20'>
        <div className='max-w-4xl mx-auto px-4 py-4 flex items-center justify-between'>
          <a href='/' className='flex items-center gap-2'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-600/20'>
              <span className='text-gray-900 font-bold text-sm'>S</span>
            </div>
            <span className='text-white font-semibold'>Storm</span>
          </a>
          <div className='flex items-center gap-2'>
            <Sparkles className='w-4 h-4 text-teal-600 dark:text-teal-400' />
            <span className='text-xs text-gray-400'>Career Card</span>
          </div>
        </div>
      </header>

      <main className='max-w-4xl mx-auto px-4 py-8 relative z-10'>
        {/* Hero Profile Card */}
        <div className='bg-gradient-to-br from-gray-800/80 to-gray-800/40 backdrop-blur-xl rounded-3xl border border-gray-700/50 overflow-hidden mb-8 shadow-2xl'>
          {/* Gradient accent bar */}
          <div className='h-1 bg-gradient-to-r from-teal-600 via-teal-400 to-emerald-500' />

          <div className='p-8'>
            <div className='flex flex-col sm:flex-row items-start gap-6'>
              {/* Avatar with glow */}
              <div className='relative'>
                <div className='absolute inset-0 bg-teal-600/30 rounded-2xl blur-xl' />
                <div className='relative w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-600 via-teal-400 to-emerald-500 flex items-center justify-center shadow-xl'>
                  <span className='text-4xl font-bold text-gray-900'>
                    {profile.firstName?.[0] ?? profile.displayName?.[0] ?? 'D'}
                    {profile.lastName?.[0] ?? ''}
                  </span>
                </div>
              </div>

              <div className='flex-1 min-w-0'>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <h1 className='text-3xl font-bold text-white'>
                      {displayName}
                    </h1>
                    {profile.headline && (
                      <p className='text-lg text-teal-600 dark:text-teal-400 font-medium mt-1'>
                        {profile.headline}
                      </p>
                    )}
                  </div>
                  <div className='flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm border border-green-500/30'>
                    <CheckCircle className='w-4 h-4' />
                    Verified
                  </div>
                </div>

                <div className='flex flex-wrap items-center gap-4 mt-3 text-gray-400'>
                  {profile.location && (
                    <span className='flex items-center gap-1.5'>
                      <MapPin className='w-4 h-4' />
                      {profile.location}
                    </span>
                  )}
                  {profile.yearsExperience != null && (
                    <span className='flex items-center gap-1.5'>
                      <Briefcase className='w-4 h-4' />
                      {profile.yearsExperience}+ years
                    </span>
                  )}
                </div>

                {profile.bio && (
                  <p className='mt-4 text-gray-300 leading-relaxed'>
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Links Row */}
            <div className='flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-700/50'>
              {profile.githubUsername && (
                <a
                  href={`https://github.com/${profile.githubUsername}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105'
                >
                  <Github className='w-4 h-4' />@{profile.githubUsername}
                </a>
              )}
              {profile.linkedinUrl && (
                <a
                  href={profile.linkedinUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105'
                >
                  <Globe className='w-4 h-4' />
                  LinkedIn
                </a>
              )}
              {resume && (
                <a
                  href={
                    resume.ipfsHash && !resume.ipfsHash.startsWith('built_')
                      ? `https://gateway.pinata.cloud/ipfs/${resume.ipfsHash}`
                      : '#'
                  }
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-xl text-green-400 transition-all hover:scale-105 border border-green-500/30'
                >
                  <FileText className='w-4 h-4' />
                  View Resume
                  {resume.blockchainVerified && (
                    <CheckCircle className='w-3 h-3' />
                  )}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Verified Employment - Trust badges from past employers */}
        {verifiedEmployments && verifiedEmployments.length > 0 && (
          <div className='mb-8'>
            <div className='mb-4'>
              <h2 className='flex items-center gap-2 text-xl font-bold text-white'>
                <ShieldCheck className='w-5 h-5 text-green-400' />
                Verified Employment
              </h2>
              <p className='text-sm text-gray-400 mt-1'>
                Confirmed by previous employers — trust badges on your Career Card
              </p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              {verifiedEmployments.map((job, idx) => (
                <div
                  key={idx}
                  className='flex items-start gap-4 rounded-xl border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm p-4 transition-all hover:border-green-500/30 hover:bg-gray-800/70'
                >
                  <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20 border border-green-500/30'>
                    <CheckCircle className='h-5 w-5 text-green-400' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='font-semibold text-white'>
                      {job.position}
                    </p>
                    <p className='text-sm text-teal-600 dark:text-teal-400 font-medium'>
                      {job.companyName}
                    </p>
                    <p className='mt-1 text-xs text-gray-500'>
                      {job.startDate
                        ? new Date(job.startDate).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })
                        : ''}
                      {job.startDate && job.endDate ? ' – ' : ''}
                      {job.endDate
                        ? new Date(job.endDate).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })
                        : job.startDate ? 'Present' : ''}
                    </p>
                    {job.status === 'PARTIALLY_VERIFIED' && (
                      <span className='mt-2 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400 border border-amber-500/30'>
                        Partially verified
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Preview - The Hero Section */}
        {profile.portfolioUrl && (
          <div className='mb-8'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='flex items-center gap-2 text-xl font-bold text-white'>
                <Globe className='w-5 h-5 text-teal-600 dark:text-teal-400' />
                Portfolio
              </h2>
              <a
                href={profile.portfolioUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:underline'
              >
                Open in new tab <ExternalLink className='w-4 h-4' />
              </a>
            </div>

            {/* Browser Mockup */}
            <div className='rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl bg-gray-900'>
              {/* Browser Chrome */}
              <div className='flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700/50'>
                <div className='flex gap-1.5'>
                  <div className='w-3 h-3 rounded-full bg-red-500/80' />
                  <div className='w-3 h-3 rounded-full bg-yellow-500/80' />
                  <div className='w-3 h-3 rounded-full bg-green-500/80' />
                </div>
                <div className='flex-1 mx-4'>
                  <div className='flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 rounded-lg text-sm text-gray-400 max-w-md'>
                    <Globe className='w-3.5 h-3.5' />
                    <span className='truncate'>{profile.portfolioUrl}</span>
                  </div>
                </div>
              </div>

              {/* Iframe Container */}
              <div className='relative aspect-video bg-gray-900'>
                {!portfolioLoaded && (
                  <div className='absolute inset-0 flex items-center justify-center bg-gray-900'>
                    <div className='text-center'>
                      <Loader2 className='w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2' />
                      <p className='text-sm text-gray-500'>
                        Loading preview...
                      </p>
                    </div>
                  </div>
                )}
                <iframe
                  src={profile.portfolioUrl}
                  className='w-full h-full'
                  onLoad={() => setPortfolioLoaded(true)}
                  sandbox='allow-scripts allow-same-origin'
                  loading='lazy'
                />
              </div>
            </div>
          </div>
        )}

        {/* GitHub Assessment Section */}
        {profile.githubUsername && data.githubData && (
          <div className='mb-8'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='flex items-center gap-2 text-xl font-bold text-white'>
                <Github className='w-5 h-5 text-teal-600 dark:text-teal-400' />
                GitHub Assessment
              </h2>
              <a
                href={`https://github.com/${profile.githubUsername}`}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:underline'
              >
                @{profile.githubUsername} <ExternalLink className='w-3 h-3' />
              </a>
            </div>
            {data.githubData.connected ? (
              <p className='text-xs text-green-400 mb-3 flex items-center gap-1'>
                <CheckCircle className='w-3 h-3' />
                Includes private repos — full GitHub activity shown
              </p>
            ) : (
              <p className='text-xs text-gray-500 mb-3'>
                Public repos only — private work not shown
              </p>
            )}

            <div className='bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden'>
              {/* Profile Header */}
              <div className='p-5 border-b border-gray-700/50'>
                <div className='flex items-center gap-4'>
                  {data.githubData.avatarUrl && (
                    <img
                      src={data.githubData.avatarUrl}
                      alt='GitHub Avatar'
                      className='w-14 h-14 rounded-xl border-2 border-gray-700'
                    />
                  )}
                  <div className='flex-1'>
                    <p className='text-lg font-semibold text-white'>
                      @{profile.githubUsername}
                    </p>
                    {data.githubData.bio && (
                      <p className='text-sm text-gray-400'>
                        {data.githubData.bio}
                      </p>
                    )}
                  </div>
                  {/* AI Career Score */}
                </div>
              </div>

              {/* Stats Grid */}
              <div className='grid grid-cols-4 gap-px bg-gray-700/30'>
                <div className='bg-gray-800/80 p-4 text-center'>
                  <p className='text-2xl font-bold text-white'>
                    {data.githubData.totalRepos}
                  </p>
                  <p className='text-xs text-gray-500'>
                    {data.githubData.connected &&
                    data.githubData.privateRepos > 0
                      ? `Repos (${data.githubData.privateRepos} private)`
                      : 'Repositories'}
                  </p>
                </div>
                <div className='bg-gray-800/80 p-4 text-center'>
                  <p className='text-2xl font-bold text-white'>
                    {data.githubData.repos.reduce((sum, r) => sum + r.stars, 0)}
                  </p>
                  <p className='text-xs text-gray-500'>Total Stars</p>
                </div>
                <div className='bg-gray-800/80 p-4 text-center'>
                  <p className='text-2xl font-bold text-white'>
                    {data.githubData.followers}
                  </p>
                  <p className='text-xs text-gray-500'>Followers</p>
                </div>
                <div className='bg-gray-800/80 p-4 text-center'>
                  <p className='text-2xl font-bold text-white'>
                    {data.githubData.languages.length}
                  </p>
                  <p className='text-xs text-gray-500'>Languages</p>
                </div>
              </div>

              {/* Contribution Graph */}
              <div className='p-5 border-b border-gray-700/50'>
                <p className='text-sm font-medium text-gray-300 mb-3'>
                  Contribution Activity
                </p>
                <GitHubContributionGraph shareToken={token} />
              </div>

              {/* Language Breakdown */}
              {data.githubData.languages.length > 0 && (
                <div className='p-5 border-b border-gray-700/50'>
                  <p className='text-sm font-medium text-gray-300 mb-3'>
                    Top Languages
                  </p>
                  <div className='space-y-2'>
                    {data.githubData.languages.map((lang) => (
                      <div
                        key={lang.language}
                        className='flex items-center gap-3'
                      >
                        <div className='w-20 text-sm text-gray-400 truncate'>
                          {lang.language}
                        </div>
                        <div className='flex-1 h-2 bg-gray-700/50 rounded-full overflow-hidden'>
                          <div
                            className='h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full'
                            style={{ width: `${lang.percentage}%` }}
                          />
                        </div>
                        <div className='w-12 text-right text-xs text-gray-500'>
                          {lang.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Repos */}
              {data.githubData.repos.length > 0 && (
                <div className='p-5'>
                  <p className='text-sm font-medium text-gray-300 mb-3'>
                    {data.githubData.connected
                      ? 'Top Repositories'
                      : 'Public Repositories'}
                  </p>
                  <div className='grid gap-3'>
                    {data.githubData.repos.slice(0, 4).map((repo) => (
                      <a
                        key={repo.name}
                        href={repo.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='block p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl transition-colors group'
                      >
                        <div className='flex items-start justify-between gap-2'>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center gap-2'>
                              <p className='font-medium text-white group-hover:text-teal-600 dark:text-teal-400 transition-colors truncate'>
                                {repo.name}
                              </p>
                              {repo.isPrivate && (
                                <span className='text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded'>
                                  Private
                                </span>
                              )}
                            </div>
                            {repo.description && (
                              <p className='text-xs text-gray-500 mt-0.5 line-clamp-1'>
                                {repo.description}
                              </p>
                            )}
                          </div>
                          <ExternalLink className='w-3 h-3 text-gray-600 group-hover:text-teal-600 dark:text-teal-400 flex-shrink-0 mt-1' />
                        </div>
                        <div className='flex items-center gap-3 mt-2'>
                          {repo.language && (
                            <span className='flex items-center gap-1 text-xs text-gray-400'>
                              <span className='w-2 h-2 rounded-full bg-teal-600' />
                              {repo.language}
                            </span>
                          )}
                          {repo.stars > 0 && (
                            <span className='flex items-center gap-1 text-xs text-gray-400'>
                              <Star className='w-3 h-3' />
                              {repo.stars}
                            </span>
                          )}
                          {repo.forks > 0 && (
                            <span className='flex items-center gap-1 text-xs text-gray-400'>
                              <Github className='w-3 h-3' />
                              {repo.forks}
                            </span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>

                  {/* View all on GitHub */}
                  <a
                    href={`https://github.com/${profile.githubUsername}?tab=repositories`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center justify-center gap-2 w-full mt-4 px-4 py-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl text-gray-300 text-sm font-medium transition-all'
                  >
                    View all {data.githubData.totalRepos} repositories on GitHub
                    <ExternalLink className='w-3 h-3' />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className='bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-8'>
            <h2 className='flex items-center gap-2 text-lg font-semibold text-white mb-4'>
              <Code className='w-5 h-5 text-teal-600 dark:text-teal-400' />
              Tech Stack
            </h2>
            <div className='flex flex-wrap gap-2'>
              {profile.skills.map((s, i) => {
                const name =
                  typeof s === 'string'
                    ? s
                    : ((s as { name?: string }).name ?? 'Skill')
                return (
                  <span
                    key={i}
                    className='px-3 py-1.5 bg-gradient-to-r from-gray-700/80 to-gray-700/40 text-gray-200 rounded-lg text-sm border border-gray-600/50 hover:border-teal-500/50 transition-colors'
                  >
                    {name}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Resume — same flow as preview, one document with border */}
        {resume?.structuredData && (
          <div className='mb-8 rounded-2xl border-2 border-gray-600/80 bg-gray-800/30 overflow-hidden shadow-xl'>
            <div className='p-6 sm:p-8'>
              {/* Resume header badge */}
              <div className='flex items-center justify-between mb-6 pb-4 border-b border-gray-700/50'>
                <h2 className='flex items-center gap-2 text-xl font-bold text-white'>
                  <FileText className='w-5 h-5 text-teal-600 dark:text-teal-400' />
                  Resume
                </h2>
                {resume.verified && (
                  <span className='flex items-center gap-1 text-xs text-green-400'>
                    <CheckCircle className='w-3 h-3' />
                    Blockchain Verified
                  </span>
                )}
              </div>

              {/* Personal Info */}
              <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                  <User className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Personal
                  Information
                </h3>
                <div className='space-y-2'>
                  <p className='text-xl font-bold text-white'>
                    {resume.structuredData.personalInfo.firstName}{' '}
                    {resume.structuredData.personalInfo.lastName}
                  </p>
                  {resume.structuredData.personalInfo.headline && (
                    <p className='text-teal-600 dark:text-teal-400'>
                      {resume.structuredData.personalInfo.headline}
                    </p>
                  )}
                  <div className='text-sm text-gray-400'>
                    {resume.structuredData.personalInfo.email && (
                      <p>{resume.structuredData.personalInfo.email}</p>
                    )}
                    {resume.structuredData.personalInfo.phone && (
                      <p>{resume.structuredData.personalInfo.phone}</p>
                    )}
                    {resume.structuredData.personalInfo.location && (
                      <p>{resume.structuredData.personalInfo.location}</p>
                    )}
                  </div>
                  {resume.structuredData.personalInfo.summary && (
                    <p className='mt-3 text-gray-300'>
                      {resume.structuredData.personalInfo.summary}
                    </p>
                  )}
                  <div className='flex flex-wrap gap-3 mt-3'>
                    {resume.structuredData.personalInfo.githubUrl && (
                      <a
                        href={resume.structuredData.personalInfo.githubUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                      >
                        <Github className='w-4 h-4' /> GitHub
                      </a>
                    )}
                    {resume.structuredData.personalInfo.linkedinUrl && (
                      <a
                        href={resume.structuredData.personalInfo.linkedinUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                      >
                        <ExternalLink className='w-4 h-4' /> LinkedIn
                      </a>
                    )}
                    {resume.structuredData.personalInfo.portfolioUrl && (
                      <a
                        href={resume.structuredData.personalInfo.portfolioUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                      >
                        <Folder className='w-4 h-4' /> Portfolio
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Technical Skills */}
              {resume.structuredData.skills.length > 0 && (
                <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                  <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                    <Code className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Technical
                    Skills
                  </h3>
                  <div className='flex flex-wrap gap-2'>
                    {resume.structuredData.skills.map((skill) => (
                      <span
                        key={skill.id}
                        className='px-3 py-1 rounded-lg text-sm bg-gray-700/50 text-gray-300'
                      >
                        {skill.name}
                        <span className='ml-1 text-xs opacity-60'>
                          ({skill.proficiency})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Work Experience */}
              {resume.structuredData.experience.length > 0 && (
                <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                  <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                    <Briefcase className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Work
                    Experience
                  </h3>
                  <div className='space-y-4'>
                    {resume.structuredData.experience.map((exp) => (
                      <div
                        key={exp.id}
                        className='border-l-2 border-teal-500/30 pl-4'
                      >
                        <p className='font-semibold text-white'>{exp.title}</p>
                        <p className='text-gray-400'>
                          {exp.company} {exp.location && `• ${exp.location}`}
                        </p>
                        <p className='text-sm text-gray-500'>
                          {exp.startDate} -{' '}
                          {exp.isCurrent ? 'Present' : exp.endDate}
                        </p>
                        {exp.description && (
                          <p className='mt-2 text-sm text-gray-300'>
                            {exp.description}
                          </p>
                        )}
                        {exp.achievements.filter(Boolean).length > 0 && (
                          <ul className='mt-2 text-sm text-gray-300 list-disc list-inside'>
                            {exp.achievements.filter(Boolean).map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        )}
                        {exp.technologies.length > 0 && (
                          <p className='mt-2 text-xs text-gray-500'>
                            Tech: {exp.technologies.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects (from resume) */}
              {resume.structuredData.projects.length > 0 && (
                <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                  <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                    <Folder className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Projects
                  </h3>
                  <div className='space-y-4'>
                    {resume.structuredData.projects.map((project) => (
                      <div
                        key={project.id}
                        className='border-l-2 border-teal-500/30 pl-4'
                      >
                        <p className='font-semibold text-white'>
                          {project.name}
                          {project.role && (
                            <span className='font-normal text-sm ml-2'>
                              ({project.role})
                            </span>
                          )}
                        </p>
                        {project.description && (
                          <p className='mt-1 text-sm text-gray-300'>
                            {project.description}
                          </p>
                        )}
                        <div className='flex gap-3 mt-2'>
                          {project.liveUrl && (
                            <a
                              href={project.liveUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                            >
                              <Globe className='w-3 h-3' /> Live
                            </a>
                          )}
                          {project.repoUrl && (
                            <a
                              href={project.repoUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                            >
                              <Github className='w-3 h-3' /> Repo
                            </a>
                          )}
                        </div>
                        {project.technologies.length > 0 && (
                          <p className='mt-2 text-xs text-gray-500'>
                            Tech: {project.technologies.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {resume.structuredData.education.length > 0 && (
                <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                  <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                    <GraduationCap className='w-5 h-5 text-teal-600 dark:text-teal-400' />{' '}
                    Education
                  </h3>
                  <div className='space-y-3'>
                    {resume.structuredData.education.map((edu) => (
                      <div key={edu.id}>
                        <p className='font-semibold text-white'>
                          {edu.degree} {edu.field && `in ${edu.field}`}
                        </p>
                        <p className='text-gray-400'>{edu.institution}</p>
                        <p className='text-sm text-gray-500'>
                          {edu.startDate} - {edu.endDate}{' '}
                          {edu.gpa && `• GPA: ${edu.gpa}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {resume.structuredData.certifications.length > 0 && (
                <div className='mb-6 p-4 rounded-xl bg-gray-800/50'>
                  <h3 className='text-lg font-semibold mb-3 flex items-center gap-2 text-white'>
                    <CheckCircle className='w-5 h-5 text-teal-600 dark:text-teal-400' />{' '}
                    Certifications
                  </h3>
                  <div className='space-y-2'>
                    {resume.structuredData.certifications.map((cert) => (
                      <div
                        key={cert.id}
                        className='flex items-center justify-between'
                      >
                        <div>
                          <p className='font-medium text-white'>{cert.name}</p>
                          <p className='text-sm text-gray-400'>
                            {cert.issuer} {cert.date && `• ${cert.date}`}
                          </p>
                        </div>
                        {cert.url && (
                          <a
                            href={cert.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-sm text-teal-600 dark:text-teal-400 hover:underline'
                          >
                            Verify
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact */}
        {profile.contact &&
          (profile.contact.email || profile.contact.phone) && (
            <div className='bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-8'>
              <h2 className='text-lg font-semibold text-white mb-4'>
                Get in Touch
              </h2>
              <div className='flex flex-wrap gap-3'>
                {profile.contact.email && (
                  <a
                    href={`mailto:${profile.contact.email}`}
                    className='flex items-center gap-2 px-5 py-3 bg-teal-600/20 hover:bg-teal-600/30 rounded-xl text-teal-600 dark:text-teal-400 transition-all hover:scale-105 border border-teal-500/30'
                  >
                    <Mail className='w-5 h-5' />
                    {profile.contact.email}
                  </a>
                )}
                {profile.contact.phone && (
                  <a
                    href={`tel:${profile.contact.phone}`}
                    className='flex items-center gap-2 px-5 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105'
                  >
                    <Phone className='w-5 h-5' />
                    {profile.contact.phone}
                  </a>
                )}
              </div>
            </div>
          )}

        {/* CTA */}
        {settings.allowConnect && (
          <div className='text-center py-8'>
            <a
              href='/'
              className='inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-teal-600 to-teal-400 text-gray-900 font-bold text-lg rounded-2xl hover:shadow-xl hover:shadow-teal-600/30 transition-all hover:scale-105'
            >
              <Sparkles className='w-5 h-5' />
              Hire with Storm
            </a>
          </div>
        )}

        <footer className='mt-12 text-center'>
          <p className='text-gray-500 text-sm'>
            Powered by{' '}
            <a href='/' className='text-teal-600 dark:text-teal-400 hover:underline'>
              Storm
            </a>{' '}
            • Career Card
          </p>
        </footer>
      </main>
    </div>
  )
}

// Separate component for project cards
function ProjectCard({
  project,
  featured = false,
  getYouTubeId,
  getLoomId,
}: {
  project: Project
  featured?: boolean
  getYouTubeId: (url: string) => string | null
  getLoomId: (url: string) => string | null
}) {
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const [showPreview, setShowPreview] = useState(featured)

  const youtubeId = project.demoVideoUrl
    ? getYouTubeId(project.demoVideoUrl)
    : null
  const loomId = project.demoVideoUrl ? getLoomId(project.demoVideoUrl) : null
  const hasVideo = youtubeId || loomId

  return (
    <div
      className={`bg-gray-800/50 backdrop-blur-xl rounded-2xl border overflow-hidden transition-all ${
        featured
          ? 'border-yellow-500/30 shadow-lg shadow-yellow-500/10'
          : 'border-gray-700/50 hover:border-gray-600'
      }`}
    >
      {/* Live Preview or Video */}
      {showPreview && (project.liveUrl || hasVideo) && (
        <div className='relative aspect-video bg-gray-900 border-b border-gray-700/50'>
          {!previewLoaded && (
            <div className='absolute inset-0 flex items-center justify-center'>
              <Loader2 className='w-6 h-6 animate-spin text-indigo-400' />
            </div>
          )}
          {hasVideo ? (
            youtubeId ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                className='w-full h-full'
                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                allowFullScreen
                onLoad={() => setPreviewLoaded(true)}
              />
            ) : loomId ? (
              <iframe
                src={`https://www.loom.com/embed/${loomId}`}
                className='w-full h-full'
                allowFullScreen
                onLoad={() => setPreviewLoaded(true)}
              />
            ) : null
          ) : project.liveUrl ? (
            <iframe
              src={project.liveUrl}
              className='w-full h-full'
              sandbox='allow-scripts allow-same-origin'
              loading='lazy'
              onLoad={() => setPreviewLoaded(true)}
            />
          ) : null}
        </div>
      )}

      {/* Project Info */}
      <div className='p-5'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2'>
              <h3 className='font-semibold text-white text-lg'>
                {project.title}
              </h3>
              {featured && (
                <Star className='w-4 h-4 text-yellow-500 fill-yellow-500' />
              )}
            </div>
            {project.description && (
              <p className='text-gray-400 text-sm mt-1 line-clamp-2'>
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* Tech Stack */}
        {project.techStack.length > 0 && (
          <div className='flex flex-wrap gap-1.5 mt-3'>
            {project.techStack.slice(0, 6).map((tech, i) => (
              <span
                key={i}
                className='text-xs px-2 py-1 bg-gray-700/50 text-gray-400 rounded-md'
              >
                {tech}
              </span>
            ))}
            {project.techStack.length > 6 && (
              <span className='text-xs px-2 py-1 text-gray-500'>
                +{project.techStack.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className='flex items-center gap-2 mt-4 pt-4 border-t border-gray-700/50'>
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1.5 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-600 dark:text-teal-400 text-sm rounded-lg transition-colors'
            >
              <ExternalLink className='w-3.5 h-3.5' />
              Live Site
            </a>
          )}
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors'
            >
              <Github className='w-3.5 h-3.5' />
              Code
            </a>
          )}
          {project.demoVideoUrl && (
            <a
              href={project.demoVideoUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors'
            >
              <Play className='w-3.5 h-3.5' />
              Demo
            </a>
          )}
          {!showPreview && (project.liveUrl || hasVideo) && (
            <button
              onClick={() => setShowPreview(true)}
              className='ml-auto text-xs text-gray-500 hover:text-gray-400'
            >
              Show preview
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
