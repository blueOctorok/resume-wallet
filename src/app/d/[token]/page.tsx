'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  User,
  MapPin,
  Award,
  FileText,
  ClipboardCheck,
  Car,
  CheckCircle,
  Shield,
  Briefcase,
  ExternalLink,
  Loader2,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Calendar,
  Send,
} from 'lucide-react'

// Types for the public profile data
interface PublicProfile {
  id: string
  firstName: string
  lastName: string
  location: string | null
  summary: string | null
  experienceYears: number | null
  cdl: {
    class: string | null
    state: string | null
    expiration: string | null
    endorsements: string[]
  }
  contact?: {
    email: string | null
    phone: string | null
  }
}

interface Resume {
  id: string
  title: string
  filename: string
  verified: boolean
  blockchainVerified: boolean
  type: string
  createdAt: string
  ipfsHash: string
}

interface DotApp {
  id: string
  verified: boolean
  blockchainVerified: boolean
  isComplete: boolean
  completionPercentage: number
  createdAt: string
}

interface Mvr {
  licenseStatus: string
  totalPoints: number | null
  violationCount: number
  lastOrdered: string | null
  status: 'clean' | 'valid_with_violations' | 'review_needed'
}

interface EmploymentEntry {
  company: string
  position: string
  startDate: string
  endDate: string
}

interface ProfileData {
  success: boolean
  profile: PublicProfile
  resume: Resume | null
  dotApp: DotApp | null
  mvr: Mvr | null
  employmentSummary: EmploymentEntry[] | null
  settings: {
    allowConnect: boolean
  }
  viewCount: number
}

export default function PublicDriverProfile() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Connect form state
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [connectForm, setConnectForm] = useState({
    employerName: '',
    employerEmail: '',
    employerPhone: '',
    employerCompanyName: '',
    eventName: '',
    notes: '',
  })
  const [connecting, setConnecting] = useState(false)
  const [connectSuccess, setConnectSuccess] = useState(false)

  useEffect(() => {
    if (token) {
      fetchProfile()
    }
  }, [token])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/driver/public/${token}`)
      
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
      console.error('Error fetching profile:', err)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!connectForm.employerEmail && !connectForm.employerPhone) {
      alert('Please provide email or phone number')
      return
    }

    try {
      setConnecting(true)

      const response = await fetch(`/api/driver/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...connectForm,
          source: 'qr_scan',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send connection request')
      }

      setConnectSuccess(true)
      setShowConnectForm(false)
    } catch (err) {
      console.error('Error connecting:', err)
      alert('Failed to send connection request. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-mint mx-auto mb-4" />
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
          <p className="text-gray-400 mb-6">
            {error || 'This profile may have been removed or the link is invalid.'}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-mint text-gray-900 font-semibold rounded-xl hover:bg-brand-mint/90 transition-colors"
          >
            Go to Veree
          </a>
        </div>
      </div>
    )
  }

  const { profile, resume, dotApp, mvr, employmentSummary, settings } = data

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-mint flex items-center justify-center">
              <span className="text-gray-900 font-bold text-sm">V</span>
            </div>
            <span className="text-white font-semibold">Veree</span>
          </a>
          <span className="text-xs text-gray-500">
            Verified Driver Profile
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Profile Card */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden mb-6">
          {/* Top Section */}
          <div className="p-6 border-b border-gray-700/50">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-mint to-teal-600 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl font-bold text-gray-900">
                  {profile.firstName?.[0]}{profile.lastName?.[0]}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-white">
                  {profile.firstName} {profile.lastName}
                </h1>
                
                {profile.location && (
                  <p className="flex items-center gap-1 text-gray-400 mt-1">
                    <MapPin className="w-4 h-4" />
                    {profile.location}
                  </p>
                )}

                {profile.experienceYears && (
                  <p className="text-gray-400 mt-1">
                    {profile.experienceYears}+ years experience
                  </p>
                )}
              </div>

              {/* Verified Badge */}
              <div className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm">
                <CheckCircle className="w-4 h-4" />
                Verified
              </div>
            </div>

            {/* Summary */}
            {profile.summary && (
              <p className="mt-4 text-gray-300 text-sm leading-relaxed">
                {profile.summary}
              </p>
            )}
          </div>

          {/* CDL Info */}
          <div className="p-6 border-b border-gray-700/50">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
              <Award className="w-5 h-5 text-brand-mint" />
              CDL Information
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoBox label="Class" value={profile.cdl.class || 'N/A'} highlight />
              <InfoBox label="State" value={profile.cdl.state || 'N/A'} />
              <InfoBox 
                label="Expiration" 
                value={profile.cdl.expiration 
                  ? new Date(profile.cdl.expiration).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : 'N/A'
                } 
              />
              <InfoBox 
                label="Endorsements" 
                value={profile.cdl.endorsements?.length 
                  ? profile.cdl.endorsements.join(', ') 
                  : 'None'
                } 
              />
            </div>
          </div>

          {/* Credentials */}
          <div className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
              <Shield className="w-5 h-5 text-brand-mint" />
              Verified Credentials
            </h2>
            <div className="space-y-3">
              {/* Resume */}
              {resume && (
                <CredentialCard
                  icon={<FileText className="w-5 h-5" />}
                  title="Resume"
                  subtitle={resume.title || resume.filename}
                  verified={resume.blockchainVerified}
                  action={
                    resume.ipfsHash && !resume.ipfsHash.startsWith('built_') ? (
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${resume.ipfsHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-brand-mint hover:underline"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : null
                  }
                />
              )}

              {/* DOT Application */}
              {dotApp && (
                <CredentialCard
                  icon={<ClipboardCheck className="w-5 h-5" />}
                  title="DOT Application"
                  subtitle={dotApp.isComplete ? 'Complete' : `${dotApp.completionPercentage}% Complete`}
                  verified={dotApp.blockchainVerified}
                  status={dotApp.isComplete ? 'complete' : 'in_progress'}
                />
              )}

              {/* MVR */}
              {mvr && (
                <CredentialCard
                  icon={<Car className="w-5 h-5" />}
                  title="Motor Vehicle Record"
                  subtitle={`License: ${mvr.licenseStatus}`}
                  verified={true}
                  status={mvr.status === 'clean' ? 'complete' : mvr.status === 'valid_with_violations' ? 'warning' : 'error'}
                  extra={
                    <div className="text-xs text-gray-500 mt-1">
                      {mvr.violationCount === 0 
                        ? 'Clean record' 
                        : `${mvr.violationCount} violation${mvr.violationCount > 1 ? 's' : ''}`}
                      {mvr.totalPoints !== null && mvr.totalPoints > 0 && ` • ${mvr.totalPoints} points`}
                    </div>
                  }
                />
              )}

              {/* No credentials message */}
              {!resume && !dotApp && !mvr && (
                <p className="text-gray-500 text-center py-4">
                  No verified credentials available
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Employment History */}
        {employmentSummary && employmentSummary.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
              <Briefcase className="w-5 h-5 text-brand-mint" />
              Recent Experience
            </h2>
            <div className="space-y-3">
              {employmentSummary.map((emp, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-mint mt-2" />
                  <div>
                    <p className="text-white font-medium">{emp.position}</p>
                    <p className="text-gray-400 text-sm">{emp.company}</p>
                    <p className="text-gray-500 text-xs">
                      {emp.startDate} - {emp.endDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Info (if shared) */}
        {profile.contact && (profile.contact.email || profile.contact.phone) && (
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
              Contact Information
            </h2>
            <div className="flex flex-wrap gap-3">
              {profile.contact.email && (
                <a
                  href={`mailto:${profile.contact.email}`}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {profile.contact.email}
                </a>
              )}
              {profile.contact.phone && (
                <a
                  href={`tel:${profile.contact.phone}`}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {profile.contact.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Connect Button */}
        {settings.allowConnect && !connectSuccess && (
          <div className="text-center">
            {!showConnectForm ? (
              <button
                onClick={() => setShowConnectForm(true)}
                className="inline-flex items-center gap-2 px-8 py-4 bg-brand-mint text-gray-900 font-semibold text-lg rounded-xl hover:bg-brand-mint/90 transition-colors shadow-lg shadow-brand-mint/20"
              >
                <Building2 className="w-5 h-5" />
                I'm Hiring - Connect
              </button>
            ) : (
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 text-left">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Connect with {profile.firstName}
                </h3>
                <form onSubmit={handleConnect} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={connectForm.employerName}
                      onChange={(e) => setConnectForm({ ...connectForm, employerName: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-brand-mint"
                    />
                    <input
                      type="text"
                      placeholder="Company Name"
                      value={connectForm.employerCompanyName}
                      onChange={(e) => setConnectForm({ ...connectForm, employerCompanyName: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-brand-mint"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input
                      type="email"
                      placeholder="Email *"
                      value={connectForm.employerEmail}
                      onChange={(e) => setConnectForm({ ...connectForm, employerEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-brand-mint"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={connectForm.employerPhone}
                      onChange={(e) => setConnectForm({ ...connectForm, employerPhone: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-brand-mint"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Event Name (e.g., Columbus Trucking Expo)"
                    value={connectForm.eventName}
                    onChange={(e) => setConnectForm({ ...connectForm, eventName: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-brand-mint"
                  />
                  <textarea
                    placeholder="Message (optional)"
                    rows={3}
                    value={connectForm.notes}
                    onChange={(e) => setConnectForm({ ...connectForm, notes: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-brand-mint resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowConnectForm(false)}
                      className="px-6 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={connecting}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-brand-mint text-gray-900 font-semibold rounded-xl hover:bg-brand-mint/90 transition-colors disabled:opacity-50"
                    >
                      {connecting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Send Connection Request
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Connect Success */}
        {connectSuccess && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-2xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Connection Request Sent!
            </h3>
            <p className="text-gray-400">
              {profile.firstName} will be notified of your interest.
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Powered by <a href="/" className="text-brand-mint hover:underline">Veree</a> • Verified Driver Credentials
          </p>
        </footer>
      </main>
    </div>
  )
}

// Helper Components

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-700/30 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`font-semibold ${highlight ? 'text-brand-mint text-lg' : 'text-white'}`}>
        {value}
      </p>
    </div>
  )
}

function CredentialCard({ 
  icon, 
  title, 
  subtitle, 
  verified, 
  status,
  action,
  extra,
}: { 
  icon: React.ReactNode
  title: string
  subtitle: string
  verified: boolean
  status?: 'complete' | 'in_progress' | 'warning' | 'error'
  action?: React.ReactNode
  extra?: React.ReactNode
}) {
  const statusColors = {
    complete: 'text-green-500',
    in_progress: 'text-yellow-500',
    warning: 'text-orange-500',
    error: 'text-red-500',
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-700/30 rounded-xl">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        verified ? 'bg-green-500/20 text-green-500' : 'bg-gray-600 text-gray-400'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white">{title}</p>
        <p className={`text-sm ${status ? statusColors[status] : 'text-gray-400'}`}>
          {subtitle}
        </p>
        {extra}
      </div>
      <div className="flex items-center gap-3">
        {verified && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <CheckCircle className="w-3 h-3" />
            Verified
          </span>
        )}
        {action}
      </div>
    </div>
  )
}
