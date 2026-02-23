'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Link2,
  Plus,
  Copy,
  Check,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
  ExternalLink,
  Mail,
  Send,
  Briefcase,
  AlertCircle,
  Trash2,
  Database,
} from 'lucide-react'

interface Invite {
  id: string
  token: string
  url: string
  candidateEmail: string | null
  candidateName: string | null
  status: 'pending' | 'viewed' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
  jobTitle: string | null
  jobPostingId: string | null
  viewCount: number
  expiresAt: string | null
  createdAt: string
  usedAt: string | null
  usedByName: string | null
  driverApplicationId: string | null
}

interface Job {
  id: string
  title: string
}

interface ApplicationInvitesProps {
  walletAddress: string
  onExportApplication?: (applicationId: string) => void
}

export default function ApplicationInvites({
  walletAddress,
  onExportApplication,
}: ApplicationInvitesProps) {
  const { theme } = useTheme()
  const [invites, setInvites] = useState<Invite[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)
  const [emailSentId, setEmailSentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    candidateEmail: '',
    candidateName: '',
    jobPostingId: '',
    welcomeMessage: '',
  })

  // Fetch invites and jobs
  useEffect(() => {
    if (walletAddress) {
      fetchInvites()
      fetchJobs()
    }
  }, [walletAddress])

  const fetchInvites = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/employer/invites', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (response.ok) {
        const data = await response.json()
        setInvites(data.invites || [])
      }
    } catch (err) {
      console.error('Error fetching invites:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/employer/jobs', {
        headers: { 'x-wallet-address': walletAddress },
      })
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
    }
  }

  const handleCreateInvite = async () => {
    setCreating(true)
    setError(null)
    
    try {
      const response = await fetch('/api/employer/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({
          candidateEmail: formData.candidateEmail || undefined,
          candidateName: formData.candidateName || undefined,
          jobPostingId: formData.jobPostingId || undefined,
          welcomeMessage: formData.welcomeMessage || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create invite')
      }

      const data = await response.json()
      setInvites(prev => [data.invite, ...prev])
      setShowCreateForm(false)
      setFormData({ candidateEmail: '', candidateName: '', jobPostingId: '', welcomeMessage: '' })
      
      // Auto-copy the new invite URL
      copyToClipboard(data.invite.url, data.invite.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleCancelInvite = async (id: string) => {
    try {
      const response = await fetch('/api/employer/invites', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ id, status: 'cancelled' }),
      })

      if (response.ok) {
        setInvites(prev => prev.map(inv => 
          inv.id === id ? { ...inv, status: 'cancelled' } : inv
        ))
      }
    } catch (err) {
      console.error('Error cancelling invite:', err)
    }
  }

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const handleSendEmail = async (invite: Invite) => {
    // Prompt for email if not set
    let email = invite.candidateEmail
    if (!email) {
      email = window.prompt('Enter candidate email address:')
      if (!email) return
    }

    setSendingEmailId(invite.id)
    setError(null)

    try {
      const response = await fetch('/api/employer/invites/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({
          inviteId: invite.id,
          email: email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      // Update invite with email if it wasn't set
      if (!invite.candidateEmail) {
        setInvites(prev => prev.map(inv => 
          inv.id === invite.id ? { ...inv, candidateEmail: email } : inv
        ))
      }

      setEmailSentId(invite.id)
      setTimeout(() => setEmailSentId(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSendingEmailId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: Clock },
      viewed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: Eye },
      in_progress: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', icon: Loader2 },
      completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
      expired: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', icon: Clock },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: XCircle },
    }
    const style = styles[status as keyof typeof styles] || styles.pending
    const Icon = style.icon
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </span>
    )
  }

  return (
    <div className={`rounded-xl border ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb'
      }}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-teal-900/50' : 'bg-teal-100'
          }`}>
            <Link2 className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Application Invites
            </h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Send candidates a link to complete their DOT application
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Invite
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className={`px-6 py-4 border-b ${
          theme === 'dark' ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Candidate Name (optional)
              </label>
              <input
                type="text"
                value={formData.candidateName}
                onChange={(e) => setFormData(prev => ({ ...prev, candidateName: e.target.value }))}
                placeholder="John Doe"
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Candidate Email (optional)
              </label>
              <input
                type="email"
                value={formData.candidateEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, candidateEmail: e.target.value }))}
                placeholder="candidate@example.com"
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Link to Job (optional)
              </label>
              <select
                value={formData.jobPostingId}
                onChange={(e) => setFormData(prev => ({ ...prev, jobPostingId: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">No specific job</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Welcome Message (optional)
              </label>
              <input
                type="text"
                value={formData.welcomeMessage}
                onChange={(e) => setFormData(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                placeholder="We're excited to have you apply!"
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowCreateForm(false)
                setFormData({ candidateEmail: '', candidateName: '', jobPostingId: '', welcomeMessage: '' })
                setError(null)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateInvite}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create & Copy Link
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Invites List */}
      <div className="divide-y" style={{
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb'
      }}>
        {loading ? (
          <div className="px-6 py-8 text-center">
            <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-2 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`} />
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
              Loading invites...
            </p>
          </div>
        ) : invites.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Link2 className={`w-12 h-12 mx-auto mb-3 ${
              theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
            }`} />
            <p className={`font-medium mb-1 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              No invites yet
            </p>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              Create an invite to send candidates a link to your DOT application
            </p>
          </div>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.id}
              className={`px-6 py-4 ${
                invite.status === 'cancelled' || invite.status === 'expired'
                  ? 'opacity-60'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    {invite.candidateName ? (
                      <span className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {invite.candidateName}
                      </span>
                    ) : invite.candidateEmail ? (
                      <span className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {invite.candidateEmail}
                      </span>
                    ) : (
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                        General invite link
                      </span>
                    )}
                    {getStatusBadge(invite.status)}
                  </div>
                  
                  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {invite.jobTitle && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {invite.jobTitle}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {invite.viewCount} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Created {new Date(invite.createdAt).toLocaleDateString()}
                    </span>
                    {invite.expiresAt && (
                      <span className="flex items-center gap-1">
                        Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {invite.status === 'completed' && invite.usedByName && (
                    <div className={`mt-2 text-sm ${
                      theme === 'dark' ? 'text-green-400' : 'text-green-600'
                    }`}>
                      ✓ Completed by {invite.usedByName}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {invite.status !== 'cancelled' && invite.status !== 'expired' && invite.status !== 'completed' && (
                    <>
                      {/* Copy Link */}
                      <button
                        onClick={() => copyToClipboard(invite.url, invite.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          copiedId === invite.id
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : theme === 'dark'
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {copiedId === invite.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy Link
                          </>
                        )}
                      </button>

                      {/* Send Email */}
                      <button
                        onClick={() => handleSendEmail(invite)}
                        disabled={sendingEmailId === invite.id}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          emailSentId === invite.id
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : sendingEmailId === invite.id
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : theme === 'dark'
                                ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-900'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        {emailSentId === invite.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            Sent!
                          </>
                        ) : sendingEmailId === invite.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send Email
                          </>
                        )}
                      </button>

                      {/* Push to Bullhorn - Coming Soon */}
                      <button
                        disabled
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium cursor-not-allowed ${
                          theme === 'dark'
                            ? 'bg-gray-700/50 text-gray-500'
                            : 'bg-gray-100/50 text-gray-400'
                        }`}
                        title="Bullhorn integration coming soon"
                      >
                        <Database className="w-4 h-4" />
                        Bullhorn
                      </button>
                    </>
                  )}
                  
                  {invite.status === 'completed' && invite.driverApplicationId && onExportApplication && (
                    <button
                      onClick={() => onExportApplication(invite.driverApplicationId!)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
                        theme === 'dark'
                          ? 'bg-teal-900/50 text-teal-400 hover:bg-teal-900'
                          : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                      }`}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Export PDF
                    </button>
                  )}

                  {(invite.status === 'pending' || invite.status === 'viewed') && (
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'text-gray-500 hover:text-red-400 hover:bg-gray-700'
                          : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'
                      }`}
                      title="Cancel invite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
