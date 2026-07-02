'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle,
  Briefcase,
  MapPin,
  DollarSign,
  Calendar,
  FileText,
  Download,
  Eye,
  Shield,
} from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'
import { useTheme } from '@/contexts/ThemeContext'

interface ApplicationData {
  id: string
  job_title: string
  employer_name: string
  job_location: string
  job_salary_min: number | null
  job_salary_max: number | null
  status: string
  created_at: string
  driver_name: string
  driver_email: string
  cdl_class: string | null
  cdl_endorsements: string[] | null
  cdl_state: string | null
  experience_years: number | null
  resume_url: string | null
  cover_letter: string | null
  application_data: any
}

export default function PublicApplicationPage() {
  const { theme } = useTheme()
  const params = useParams()
  const token = params.token as string

  const [application, setApplication] = useState<ApplicationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      fetchApplication()
      // Track view
      trackView()
    }
  }, [token])

  const fetchApplication = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/applications/public/${token}`)

      if (response.ok) {
        const data = await response.json()
        setApplication(data.application)
      } else {
        setError('Application not found or has been removed')
      }
    } catch (err) {
      console.error('Error fetching application:', err)
      setError('Failed to load application')
    } finally {
      setLoading(false)
    }
  }

  const trackView = async () => {
    try {
      await fetch(`/api/applications/track-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
    } catch (err) {
      console.error('Error tracking view:', err)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
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

  if (loading) {
    return <LoadingScreen message='Loading application...' />
  }

  if (error || !application) {
    return (
      <div className='min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900'>
        <div className='max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center'>
          <FileText className='w-16 h-16 text-gray-400 mx-auto mb-4' />
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-2'>
            Application Not Found
          </h1>
          <p className='text-gray-600 dark:text-gray-400'>
            {error || 'This application link may be invalid or has expired.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen py-8 px-4 ${
        isDarkTheme(theme) ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <div className='max-w-4xl mx-auto'>
        {/* Header */}
        <div
          className={`rounded-2xl shadow-2xl border-t-4 p-8 mb-6 ${
            isDarkTheme(theme)
              ? 'bg-teal-200/20 backdrop-blur-xl border-teal-500'
              : 'bg-white/80 backdrop-blur-xl border-teal-700'
          }`}
        >
          <div className='flex items-center gap-4 mb-4'>
            <div
              className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                isDarkTheme(theme)
                  ? 'bg-gradient-to-br from-teal-600 to-teal-600 shadow-lg shadow-teal-600/50'
                  : 'bg-gradient-to-br from-teal-700 to-teal-950 shadow-lg shadow-teal-900/40'
              }`}
            >
              <Briefcase className='w-8 h-8 text-white' />
            </div>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
                {application.driver_name}
              </h1>
              <p className='text-gray-600 dark:text-gray-400'>
                CDL Driver Application via ZKnight
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2 text-sm text-green-600 dark:text-green-400'>
            <Shield className='w-4 h-4' />
            <span className='font-semibold'>
              Blockchain-Verified Application
            </span>
          </div>
        </div>

        {/* Job Details */}
        <div
          className={`rounded-2xl shadow-2xl border-t-4 p-8 mb-6 ${
            isDarkTheme(theme)
              ? 'bg-teal-200/20 backdrop-blur-xl border-teal-500'
              : 'bg-white/80 backdrop-blur-xl border-teal-700'
          }`}
        >
          <h2 className='text-xl font-bold text-gray-900 dark:text-white mb-4'>
            Position Applied For
          </h2>
          <div className='space-y-3'>
            <div className='flex items-start gap-3'>
              <Briefcase className='w-5 h-5 text-gray-400 mt-0.5' />
              <div>
                <p className='font-semibold text-gray-900 dark:text-white'>
                  {application.job_title}
                </p>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  {application.employer_name}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-3 text-gray-600 dark:text-gray-400'>
              <MapPin className='w-5 h-5' />
              <span>{application.job_location}</span>
            </div>
            {formatSalary(
              application.job_salary_min,
              application.job_salary_max
            ) && (
              <div className='flex items-center gap-3 text-green-600 dark:text-green-400 font-semibold'>
                <DollarSign className='w-5 h-5' />
                <span>
                  {formatSalary(
                    application.job_salary_min,
                    application.job_salary_max
                  )}
                </span>
              </div>
            )}
            <div className='flex items-center gap-3 text-gray-600 dark:text-gray-400'>
              <Calendar className='w-5 h-5' />
              <span>Applied {formatDate(application.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Driver Qualifications */}
        <div
          className={`rounded-2xl shadow-2xl border-t-4 p-8 mb-6 ${
            isDarkTheme(theme)
              ? 'bg-teal-200/20 backdrop-blur-xl border-teal-500'
              : 'bg-white/80 backdrop-blur-xl border-teal-700'
          }`}
        >
          <h2 className='text-xl font-bold text-gray-900 dark:text-white mb-4'>
            Qualifications
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {application.cdl_class && (
              <div className='flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800'>
                <CheckCircle className='w-5 h-5 text-blue-600 dark:text-blue-400' />
                <div>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    CDL Class
                  </p>
                  <p className='font-semibold text-gray-900 dark:text-white'>
                    Class {application.cdl_class}
                  </p>
                </div>
              </div>
            )}
            {application.cdl_endorsements &&
              application.cdl_endorsements.length > 0 && (
                <div className='flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800'>
                  <CheckCircle className='w-5 h-5 text-green-600 dark:text-green-400' />
                  <div>
                    <p className='text-sm text-gray-600 dark:text-gray-400'>
                      Endorsements
                    </p>
                    <p className='font-semibold text-gray-900 dark:text-white'>
                      {application.cdl_endorsements.join(', ')}
                    </p>
                  </div>
                </div>
              )}
            {application.experience_years !== null && (
              <div className='flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800'>
                <CheckCircle className='w-5 h-5 text-purple-600 dark:text-purple-400' />
                <div>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    Experience
                  </p>
                  <p className='font-semibold text-gray-900 dark:text-white'>
                    {application.experience_years} years
                  </p>
                </div>
              </div>
            )}
            {application.cdl_state && (
              <div className='flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800'>
                <CheckCircle className='w-5 h-5 text-orange-600 dark:text-orange-400' />
                <div>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    CDL State
                  </p>
                  <p className='font-semibold text-gray-900 dark:text-white'>
                    {application.cdl_state}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cover Letter */}
        {application.cover_letter && (
          <div
            className={`rounded-2xl shadow-2xl border-t-4 p-8 mb-6 ${
              isDarkTheme(theme)
                ? 'bg-teal-200/20 backdrop-blur-xl border-teal-500'
                : 'bg-white/80 backdrop-blur-xl border-teal-700'
            }`}
          >
            <h2 className='text-xl font-bold text-gray-900 dark:text-white mb-4'>
              Cover Letter
            </h2>
            <p className='text-gray-700 dark:text-gray-300 whitespace-pre-wrap'>
              {application.cover_letter}
            </p>
          </div>
        )}

        {/* Contact & Documents */}
        <div
          className={`rounded-2xl shadow-2xl border-t-4 p-8 mb-6 ${
            isDarkTheme(theme)
              ? 'bg-teal-200/20 backdrop-blur-xl border-teal-500'
              : 'bg-white/80 backdrop-blur-xl border-teal-700'
          }`}
        >
          <h2 className='text-xl font-bold text-gray-900 dark:text-white mb-4'>
            Contact & Documents
          </h2>
          <div className='space-y-3'>
            {application.driver_email && (
              <div>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  Email
                </p>
                <a
                  href={`mailto:${application.driver_email}`}
                  className='text-blue-600 dark:text-blue-400 hover:underline font-semibold'
                >
                  {application.driver_email}
                </a>
              </div>
            )}
            {application.resume_url && (
              <div>
                <a
                  href={application.resume_url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all ${
                    isDarkTheme(theme)
                      ? 'bg-gradient-to-r from-teal-600 to-teal-600 text-white'
                      : 'bg-gradient-to-r from-teal-700 to-teal-950 text-white'
                  }`}
                >
                  <Download className='w-4 h-4' />
                  Download Resume
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Powered by Storm */}
        <div className='text-center py-8'>
          <p
            className={`mb-2 ${
              isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Powered by{' '}
            <span
              className={`font-bold ${
                isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'
              }`}
            >
              ZKnight
            </span>
          </p>
          <p
            className={`text-sm ${
              isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'
            }`}
          >
            Blockchain-Verified Driver Applications
          </p>
        </div>
      </div>
    </div>
  )
}
