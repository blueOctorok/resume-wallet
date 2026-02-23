'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import LoadingScreen from '@/components/LoadingScreen'
import {
  Building2,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
  Shield,
  Briefcase,
  MapPin,
} from 'lucide-react'

interface InviteData {
  valid: boolean
  invite: {
    id: string
    status: string
    candidateEmail: string | null
    candidateName: string | null
    welcomeMessage: string | null
    expiresAt: string | null
  }
  company: {
    id: string
    name: string
  } | null
  job: {
    id: string
    title: string
    description: string | null
    location: string | null
  } | null
  invalidReason: 'expired' | 'completed' | 'cancelled' | null
}

export default function ApplyPage() {
  const { theme } = useTheme()
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch invite data
  useEffect(() => {
    if (token) {
      fetchInvite()
    }
  }, [token])

  const fetchInvite = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/invite/${token}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('This invite link is not valid or has been removed.')
        } else {
          setError('Failed to load invite information.')
        }
        return
      }

      const data = await response.json()
      setInviteData(data)
    } catch (err) {
      console.error('Error fetching invite:', err)
      setError('Failed to load invite information.')
    } finally {
      setLoading(false)
    }
  }

  const handleStartApplication = useCallback(() => {
    // Store invite token in sessionStorage so the main app can track it
    sessionStorage.setItem('stormchain_invite_token', token)
    
    // Mark invite as in_progress
    fetch(`/api/invite/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(err => console.error('Error marking invite in progress:', err))

    // Redirect to main app - it will handle auth and show DOT application
    // The main app checks for stored invite token to track completion
    router.push('/?action=dot-application')
  }, [token, router])

  if (loading) {
    return <LoadingScreen message="Loading application invite..." />
  }

  if (error || !inviteData) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`max-w-md w-full rounded-2xl shadow-xl p-8 text-center ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}>
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className={`text-2xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Invite Not Found
          </h1>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            {error || 'This invite link may be invalid or has expired.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Go to StormChain
          </button>
        </div>
      </div>
    )
  }

  // Handle invalid invite states
  if (!inviteData.valid) {
    let icon = <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
    let title = 'Invite Unavailable'
    let message = 'This invite is no longer available.'

    if (inviteData.invalidReason === 'expired') {
      icon = <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
      title = 'Invite Expired'
      message = 'This application invite has expired. Please contact the company for a new link.'
    } else if (inviteData.invalidReason === 'completed') {
      icon = <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      title = 'Application Completed'
      message = 'You have already completed this application. Thank you!'
    } else if (inviteData.invalidReason === 'cancelled') {
      icon = <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      title = 'Invite Cancelled'
      message = 'This invite has been cancelled by the company.'
    }

    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`max-w-md w-full rounded-2xl shadow-xl p-8 text-center ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}>
          {icon}
          <h1 className={`text-2xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {title}
          </h1>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            {message}
          </p>
          {inviteData.company && (
            <p className={`mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
              Company: {inviteData.company.name}
            </p>
          )}
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Go to StormChain
          </button>
        </div>
      </div>
    )
  }

  // Valid invite - show landing page
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`border-b ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-teal-500" />
            <span className={`font-bold text-xl ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              StormChain
            </span>
          </div>
          <span className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Verified Driver Applications
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Company Card */}
        <div className={`rounded-2xl shadow-xl overflow-hidden ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}>
          {/* Company Header */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-8 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {inviteData.company?.name || 'Company'}
                </h1>
                <p className="text-teal-100">Driver Application</p>
              </div>
            </div>
            {inviteData.job && (
              <div className="bg-white/10 rounded-lg px-4 py-3 mt-4">
                <div className="flex items-center gap-2 text-sm text-teal-100 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span>Position</span>
                </div>
                <p className="font-semibold">{inviteData.job.title}</p>
                {inviteData.job.location && (
                  <div className="flex items-center gap-1 text-sm text-teal-100 mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{inviteData.job.location}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Welcome Message / Instructions */}
          <div className="px-6 py-6">
            {inviteData.invite.welcomeMessage ? (
              <div className={`mb-6 p-4 rounded-lg ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
                <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  {inviteData.invite.welcomeMessage}
                </p>
              </div>
            ) : (
              <p className={`mb-6 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                You&apos;ve been invited to complete a driver application for{' '}
                <strong>{inviteData.company?.name}</strong>. 
                Click below to get started.
              </p>
            )}

            {/* What to Expect */}
            <div className="mb-6">
              <h3 className={`font-semibold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                What You&apos;ll Need
              </h3>
              <ul className={`space-y-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
                  <span>Driver&apos;s license information (CDL number, class, endorsements)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
                  <span>Employment history (last 10 years)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
                  <span>Driving record (accidents, violations)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
                  <span>Medical certificate information</span>
                </li>
              </ul>
            </div>

            {/* Time Estimate */}
            <div className={`flex items-center gap-2 mb-6 text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <Clock className="w-4 h-4" />
              <span>Estimated time: 15-25 minutes</span>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleStartApplication}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
            >
              <FileText className="w-5 h-5" />
              Start Application
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Trust Badge */}
            <div className={`mt-6 pt-6 border-t text-center ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-teal-500" />
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                  Powered by StormChain — Blockchain-Verified Credentials
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className={`mt-8 text-center text-sm ${
          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        }`}>
          <p>Your application data is securely stored and verified.</p>
          {inviteData.invite.expiresAt && (
            <p className="mt-1">
              This invite expires on {new Date(inviteData.invite.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
