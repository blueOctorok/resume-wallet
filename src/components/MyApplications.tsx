'use client'

import { useState, useEffect } from 'react'
import { Briefcase, ExternalLink, Eye, Clock, CheckCircle, XCircle, ArrowLeft, FileText, Calendar, MapPin, DollarSign } from 'lucide-react'
import LoadingScreen from './LoadingScreen'
import { useTheme } from '@/contexts/ThemeContext'

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

export default function MyApplications({ onBack, userAddress }: MyApplicationsProps) {
  const { theme } = useTheme()
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
        body: JSON.stringify({ walletAddress: userAddress })
      })

      if (response.ok) {
        const data = await response.json()
        setApplications(data.applications || [])
      } else {
        setError('Failed to load applications')
      }
    } catch (err) {
      console.error('Error fetching applications:', err)
      setError('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-5 h-5 text-blue-500" />
      case 'viewed':
        return <Eye className="w-5 h-5 text-purple-500" />
      case 'interviewing':
        return <Briefcase className="w-5 h-5 text-orange-500" />
      case 'hired':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
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
      year: 'numeric' 
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
    // Could show a toast notification here
    alert('Application link copied to clipboard!')
  }

  if (loading) {
    return <LoadingScreen message="Loading your applications..." />
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className={`rounded-2xl shadow-2xl border-t-4 p-6 sm:p-8 transition-all ${
          theme === 'dark'
            ? 'bg-brand-sage-light/20 backdrop-blur-xl border-brand-mint'
            : 'bg-white/80 backdrop-blur-xl border-brand-sage'
        }`}>
          <div className="flex items-center gap-4 mb-2">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-brand-mint to-teal-600 shadow-lg shadow-brand-mint/50'
                : 'bg-gradient-to-br from-brand-sage to-brand-sage-dark shadow-lg shadow-brand-sage/50'
            }`}>
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                My Applications
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track your job applications and their status
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-900 dark:text-red-100">{error}</p>
          </div>
        )}

        {applications.length === 0 ? (
          <div className={`rounded-2xl shadow-2xl border-t-4 p-12 text-center transition-all ${
            theme === 'dark'
              ? 'bg-brand-sage-light/20 backdrop-blur-xl border-brand-mint'
              : 'bg-white/80 backdrop-blur-xl border-brand-sage'
          }`}>
            <FileText className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No applications yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Start browsing jobs and apply with your Veree profile!
            </p>
            <button
              onClick={onBack}
              className={`px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-brand-mint to-teal-600 text-white'
                  : 'bg-gradient-to-r from-brand-sage to-brand-sage-dark text-white'
              }`}
            >
              Browse Jobs
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className={`rounded-xl shadow-2xl border-t-4 p-6 hover:shadow-xl transition-all ${
                  theme === 'dark'
                    ? 'bg-brand-sage-light/20 backdrop-blur-xl border-brand-mint'
                    : 'bg-white/80 backdrop-blur-xl border-brand-sage'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {app.job_title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 font-semibold">
                      {app.employer_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(app.status)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4" />
                    {app.job_location}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    Applied {formatDate(app.created_at)}
                  </div>
                  {formatSalary(app.job_salary_min, app.job_salary_max) && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-semibold">
                      <DollarSign className="w-4 h-4" />
                      {formatSalary(app.job_salary_min, app.job_salary_max)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Eye className="w-4 h-4" />
                    {app.view_count} view{app.view_count !== 1 ? 's' : ''}
                    {app.last_viewed_at && ` • Last viewed ${formatDate(app.last_viewed_at)}`}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border ${getStatusColor(app.status)}`}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                  
                  <button
                    onClick={() => copyShareLink(app.share_token)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      theme === 'dark'
                        ? 'bg-gray-800 text-white hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Copy Share Link
                  </button>

                  {app.job_url && (
                    <a
                      href={app.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                        theme === 'dark'
                          ? 'bg-gray-800 text-white hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      View Original
                      <ExternalLink className="w-3.5 h-3.5" />
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

