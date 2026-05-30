'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Users,
  UserPlus,
  Mail,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Copy,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { INVITEABLE_ROLES, getDisplayRole } from '@/lib/employer-roles'
import UserIdentity from '@/components/ui/UserIdentity'

interface TeamMember {
  id: string
  userId: string | null
  role: string
  name: string | null
  email: string
  walletAddress: string | null
  isActive: boolean
  isPending: boolean
  invitedAt: string
  acceptedAt: string | null
}

interface TeamManagementProps {
  walletAddress: string
  onBack?: () => void
}

// Map role to avatar color for visual distinction
function getRoleColor(role: string): 'purple' | 'blue' | 'teal' | 'gray' {
  switch (role) {
    case 'owner': return 'purple'
    case 'admin': return 'blue'
    case 'viewer': return 'gray'
    default: return 'teal'
  }
}

export default function TeamManagement({ walletAddress, onBack }: TeamManagementProps) {
  const { theme } = useTheme()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canManageTeam, setCanManageTeam] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('recruiter')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)

  // Member action state
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTeam = useCallback(async (background = false) => {
    try {
      if (!background) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
      setError(null)

      const res = await fetch('/api/employer/team')

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch team')
      }

      const data = await res.json()
      setMembers(data.members || [])
      setCanManageTeam(data.canManageTeam)
      setCurrentUserRole(data.currentUserRole)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [walletAddress])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }

    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      const res = await fetch('/api/employer/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invite')
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setLastInviteUrl(data.inviteUrl)
      setInviteEmail('')
      fetchTeam(true)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this team member? They will lose access to company data.')) {
      return
    }

    setRemovingMember(memberId)

    try {
      const res = await fetch(`/api/employer/team/${memberId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove member')
      }

      fetchTeam(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemovingMember(null)
    }
  }

  const handleNameChange = async (memberId: string, newName: string) => {
    const res = await fetch(`/api/employer/team/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json',
      },
        body: JSON.stringify({ displayName: newName }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to update name')
    }

    fetchTeam(true)
  }

  const copyInviteUrl = () => {
    if (lastInviteUrl) {
      navigator.clipboard.writeText(lastInviteUrl)
    }
  }

  if (loading) {
    return (
      <div className='min-h-[60vh] flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className={`w-8 h-8 animate-spin mx-auto ${isDarkTheme(theme) ? 'text-teal-400' : 'text-teal-600'}`} />
          <p className={`mt-4 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>Loading team...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='min-h-[60vh] flex items-center justify-center'>
        <div className='text-center'>
          <AlertCircle className='w-12 h-12 text-red-500 mx-auto' />
          <p className='text-red-500 font-medium mt-4'>{error}</p>
          <Button type="button" variant="secondary" size="md" className="mt-4" onClick={() => fetchTeam()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const activeMembers = members.filter(m => m.isActive && !m.isPending)
  const pendingInvites = members.filter(m => m.isPending)

  return (
    <div className='space-y-6'>
      {/* Back button */}
      {onBack && (
        <div>
          <BackToHubButton onClick={onBack} />
        </div>
      )}

      {/* Header */}
      <div className='flex items-center justify-between flex-wrap gap-4'>
        <div>
          <h1 className={`text-2xl font-bold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            Team Management
          </h1>
          <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
            Manage your company team members and invitations
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='secondary'
            size='md'
            onClick={() => fetchTeam(true)}
            disabled={refreshing}
            title='Refresh team list'
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          {canManageTeam && (
            <Button type='button' variant='primary' size='md' onClick={() => setShowInviteModal(true)}>
              <UserPlus className='h-4 w-4' />
              Invite member
            </Button>
          )}
        </div>
      </div>

      <HubSectionPanel isDark={isDarkTheme(theme)} accent='teal' className='mb-6'>
        <BlockCard variant='embed' icon={Users} title='Team overview' description='Active seats and outstanding invites.'>
      <div className='grid grid-cols-2 gap-4'>
        <div className='rounded-xl border border-gray-200/90 bg-gradient-to-b from-white/95 to-slate-50/90 p-4 dark:border-gray-600/70 dark:from-gray-900/90 dark:to-gray-950/90'>
          <div className='flex items-center gap-3'>
            <div className={`p-2.5 rounded-xl ${isDarkTheme(theme) ? 'bg-green-500/20' : 'bg-green-100'}`}>
              <Users className='w-5 h-5 text-green-500' />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                {activeMembers.length}
              </p>
              <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                Active Members
              </p>
            </div>
          </div>
        </div>

        <div className='rounded-xl border border-gray-200/90 bg-gradient-to-b from-white/95 to-slate-50/90 p-4 dark:border-gray-600/70 dark:from-gray-900/90 dark:to-gray-950/90'>
          <div className='flex items-center gap-3'>
            <div className={`p-2.5 rounded-xl ${isDarkTheme(theme) ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}>
              <Clock className='w-5 h-5 text-yellow-500' />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                {pendingInvites.length}
              </p>
              <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                Pending Invites
              </p>
            </div>
          </div>
        </div>
      </div>
        </BlockCard>
      </HubSectionPanel>

      <HubSectionPanel isDark={isDarkTheme(theme)} accent='teal' className='mb-6'>
        <BlockCard
          variant='embed'
          icon={CheckCircle}
          title={`Active members (${activeMembers.length})`}
          description='People with access to your employer hub.'
        >
        <div className={`divide-y ${isDarkTheme(theme) ? 'divide-gray-700/50' : 'divide-gray-200'}`}>
          {activeMembers.length === 0 ? (
            <div className='p-8 text-center'>
              <Users className={`w-12 h-12 mx-auto ${isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-400'}`} />
              <p className={`mt-2 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                No active team members yet
              </p>
            </div>
          ) : (
            activeMembers.map(member => (
              <div key={member.id} className='p-4'>
                <div className='flex items-center justify-between gap-4'>
                  {/* User Identity - reusable component */}
                  <UserIdentity
                    name={member.name}
                    email={member.email}
                    walletAddress={member.walletAddress}
                    avatarColor={getRoleColor(member.role)}
                    size='lg'
                    showWallet={true}
                    showEmail={false}
                    editable={canManageTeam}
                    onNameChange={(newName) => handleNameChange(member.id, newName)}
                    className='flex-1 min-w-0'
                  />

                  {/* Right side: role badge + actions */}
                  <div className='flex items-center gap-3 flex-shrink-0'>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      member.role === 'owner'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : member.role === 'admin'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : member.role === 'viewer'
                            ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            : isDarkTheme(theme)
                              ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                              : 'bg-teal-100 text-teal-700 border border-teal-200'
                    }`}>
                      {getDisplayRole(member.role)}
                    </span>
                    {canManageTeam && member.role !== 'owner' && currentUserRole === 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removingMember === member.id}
                        className={`p-2 rounded-lg transition-colors ${
                          isDarkTheme(theme)
                            ? 'hover:bg-red-500/20 text-red-400'
                            : 'hover:bg-red-50 text-red-500'
                        }`}
                        title='Remove member'
                      >
                        {removingMember === member.id ? (
                          <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                          <Trash2 className='w-4 h-4' />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        </BlockCard>
      </HubSectionPanel>

      {pendingInvites.length > 0 && (
        <HubSectionPanel isDark={isDarkTheme(theme)} accent='amber' className='mb-6'>
          <BlockCard
            variant='embed'
            icon={Clock}
            title={`Pending invites (${pendingInvites.length})`}
            description='Awaiting acceptance — you can cancel from here.'
          >
          <div className={`divide-y ${isDarkTheme(theme) ? 'divide-gray-700/50' : 'divide-gray-200'}`}>
            {pendingInvites.map(member => (
              <div key={member.id} className='p-4 flex items-center justify-between gap-4'>
                <div className='flex items-center gap-3'>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isDarkTheme(theme) ? 'bg-yellow-500/20' : 'bg-yellow-100'
                  }`}>
                    <Mail className='w-5 h-5 text-yellow-500' />
                  </div>
                  <div>
                    <p className={`font-medium ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                      {member.email}
                    </p>
                    <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                      Invited {new Date(member.invitedAt).toLocaleDateString()} as {getDisplayRole(member.role)}
                    </p>
                  </div>
                </div>
                {canManageTeam && (
                  <Button
                    type='button'
                    variant='danger'
                    size='sm'
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removingMember === member.id}
                    isLoading={removingMember === member.id}
                  >
                    Cancel invite
                  </Button>
                )}
              </div>
            ))}
          </div>
          </BlockCard>
        </HubSectionPanel>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <Modal onClose={() => setShowInviteModal(false)} maxWidth="max-w-lg">
          <ModalHeader
            title="Invite Team Member"
            subtitle="Send an invitation to join your company"
            onClose={() => setShowInviteModal(false)}
          />

          {/* Modal Body */}
          <div className='p-6 space-y-6'>
              {/* Email Input */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${
                  isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Email Address
                </label>
                <input
                  type='email'
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder='teammate@company.com'
                  className={`w-full px-4 py-3 rounded-xl border-2 text-base ${
                    isDarkTheme(theme)
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                  } focus:outline-none transition-colors`}
                />
              </div>

              {/* Role Selection - Radio Cards */}
              <div>
                <label className={`block text-sm font-semibold mb-3 ${
                  isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Select Role
                </label>
                <div className='space-y-3'>
                  {INVITEABLE_ROLES.map(role => (
                    <label
                      key={role.value}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        inviteRole === role.value
                          ? isDarkTheme(theme)
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-indigo-500 bg-indigo-50'
                          : isDarkTheme(theme)
                            ? 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <input
                        type='radio'
                        name='role'
                        value={role.value}
                        checked={inviteRole === role.value}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className='sr-only'
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        inviteRole === role.value
                          ? 'border-indigo-500 bg-indigo-500'
                          : isDarkTheme(theme)
                            ? 'border-gray-600'
                            : 'border-gray-300'
                      }`}>
                        {inviteRole === role.value && (
                          <div className='w-2 h-2 rounded-full bg-white' />
                        )}
                      </div>
                      <div className='flex-1'>
                        <p className={`font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                          {role.label}
                        </p>
                        <p className={`text-sm mt-0.5 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                          {role.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Error/Success Messages */}
              {inviteError && (
                <div className='flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30'>
                  <AlertCircle className='w-5 h-5 text-red-500 flex-shrink-0 mt-0.5' />
                  <p className='text-sm text-red-400'>{inviteError}</p>
                </div>
              )}

              {inviteSuccess && (
                <div className='p-4 rounded-xl bg-green-500/10 border border-green-500/30'>
                  <div className='flex items-start gap-3'>
                    <CheckCircle className='w-5 h-5 text-green-500 flex-shrink-0 mt-0.5' />
                    <div className='flex-1'>
                      <p className='text-sm text-green-400 font-medium'>{inviteSuccess}</p>
                      {lastInviteUrl && (
                        <div className='mt-3'>
                          <p className={`text-xs mb-2 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                            Share this link directly:
                          </p>
                          <div className='flex items-center gap-2'>
                            <code className={`text-xs flex-1 truncate px-3 py-2 rounded-lg ${
                              isDarkTheme(theme) ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {lastInviteUrl}
                            </code>
                            <button
                              onClick={copyInviteUrl}
                              className={`p-2 rounded-lg transition-colors ${
                                isDarkTheme(theme)
                                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                              }`}
                              title='Copy link'
                            >
                              <Copy className='w-4 h-4' />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

          {/* Modal Footer */}
          <div className={`p-6 border-t ${isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'} flex justify-end gap-3`}>
            <button
              onClick={() => {
                setShowInviteModal(false)
                setInviteEmail('')
                setInviteError(null)
                setInviteSuccess(null)
                setLastInviteUrl(null)
              }}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-colors ${
                isDarkTheme(theme)
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Close
            </button>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className='flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              {inviting ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className='w-4 h-4' />
                  Send Invitation
                </>
              )}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
