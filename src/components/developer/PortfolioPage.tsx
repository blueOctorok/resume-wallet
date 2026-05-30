'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import ProjectDetailModal from './ProjectDetailModal'
import BackToHubButton from '@/components/ui/BackToHubButton'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import {
  Plus,
  Folder,
  ExternalLink,
  Github,
  Trash2,
  Edit,
  Star,
  StarOff,
  Loader2,
  X,
  Globe,
  Play,
  Image as ImageIcon,
  Check,
  Eye,
} from 'lucide-react'

// Only allow http/https in iframe to avoid javascript: or data: URLs
const isSafePreviewUrl = (url: string) => /^https?:\/\//i.test(url.trim())

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
  isPublic: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

interface PortfolioPageProps {
  userAddress: string | null
  onBack: () => void
}

// Common tech stack options for autocomplete
const TECH_STACK_OPTIONS = [
  // Frontend
  'React',
  'Next.js',
  'Vue.js',
  'Angular',
  'Svelte',
  'TypeScript',
  'JavaScript',
  'HTML',
  'CSS',
  'Tailwind CSS',
  'SASS',
  // Backend
  'Node.js',
  'Express',
  'Python',
  'Django',
  'FastAPI',
  'Flask',
  'Go',
  'Rust',
  'Java',
  'Spring Boot',
  'C#',
  '.NET',
  'Ruby',
  'Rails',
  'PHP',
  'Laravel',
  // Database
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'SQLite',
  'Supabase',
  'Firebase',
  'Prisma',
  // Cloud & DevOps
  'AWS',
  'GCP',
  'Azure',
  'Docker',
  'Kubernetes',
  'Vercel',
  'Netlify',
  'Heroku',
  'CI/CD',
  'GitHub Actions',
  // Mobile
  'React Native',
  'Flutter',
  'Swift',
  'Kotlin',
  'iOS',
  'Android',
  // Other
  'GraphQL',
  'REST API',
  'WebSockets',
  'Blockchain',
  'Solidity',
  'Web3',
  'AI/ML',
  'TensorFlow',
  'PyTorch',
]

// ============================================================
// PORTFOLIO PAGE COMPONENT
// ============================================================

export default function PortfolioPage({
  userAddress,
  onBack,
}: PortfolioPageProps) {
  const { theme } = useTheme()
  const [projects, setProjects] = useState<Project[]>([])
  const [portfolioUrl, setPortfolioUrl] = useState<string>('')
  const [portfolioUrlSaving, setPortfolioUrlSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detail modal state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    longDescription: '',
    techStack: [] as string[],
    liveUrl: '',
    repoUrl: '',
    demoVideoUrl: '',
    thumbnailUrl: '',
    role: 'solo',
    teamSize: '',
    startDate: '',
    endDate: '',
    isOngoing: false,
    isFeatured: false,
    isPublic: true,
  })
  const [techInput, setTechInput] = useState('')
  const [showTechSuggestions, setShowTechSuggestions] = useState(false)

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchProjects = useCallback(async () => {
    if (!userAddress) return

    try {
      setIsLoading(true)
      const response = await fetch('/api/developer/projects')

      if (!response.ok) throw new Error('Failed to fetch projects')

      const data = await response.json()
      setProjects(data.projects || [])
    } catch (err) {
      console.error('Error fetching projects:', err)
      setError('Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }, [userAddress])

  const fetchPortfolioUrl = useCallback(async () => {
    if (!userAddress) return
    try {
      const res = await fetch('/api/developer/profile')
      if (!res.ok) return
      const data = await res.json()
      setPortfolioUrl(data.profile?.portfolioUrl ?? '')
    } catch {
      // ignore
    }
  }, [userAddress])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    fetchPortfolioUrl()
  }, [fetchPortfolioUrl])

  const savePortfolioUrl = async () => {
    if (!userAddress) return
    setPortfolioUrlSaving(true)
    try {
      const res = await fetch('/api/developer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ portfolioUrl: portfolioUrl.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed to save')
      await fetchPortfolioUrl()
    } catch {
      setError('Failed to save portfolio URL')
    } finally {
      setPortfolioUrlSaving(false)
    }
  }

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      longDescription: '',
      techStack: [],
      liveUrl: '',
      repoUrl: '',
      demoVideoUrl: '',
      thumbnailUrl: '',
      role: 'solo',
      teamSize: '',
      startDate: '',
      endDate: '',
      isOngoing: false,
      isFeatured: false,
      isPublic: true,
    })
    setTechInput('')
    setEditingProject(null)
  }

  const openCreateForm = () => {
    resetForm()
    setShowForm(true)
  }

  const openEditForm = (project: Project) => {
    setEditingProject(project)
    setFormData({
      title: project.title,
      description: project.description || '',
      longDescription: project.longDescription || '',
      techStack: project.techStack || [],
      liveUrl: project.liveUrl || '',
      repoUrl: project.repoUrl || '',
      demoVideoUrl: project.demoVideoUrl || '',
      thumbnailUrl: project.thumbnailUrl || '',
      role: project.role || 'solo',
      teamSize: project.teamSize?.toString() || '',
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      isOngoing: project.isOngoing,
      isFeatured: project.isFeatured,
      isPublic: project.isPublic,
    })
    setShowForm(true)
  }

  const addTech = (tech: string) => {
    const trimmed = tech.trim()
    if (trimmed && !formData.techStack.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        techStack: [...prev.techStack, trimmed],
      }))
    }
    setTechInput('')
    setShowTechSuggestions(false)
  }

  const removeTech = (tech: string) => {
    setFormData((prev) => ({
      ...prev,
      techStack: prev.techStack.filter((t) => t !== tech),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userAddress || !formData.title.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      const payload = {
        ...(editingProject && { id: editingProject.id }),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        longDescription: formData.longDescription.trim() || null,
        techStack: formData.techStack,
        liveUrl: formData.liveUrl.trim() || null,
        repoUrl: formData.repoUrl.trim() || null,
        demoVideoUrl: formData.demoVideoUrl.trim() || null,
        thumbnailUrl: formData.thumbnailUrl.trim() || null,
        role: formData.role,
        teamSize: formData.teamSize ? parseInt(formData.teamSize) : null,
        startDate: formData.startDate || null,
        endDate: formData.isOngoing ? null : formData.endDate || null,
        isOngoing: formData.isOngoing,
        isFeatured: formData.isFeatured,
        isPublic: formData.isPublic,
      }

      const response = await fetch('/api/developer/projects', {
        method: editingProject ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('Failed to save project')

      await fetchProjects()
      setShowForm(false)
      resetForm()
    } catch (err) {
      console.error('Error saving project:', err)
      setError('Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (projectId: string) => {
    if (!userAddress || !confirm('Delete this project?')) return

    try {
      const response = await fetch(`/api/developer/projects?id=${projectId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete project')

      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } catch (err) {
      console.error('Error deleting project:', err)
      setError('Failed to delete project')
    }
  }

  const toggleFeatured = async (project: Project) => {
    if (!userAddress) return

    try {
      const response = await fetch('/api/developer/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: project.id,
          isFeatured: !project.isFeatured,
        }),
      })

      if (!response.ok) throw new Error('Failed to update project')

      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, isFeatured: !p.isFeatured } : p
        )
      )
    } catch (err) {
      console.error('Error toggling featured:', err)
    }
  }

  // Filter tech suggestions
  const filteredTechSuggestions = TECH_STACK_OPTIONS.filter(
    (tech) =>
      tech.toLowerCase().includes(techInput.toLowerCase()) &&
      !formData.techStack.includes(tech)
  ).slice(0, 8)

  // ============================================================
  // RENDER
  // ============================================================

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <Loader2
          className={`w-12 h-12 animate-spin ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'}`}
        />
      </div>
    )
  }

  return (
    <div className='max-w-4xl mx-auto px-4 pb-8'>
      {/* Header */}
      <div className='mb-6'>
        <BackToHubButton onClick={onBack} className="mb-4" />
        <div className='flex items-center justify-between'>
          <div>
            <h1
              className={`text-2xl font-bold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
            >
              Portfolio
            </h1>
            <p
              className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Showcase your projects to employers
            </p>
          </div>
          <button
            onClick={openCreateForm}
            className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 transition-all'
          >
            <Plus className='w-4 h-4' />
            Add Project
          </button>
        </div>
      </div>

      {error && (
        <div className='mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm'>
          {error}
        </div>
      )}

      {/* Portfolio URL: single link used for live preview on this page and on the career card */}
      <div className={`mb-6 rounded-2xl border p-4 space-y-4 ${isDarkTheme(theme) ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
        <label className={`block text-sm font-medium ${isDarkTheme(theme) ? 'text-zinc-300' : 'text-zinc-700'}`}>
          Your portfolio URL
        </label>
        <div className='flex gap-2'>
          <input
            type='url'
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
            placeholder='https://your-portfolio.com'
            className={`flex-1 rounded-lg border px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              isDarkTheme(theme)
                ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                : 'border-zinc-300 bg-white text-zinc-900'
            }`}
          />
          <button
            type='button'
            onClick={savePortfolioUrl}
            disabled={portfolioUrlSaving || !portfolioUrl.trim()}
            className='rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none'
          >
            {portfolioUrlSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {portfolioUrl.trim() && isSafePreviewUrl(portfolioUrl) && (
          <div className='rounded-lg border overflow-hidden bg-white'>
            <p className={`text-xs px-2 py-1 border-b ${isDarkTheme(theme) ? 'text-zinc-400 border-zinc-700' : 'text-zinc-500 border-zinc-200'}`}>
              Live preview
            </p>
            <iframe
              src={portfolioUrl.trim()}
              title='Portfolio preview'
              className='w-full h-[420px] border-0'
              sandbox='allow-scripts allow-same-origin allow-forms'
            />
          </div>
        )}
      </div>

      {/* Project Form Modal */}
      {showForm && (
        <Modal onClose={() => { setShowForm(false); resetForm() }} maxWidth="max-w-2xl">
            <ModalHeader
              title={editingProject ? 'Edit Project' : 'Add Project'}
              onClose={() => { setShowForm(false); resetForm() }}
            />

            <form onSubmit={handleSubmit} className='p-4 space-y-4'>
              {/* Title */}
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Project Title *
                </label>
                <input
                  type='text'
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder='My Awesome Project'
                  required
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkTheme(theme)
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Short Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder='A brief 1-2 sentence summary'
                  rows={2}
                  className={`w-full px-3 py-2 rounded-lg border resize-none ${
                    isDarkTheme(theme)
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              {/* Tech Stack */}
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Tech Stack
                </label>
                <div className='relative'>
                  <input
                    type='text'
                    value={techInput}
                    onChange={(e) => {
                      setTechInput(e.target.value)
                      setShowTechSuggestions(true)
                    }}
                    onFocus={() => setShowTechSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (techInput.trim()) addTech(techInput)
                      }
                    }}
                    placeholder='Type to add (e.g., React, Node.js)'
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                  {showTechSuggestions &&
                    filteredTechSuggestions.length > 0 && (
                      <div
                        className={`absolute z-10 w-full mt-1 rounded-lg border shadow-lg max-h-48 overflow-y-auto ${
                          isDarkTheme(theme)
                            ? 'bg-gray-700 border-gray-600'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        {filteredTechSuggestions.map((tech) => (
                          <button
                            key={tech}
                            type='button'
                            onClick={() => addTech(tech)}
                            className={`w-full px-3 py-2 text-left text-sm ${
                              isDarkTheme(theme)
                                ? 'hover:bg-gray-600 text-white'
                                : 'hover:bg-gray-100 text-gray-900'
                            }`}
                          >
                            {tech}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                {formData.techStack.length > 0 && (
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {formData.techStack.map((tech) => (
                      <span
                        key={tech}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                          isDarkTheme(theme)
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {tech}
                        <button
                          type='button'
                          onClick={() => removeTech(tech)}
                          className='hover:text-red-500'
                        >
                          <X className='w-3 h-3' />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* URLs */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    <Globe className='w-4 h-4 inline mr-1' />
                    Live URL
                  </label>
                  <input
                    type='url'
                    value={formData.liveUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        liveUrl: e.target.value,
                      }))
                    }
                    placeholder='https://myproject.com'
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    <Github className='w-4 h-4 inline mr-1' />
                    Repo URL
                  </label>
                  <input
                    type='url'
                    value={formData.repoUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        repoUrl: e.target.value,
                      }))
                    }
                    placeholder='https://github.com/user/repo'
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                </div>
              </div>

              {/* Thumbnail URL */}
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  <ImageIcon className='w-4 h-4 inline mr-1' />
                  Thumbnail URL
                </label>
                <input
                  type='url'
                  value={formData.thumbnailUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      thumbnailUrl: e.target.value,
                    }))
                  }
                  placeholder='https://example.com/screenshot.png'
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkTheme(theme)
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              {/* Role & Team Size */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    Your Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, role: e.target.value }))
                    }
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value='solo'>Solo Developer</option>
                    <option value='lead'>Team Lead</option>
                    <option value='contributor'>Contributor</option>
                    <option value='team'>Team Member</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    Team Size
                  </label>
                  <input
                    type='number'
                    min='1'
                    value={formData.teamSize}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        teamSize: e.target.value,
                      }))
                    }
                    placeholder='1'
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    Start Date
                  </label>
                  <input
                    type='date'
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    End Date
                  </label>
                  <input
                    type='date'
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    disabled={formData.isOngoing}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700 border-gray-600 text-white disabled:opacity-50'
                        : 'bg-white border-gray-300 text-gray-900 disabled:opacity-50'
                    }`}
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className='flex flex-wrap gap-4'>
                <label
                  className={`inline-flex items-center gap-2 cursor-pointer ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  <input
                    type='checkbox'
                    checked={formData.isOngoing}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isOngoing: e.target.checked,
                        endDate: '',
                      }))
                    }
                    className='rounded'
                  />
                  Ongoing project
                </label>
                <label
                  className={`inline-flex items-center gap-2 cursor-pointer ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  <input
                    type='checkbox'
                    checked={formData.isFeatured}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isFeatured: e.target.checked,
                      }))
                    }
                    className='rounded'
                  />
                  <Star className='w-4 h-4 text-yellow-500' />
                  Featured on Career Card
                </label>
                <label
                  className={`inline-flex items-center gap-2 cursor-pointer ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  <input
                    type='checkbox'
                    checked={formData.isPublic}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isPublic: e.target.checked,
                      }))
                    }
                    className='rounded'
                  />
                  Public (visible to employers)
                </label>
              </div>

              {/* Submit */}
              <div className='flex justify-end gap-3 pt-4 border-t border-gray-700'>
                <button
                  type='button'
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isDarkTheme(theme)
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isSaving || !formData.title.trim()}
                  className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50'
                >
                  {isSaving ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className='w-4 h-4' />
                      {editingProject ? 'Update Project' : 'Add Project'}
                    </>
                  )}
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div
          className={`text-center py-16 rounded-xl border-2 border-dashed ${
            isDarkTheme(theme)
              ? 'border-gray-700 bg-gray-800/30'
              : 'border-gray-300 bg-gray-50/50'
          }`}
        >
          <Folder
            className={`w-16 h-16 mx-auto mb-4 ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`}
          />
          <h3
            className={`text-xl font-semibold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
          >
            No Projects Yet
          </h3>
          <p
            className={`mb-4 max-w-md mx-auto ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
          >
            Add your projects, side hustles, and case studies. Show employers
            what you can build.
          </p>
          <button
            onClick={openCreateForm}
            className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium'
          >
            <Plus className='w-4 h-4' />
            Add Your First Project
          </button>
        </div>
      ) : (
        <div className='grid gap-4 md:grid-cols-2'>
          {projects.map((project) => (
            <div
              key={project.id}
              className={`rounded-xl border overflow-hidden ${
                isDarkTheme(theme)
                  ? 'bg-gray-800/50 border-gray-700'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Thumbnail */}
              {project.thumbnailUrl && (
                <div className='aspect-video bg-gray-900 overflow-hidden'>
                  <img
                    src={project.thumbnailUrl}
                    alt={project.title}
                    className='w-full h-full object-cover'
                  />
                </div>
              )}

              <div className='p-4'>
                {/* Title & Featured Badge */}
                <div className='flex items-start justify-between mb-2'>
                  <h3
                    className={`font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
                  >
                    {project.title}
                  </h3>
                  {project.isFeatured && (
                    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-500'>
                      <Star className='w-3 h-3' />
                      Featured
                    </span>
                  )}
                </div>

                {/* Description */}
                {project.description && (
                  <p
                    className={`text-sm mb-3 line-clamp-2 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    {project.description}
                  </p>
                )}

                {/* Tech Stack */}
                {(project.techStack?.length ?? 0) > 0 && (
                  <div className='flex flex-wrap gap-1 mb-3'>
                    {(project.techStack ?? []).slice(0, 5).map((tech) => (
                      <span
                        key={tech}
                        className={`px-2 py-0.5 rounded text-xs ${
                          isDarkTheme(theme)
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {tech}
                      </span>
                    ))}
                    {(project.techStack?.length ?? 0) > 5 && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}`}
                      >
                        +{(project.techStack?.length ?? 0) - 5}
                      </span>
                    )}
                  </div>
                )}

                {/* Links & View Details */}
                <div className='flex items-center gap-2 mb-3'>
                  <button
                    onClick={() => setSelectedProject(project)}
                    className={`inline-flex items-center gap-1 text-sm font-medium ${
                      isDarkTheme(theme)
                        ? 'text-indigo-400 hover:text-indigo-300'
                        : 'text-indigo-600 hover:text-indigo-700'
                    }`}
                  >
                    <Eye className='w-4 h-4' />
                    View Details
                  </button>
                  {project.liveUrl && (
                    <a
                      href={project.liveUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      onClick={(e) => e.stopPropagation()}
                      className={`inline-flex items-center gap-1 text-sm ${
                        isDarkTheme(theme)
                          ? 'text-gray-400 hover:text-gray-300'
                          : 'text-gray-600 hover:text-gray-700'
                      }`}
                    >
                      <Globe className='w-4 h-4' />
                      Live
                    </a>
                  )}
                  {project.repoUrl && (
                    <a
                      href={project.repoUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      onClick={(e) => e.stopPropagation()}
                      className={`inline-flex items-center gap-1 text-sm ${
                        isDarkTheme(theme)
                          ? 'text-gray-400 hover:text-gray-300'
                          : 'text-gray-600 hover:text-gray-700'
                      }`}
                    >
                      <Github className='w-4 h-4' />
                      Code
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div
                  className={`flex items-center justify-between pt-3 border-t ${
                    isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'
                  }`}
                >
                  <div className='flex items-center gap-1'>
                    <button
                      onClick={() => toggleFeatured(project)}
                      title={
                        project.isFeatured
                          ? 'Remove from featured'
                          : 'Add to featured'
                      }
                      className={`p-1.5 rounded ${
                        isDarkTheme(theme)
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {project.isFeatured ? (
                        <Star className='w-4 h-4 text-yellow-500 fill-yellow-500' />
                      ) : (
                        <StarOff
                          className={`w-4 h-4 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}
                        />
                      )}
                    </button>
                    <button
                      onClick={() => openEditForm(project)}
                      className={`p-1.5 rounded ${
                        isDarkTheme(theme)
                          ? 'hover:bg-gray-700 text-gray-400'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <Edit className='w-4 h-4' />
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className={`p-1.5 rounded ${
                        isDarkTheme(theme)
                          ? 'hover:bg-gray-700 text-red-400'
                          : 'hover:bg-gray-100 text-red-600'
                      }`}
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                  <span
                    className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}
                  >
                    {project.role === 'solo'
                      ? 'Solo'
                      : project.role === 'lead'
                        ? 'Lead'
                        : project.role === 'contributor'
                          ? 'Contributor'
                          : 'Team'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  )
}
