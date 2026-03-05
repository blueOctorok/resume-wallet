'use client'

import { useState, useEffect } from 'react'
import {
  Briefcase,
  ExternalLink,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  MapPin,
  DollarSign,
} from 'lucide-react'
import LoadingScreen from './LoadingScreen'
import { useTheme } from '@/contexts/ThemeContext'
import BackToHubButton from './ui/BackToHubButton'

interface Application {
  id: string
  job_title: string
  employer_name: string
  job_location: string
  job_salary_min: number | null
  job_salary_max: number | null
  status: string
  created_at: string
  view_count: number
  last_viewed_at: string | null
  share_token: string
  job_url: string | null
}

interface MyApplicationsProps {
  onBack: () => void
  userAddress: string | null
}

export default function MyApplications({
  onBack,
  userAddress,
}: MyApplicationsProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userAddress) {
      fetchApplications()
    }
  }, [userAddress])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/applications/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userAddress }),
      })

      if (response.ok) {
        const data = await response.json()
        const apps = data.applications || []
        setApplications(apps)
        setError(null)
      } else {
        console.warn('API returned error, treating as empty applications:', response.status)
        setApplications([])
        setError(null)
      }
    } catch (err) {
      console.error('Error fetching applications:', err)
      setApplications([])
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className='w-5 h-5 text-blue-500' />
      case 'viewed':
        return <Eye className='w-5 h-5 text-purple-500' />
      case 'interviewing':
        return <Briefcase className='w-5 h-5 text-orange-500' />
      case 'hired':
        return <CheckCircle className='w-5 h-5 text-green-500' />
      case 'rejected':
        return <XCircle className='w-5 h-5 text-red-500' />
      default:
        return <Clock className='w-5 h-5 text-gray-500' />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      case 'viewed':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
      case 'interviewing':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
      case 'hired':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return null
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`
    if (min) return `$${min.toLocaleString()}+`
    return null
  }

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/application/${token}`
    navigator.clipboard.writeText(url)
    alert('Application link copied to clipboard!')
  }

  const cardClass = isDark
    ? 'bg-gray-800/50 border border-gray-700'
    : 'bg-white border border-gray-200'

  if (loading) {
    return <LoadingScreen message='Loading your applications...' />
  }

  return (
    <div className='w-full p-4 sm:p-6 lg:p-8'>
      {/* Header */}
      <div className='max-w-7xl mx-auto mb-8'>
        <BackToHubButton onClick={onBack} className="mb-4" />

        <div className={`rounded-2xl p-6 sm:p-8 ${cardClass}`}>
          <div className='flex items-center gap-4 mb-2'>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
              isDark
                ? 'bg-teal-500/20 border border-teal-500/30'
                : 'bg-teal-100 border border-teal-200'
            }`}>
              <Briefcase className={`w-7 h-7 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <div>
              <h1 className={`text-3xl sm:text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                My Applications
              </h1>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                Track your job applications and their status
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className='max-w-7xl mx-auto'>
        {applications.length === 0 ? (
          <div className={`rounded-2xl p-12 sm:p-16 text-center ${cardClass}`}>
            <div className={`w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center ${
              isDark
                ? 'bg-teal-500/20 border border-teal-500/30'
                : 'bg-teal-100 border border-teal-200'
            }`}>
              <FileText className={`w-12 h-12 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>

            <h3 className={`text-2xl sm:text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              You don't have any applications yet
            </h3>

            <p className={`text-lg sm:text-xl mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Start your job search journey!
            </p>

            <p className={`text-base mb-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Browse available positions and apply to jobs using your StormChain profile
            </p>

            <button
              onClick={onBack}
              className='inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg bg-teal-600 hover:bg-teal-500 text-white transition-all'
            >
              <Briefcase className='w-5 h-5' />
              Browse Jobs & Apply
            </button>
          </div>
        ) : (
          <div className='space-y-4'>
            {applications.map((app) => (
              <div key={app.id} className={`rounded-xl p-6 ${cardClass}`}>
                <div className='flex items-start justify-between gap-4 mb-4'>
                  <div className='flex-1'>
                    <h3 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {app.job_title}
                    </h3>
                    <p className={`font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {app.employer_name}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    {getStatusIcon(app.status)}
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4'>
                  <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <MapPin className='w-4 h-4' />
                    {app.job_location}
                  </div>
                  <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <Calendar className='w-4 h-4' />
                    Applied {formatDate(app.created_at)}
                  </div>
                  {formatSalary(app.job_salary_min, app.job_salary_max) && (
                    <div className='flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-semibold'>
                      <DollarSign className='w-4 h-4' />
                      {formatSalary(app.job_salary_min, app.job_salary_max)}
                    </div>
                  )}
                  <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <Eye className='w-4 h-4' />
                    {app.view_count} view{app.view_count !== 1 ? 's' : ''}
                    {app.last_viewed_at && ` • Last viewed ${formatDate(app.last_viewed_at)}`}
                  </div>
                </div>

                <div className='flex items-center gap-3 flex-wrap'>
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border ${getStatusColor(app.status)}`}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>

                  <button
                    onClick={() => copyShareLink(app.share_token)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      isDark
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Copy Share Link
                  </button>

                  {app.job_url && (
                    <a
                      href={app.job_url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                        isDark
                          ? 'bg-gray-700 text-white hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      View Original
                      <ExternalLink className='w-3.5 h-3.5' />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
