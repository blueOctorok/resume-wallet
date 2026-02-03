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
} from 'lucide-react'

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

interface Resume {
  id: string
  title: string
  filename: string
  verified: boolean
  blockchainVerified: boolean
  type: string
  createdAt: string
  ipfsHash: string | null
}

interface ProfileData {
  success: boolean
  profile: PublicProfile
  projects: Project[]
  resume: Resume | null
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
          <Loader2 className='w-12 h-12 animate-spin text-brand-mint mx-auto mb-4' />
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
            className='inline-flex items-center gap-2 px-6 py-3 bg-brand-mint text-gray-900 font-semibold rounded-xl hover:bg-brand-mint/90 transition-colors'
          >
            Go to StormChain
          </a>
        </div>
      </div>
    )
  }

  const { profile, projects, resume, settings } = data
  const displayName =
    profile.displayName ||
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    'Developer'

  const featuredProjects = projects.filter((p) => p.isFeatured)
  const otherProjects = projects.filter((p) => !p.isFeatured)

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'>
      {/* Decorative background elements */}
      <div className='fixed inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute top-0 right-0 w-96 h-96 bg-brand-mint/5 rounded-full blur-3xl' />
        <div className='absolute bottom-0 left-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl' />
      </div>

      <header className='border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-20'>
        <div className='max-w-4xl mx-auto px-4 py-4 flex items-center justify-between'>
          <a href='/' className='flex items-center gap-2'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-brand-mint to-teal-500 flex items-center justify-center shadow-lg shadow-brand-mint/20'>
              <span className='text-gray-900 font-bold text-sm'>S</span>
            </div>
            <span className='text-white font-semibold'>StormChain</span>
          </a>
          <div className='flex items-center gap-2'>
            <Sparkles className='w-4 h-4 text-brand-mint' />
            <span className='text-xs text-gray-400'>Career Card</span>
          </div>
        </div>
      </header>

      <main className='max-w-4xl mx-auto px-4 py-8 relative z-10'>
        {/* Hero Profile Card */}
        <div className='bg-gradient-to-br from-gray-800/80 to-gray-800/40 backdrop-blur-xl rounded-3xl border border-gray-700/50 overflow-hidden mb-8 shadow-2xl'>
          {/* Gradient accent bar */}
          <div className='h-1 bg-gradient-to-r from-brand-mint via-teal-400 to-emerald-500' />

          <div className='p-8'>
            <div className='flex flex-col sm:flex-row items-start gap-6'>
              {/* Avatar with glow */}
              <div className='relative'>
                <div className='absolute inset-0 bg-brand-mint/30 rounded-2xl blur-xl' />
                <div className='relative w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-mint via-teal-400 to-emerald-500 flex items-center justify-center shadow-xl'>
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
                      <p className='text-lg text-brand-mint font-medium mt-1'>
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

        {/* Portfolio Preview - The Hero Section */}
        {profile.portfolioUrl && (
          <div className='mb-8'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='flex items-center gap-2 text-xl font-bold text-white'>
                <Globe className='w-5 h-5 text-brand-mint' />
                Portfolio
              </h2>
              <a
                href={profile.portfolioUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2 text-sm text-brand-mint hover:underline'
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
                      <Loader2 className='w-8 h-8 animate-spin text-brand-mint mx-auto mb-2' />
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

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className='bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-8'>
            <h2 className='flex items-center gap-2 text-lg font-semibold text-white mb-4'>
              <Code className='w-5 h-5 text-brand-mint' />
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
                    className='px-3 py-1.5 bg-gradient-to-r from-gray-700/80 to-gray-700/40 text-gray-200 rounded-lg text-sm border border-gray-600/50 hover:border-brand-mint/50 transition-colors'
                  >
                    {name}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Featured Projects with Live Preview */}
        {featuredProjects.length > 0 && (
          <div className='mb-8'>
            <h2 className='flex items-center gap-2 text-xl font-bold text-white mb-4'>
              <Star className='w-5 h-5 text-yellow-500' />
              Featured Projects
            </h2>
            <div className='space-y-6'>
              {featuredProjects.map((proj) => (
                <ProjectCard
                  key={proj.id}
                  project={proj}
                  featured
                  getYouTubeId={getYouTubeId}
                  getLoomId={getLoomId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other Projects */}
        {otherProjects.length > 0 && (
          <div className='mb-8'>
            <h2 className='flex items-center gap-2 text-xl font-bold text-white mb-4'>
              <Briefcase className='w-5 h-5 text-brand-mint' />
              {featuredProjects.length > 0 ? 'More Projects' : 'Projects'}
            </h2>
            <div className='grid sm:grid-cols-2 gap-4'>
              {otherProjects.map((proj) => (
                <ProjectCard
                  key={proj.id}
                  project={proj}
                  getYouTubeId={getYouTubeId}
                  getLoomId={getLoomId}
                />
              ))}
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
                    className='flex items-center gap-2 px-5 py-3 bg-brand-mint/20 hover:bg-brand-mint/30 rounded-xl text-brand-mint transition-all hover:scale-105 border border-brand-mint/30'
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
              className='inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-brand-mint to-teal-400 text-gray-900 font-bold text-lg rounded-2xl hover:shadow-xl hover:shadow-brand-mint/30 transition-all hover:scale-105'
            >
              <Sparkles className='w-5 h-5' />
              Hire with StormChain
            </a>
          </div>
        )}

        <footer className='mt-12 text-center'>
          <p className='text-gray-500 text-sm'>
            Powered by{' '}
            <a href='/' className='text-brand-mint hover:underline'>
              StormChain
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
              <Loader2 className='w-6 h-6 animate-spin text-brand-mint' />
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
              className='flex items-center gap-1.5 px-3 py-1.5 bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-mint text-sm rounded-lg transition-colors'
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
