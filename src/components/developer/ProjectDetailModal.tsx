'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import {
  Globe,
  Github,
  Play,
  Star,
  Calendar,
  Users,
  ExternalLink,
  GitFork,
  Eye,
  Code,
  Loader2,
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface Project {
  id: string
  title: string
  description: string | null
  longDescription: string | null
  techStack: string[]
  liveUrl: string | null
  repoUrl: string | null
  demoVideoUrl: string | null
  thumbnailUrl: string | null
  screenshots: { url: string; caption: string }[]
  role: string | null
  teamSize: number | null
  startDate: string | null
  endDate: string | null
  isOngoing: boolean
  isFeatured: boolean
}

interface GitHubStats {
  stars: number
  forks: number
  watchers: number
  language: string | null
  topics: string[]
  description: string | null
}

interface ProjectDetailModalProps {
  project: Project
  onClose: () => void
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Extract GitHub owner/repo from a GitHub URL
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('github.com')) return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1].replace('.git', '') }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Extract YouTube video ID
 */
function getYouTubeId(url: string): string | null {
  const regex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

/**
 * Check if URL is Loom
 */
function getLoomId(url: string): string | null {
  const regex = /loom\.com\/share\/([a-zA-Z0-9]+)/
  const match = url.match(regex)
  return match ? match[1] : null
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ============================================================
// PROJECT DETAIL MODAL
// ============================================================

export default function ProjectDetailModal({
  project,
  onClose,
}: ProjectDetailModalProps) {
  const { theme } = useTheme()
  const [githubStats, setGithubStats] = useState<GitHubStats | null>(null)
  const [loadingGithub, setLoadingGithub] = useState(false)
  const [showLivePreview, setShowLivePreview] = useState(false)

  // Fetch GitHub stats if repo URL is GitHub
  useEffect(() => {
    if (project.repoUrl) {
      const parsed = parseGitHubUrl(project.repoUrl)
      if (parsed) {
        fetchGitHubStats(parsed.owner, parsed.repo)
      }
    }
  }, [project.repoUrl])

  const fetchGitHubStats = async (owner: string, repo: string) => {
    setLoadingGithub(true)
    try {
      // Use GitHub public API (no auth needed for public repos)
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      )
      if (response.ok) {
        const data = await response.json()
        setGithubStats({
          stars: data.stargazers_count || 0,
          forks: data.forks_count || 0,
          watchers: data.watchers_count || 0,
          language: data.language,
          topics: data.topics || [],
          description: data.description,
        })
      }
    } catch (err) {
      console.error('Error fetching GitHub stats:', err)
    } finally {
      setLoadingGithub(false)
    }
  }

  // Video embed URL
  const youtubeId = project.demoVideoUrl
    ? getYouTubeId(project.demoVideoUrl)
    : null
  const loomId = project.demoVideoUrl ? getLoomId(project.demoVideoUrl) : null

  // Role label
  const roleLabel =
    project.role === 'solo'
      ? 'Solo Developer'
      : project.role === 'lead'
        ? 'Team Lead'
        : project.role === 'contributor'
          ? 'Contributor'
          : project.role === 'team'
            ? 'Team Member'
            : project.role

  return (
    <Modal onClose={onClose} maxWidth="max-w-4xl">
      <ModalHeader title={project.title} onClose={onClose} />

        <div className='p-6 space-y-6'>
          {/* Thumbnail / Live Preview Toggle */}
          {(project.thumbnailUrl || project.liveUrl) && (
            <div className='space-y-3'>
              {/* Toggle buttons */}
              {project.liveUrl && (
                <div className='flex gap-2'>
                  <button
                    onClick={() => setShowLivePreview(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      !showLivePreview
                        ? 'bg-indigo-500 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Screenshot
                  </button>
                  <button
                    onClick={() => setShowLivePreview(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      showLivePreview
                        ? 'bg-indigo-500 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Globe className='w-4 h-4 inline mr-1' />
                    Live Preview
                  </button>
                </div>
              )}

              {/* Content */}
              <div
                className={`rounded-xl overflow-hidden border ${
                  theme === 'dark'
                    ? 'border-gray-700 bg-gray-800'
                    : 'border-gray-200 bg-gray-100'
                }`}
              >
                {showLivePreview && project.liveUrl ? (
                  <div className='aspect-video'>
                    <iframe
                      src={project.liveUrl}
                      title={`Live preview of ${project.title}`}
                      className='w-full h-full'
                      sandbox='allow-scripts allow-same-origin'
                    />
                  </div>
                ) : project.thumbnailUrl ? (
                  <img
                    src={project.thumbnailUrl}
                    alt={project.title}
                    className='w-full aspect-video object-cover'
                  />
                ) : (
                  <div className='aspect-video flex items-center justify-center text-gray-500'>
                    No preview available
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Video Demo */}
          {(youtubeId || loomId) && (
            <div className='space-y-2'>
              <h3
                className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                <Play className='w-4 h-4 inline mr-1' />
                Demo Video
              </h3>
              <div
                className={`rounded-xl overflow-hidden border ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                }`}
              >
                <div className='aspect-video'>
                  {youtubeId && (
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      title='Demo video'
                      className='w-full h-full'
                      allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                      allowFullScreen
                    />
                  )}
                  {loomId && (
                    <iframe
                      src={`https://www.loom.com/embed/${loomId}`}
                      title='Demo video'
                      className='w-full h-full'
                      allowFullScreen
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {(project.longDescription || project.description) && (
            <div className='space-y-2'>
              <h3
                className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                About This Project
              </h3>
              <p
                className={`text-base leading-relaxed ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                {project.longDescription || project.description}
              </p>
            </div>
          )}

          {/* Tech Stack */}
          {(project.techStack?.length ?? 0) > 0 && (
            <div className='space-y-2'>
              <h3
                className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                <Code className='w-4 h-4 inline mr-1' />
                Tech Stack
              </h3>
              <div className='flex flex-wrap gap-2'>
                {(project.techStack ?? []).map((tech) => (
                  <span
                    key={tech}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      theme === 'dark'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* GitHub Stats */}
          {project.repoUrl && parseGitHubUrl(project.repoUrl) && (
            <div className='space-y-2'>
              <h3
                className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                <Github className='w-4 h-4 inline mr-1' />
                GitHub Stats
              </h3>
              {loadingGithub ? (
                <div className='flex items-center gap-2 text-sm text-gray-500'>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  Loading...
                </div>
              ) : githubStats ? (
                <div className='flex flex-wrap gap-4'>
                  <div
                    className={`flex items-center gap-1.5 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    <Star className='w-4 h-4 text-yellow-500' />
                    <span className='font-semibold'>{githubStats.stars}</span>
                    <span className='text-sm text-gray-500'>stars</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    <GitFork className='w-4 h-4 text-blue-500' />
                    <span className='font-semibold'>{githubStats.forks}</span>
                    <span className='text-sm text-gray-500'>forks</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    <Eye className='w-4 h-4 text-green-500' />
                    <span className='font-semibold'>
                      {githubStats.watchers}
                    </span>
                    <span className='text-sm text-gray-500'>watchers</span>
                  </div>
                  {githubStats.language && (
                    <div
                      className={`flex items-center gap-1.5 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      <span className='w-3 h-3 rounded-full bg-indigo-500' />
                      <span className='text-sm'>{githubStats.language}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className='text-sm text-gray-500'>
                  Could not load stats (may be a private repo)
                </p>
              )}
            </div>
          )}

          {/* Project Details (role, team, dates) */}
          <div className='flex flex-wrap gap-6 text-sm'>
            {roleLabel && (
              <div className='flex items-center gap-2'>
                <Users
                  className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                />
                <span
                  className={
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }
                >
                  {roleLabel}
                  {project.teamSize &&
                    project.teamSize > 1 &&
                    ` (${project.teamSize} people)`}
                </span>
              </div>
            )}
            {(project.startDate || project.isOngoing) && (
              <div className='flex items-center gap-2'>
                <Calendar
                  className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                />
                <span
                  className={
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }
                >
                  {formatDate(project.startDate)}
                  {project.isOngoing
                    ? ' — Present'
                    : project.endDate
                      ? ` — ${formatDate(project.endDate)}`
                      : ''}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className='flex flex-wrap gap-3 pt-4 border-t border-gray-700'>
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 transition-all'
              >
                <Globe className='w-4 h-4' />
                View Live Site
                <ExternalLink className='w-3 h-3' />
              </a>
            )}
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target='_blank'
                rel='noopener noreferrer'
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                <Github className='w-4 h-4' />
                View Code
                <ExternalLink className='w-3 h-3' />
              </a>
            )}
            {project.demoVideoUrl && !youtubeId && !loomId && (
              <a
                href={project.demoVideoUrl}
                target='_blank'
                rel='noopener noreferrer'
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Play className='w-4 h-4' />
                Watch Demo
                <ExternalLink className='w-3 h-3' />
              </a>
            )}
          </div>
        </div>
    </Modal>
  )
}
