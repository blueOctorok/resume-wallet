'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  UserPlus,
  Loader2,
  Trash2,
} from 'lucide-react'
import type { AdminTabProps, AdminCompany, CompanyMember } from '@/components/admin/admin-types'
import { getEmployerBlockDefinition } from '@/lib/employer-block-registry'

interface CompaniesTabProps extends AdminTabProps {
  onCreateCompany: () => void
}

export default function CompaniesTab({
  theme,
  sessionUserId,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
  onCreateCompany,
}: CompaniesTabProps) {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [companyStats, setCompanyStats] = useState({ total: 0, pending: 0, active: 0, suspended: 0 })
  const [companyStatusFilter, setCompanyStatusFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all')
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null)
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('recruiter')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  type AdminEmployerHubPayload = {
    companyId: string
    blocks: Array<{ id: string; block_type: string; added_at: string }>
    recentAudit: Array<{
      id: string
      blockType: string
      action: string
      actorKind: string
      actorEmail: string | null
      createdAt: string
      reason: string | null
    }>
  }
  const [companyEmployerHub, setCompanyEmployerHub] = useState<AdminEmployerHubPayload | null>(null)

  const fetchData = useCallback(async () => {
    if (!sessionUserId) return
    try {
      const res = await fetch(
        `/api/admin/companies?status=${companyStatusFilter}&search=${encodeURIComponent(searchQuery)}`,
        { headers: { 'x-wallet-address': sessionUserId } }
      )
      const data = await res.json()
      if (data.success) {
        setCompanies(data.companies)
        setCompanyStats(data.stats)
        setTotalCount(data.companies.length)
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err)
    }
  }, [sessionUserId, searchQuery, companyStatusFilter, setTotalCount])

  const pageOffset = (currentPage - 1) * pageSize
  const pagedCompanies = companies.slice(pageOffset, pageOffset + pageSize)

  useEffect(() => {
    fetchData()
  }, [fetchData, currentPage])

  const fetchCompanyMembers = useCallback(async (companyId: string) => {
    if (!sessionUserId) return
    setLoadingMembers(true)
    try {
      const [memRes, hubRes] = await Promise.all([
        fetch(`/api/admin/companies/${companyId}/members`, {
          headers: { 'x-wallet-address': sessionUserId },
        }),
        fetch(`/api/admin/companies/${companyId}/blocks`, {
          headers: { 'x-wallet-address': sessionUserId },
        }),
      ])
      const memData = await memRes.json()
      if (memData.success) {
        setCompanyMembers(memData.members)
      }
      const hubData = await hubRes.json()
      if (hubRes.ok && hubData.success) {
        setCompanyEmployerHub({
          companyId,
          blocks: hubData.blocks ?? [],
          recentAudit: (hubData.recentAudit ?? []).map(
            (r: Record<string, unknown>) => ({
              id: String(r.id),
              blockType: String(r.block_type ?? ''),
              action: String(r.action ?? ''),
              actorKind: String(r.actor_kind ?? ''),
              actorEmail: (r.actorEmail as string | null | undefined) ?? null,
              createdAt: String(r.created_at ?? ''),
              reason: (r.reason as string | null | undefined) ?? null,
            }),
          ),
        })
      } else {
        setCompanyEmployerHub(null)
      }
    } catch (err) {
      console.error('Failed to fetch company members:', err)
    } finally {
      setLoadingMembers(false)
    }
  }, [sessionUserId])

  const handleInviteCompanyMember = useCallback(async (companyId: string) => {
    if (!sessionUserId) return
    const email = inviteEmail.trim()
    if (!email) {
      setInviteError('Email is required')
      return
    }
    setInviting(true)
    setInviteError(null)
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': sessionUserId,
        },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send invite')
      }
      setInviteEmail('')
      fetchCompanyMembers(companyId)
      fetchData()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }, [sessionUserId, inviteEmail, inviteRole, fetchCompanyMembers, fetchData])

  const handleRemoveCompanyMember = useCallback(async (companyId: string, memberId: string, memberName: string) => {
    if (!sessionUserId) return
    const confirmed = confirm(`Remove "${memberName || 'this member'}" from the company?\n\nThey will lose access to company data.`)
    if (!confirmed) return
    
    setRemovingMemberId(memberId)
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'x-wallet-address': sessionUserId },
      })
      const data = await res.json()
      if (data.success) {
        fetchCompanyMembers(companyId)
        fetchData()
      } else {
        alert('Failed to remove member: ' + (data.error || 'Unknown error'))
      }
    } catch {
      alert('Failed to remove member: Network error')
    } finally {
      setRemovingMemberId(null)
    }
  }, [sessionUserId, fetchCompanyMembers, fetchData])

  return (
    <div className='p-6'>
      {/* Stale pending alert — companies waiting > 7 days for approval */}
      {(() => {
        const staleCount = companies.filter(c => {
          if (c.status !== 'pending') return false
          const days = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86_400_000)
          return days >= 7
        }).length
        return staleCount > 0 ? (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border ${
            isDarkTheme(theme)
              ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-300'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <AlertTriangle className='w-4 h-4 shrink-0' />
            <p className='text-sm'>
              <span className='font-semibold'>{staleCount} {staleCount === 1 ? 'company has' : 'companies have'} been pending for 7+ days</span>
              {' '}— filter by <button onClick={() => setCompanyStatusFilter('pending')} className='underline font-medium'>Pending</button> to review.
            </p>
          </div>
        ) : null
      })()}

      {/* Status Filter Pills */}
      <div className='flex flex-wrap gap-2 mb-6'>
        {(['all', 'pending', 'active', 'suspended'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setCompanyStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              companyStatusFilter === status
                ? status === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : status === 'active'
                    ? 'bg-green-500 text-white'
                    : status === 'suspended'
                      ? 'bg-red-500 text-white'
                      : 'bg-indigo-500 text-white'
                : isDarkTheme(theme)
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'pending' && <Clock className='w-4 h-4' />}
            {status === 'active' && <CheckCircle2 className='w-4 h-4' />}
            {status === 'suspended' && <XCircle className='w-4 h-4' />}
            {status === 'all' && <Building2 className='w-4 h-4' />}
            <span className='capitalize'>{status}</span>
            <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
              companyStatusFilter === status
                ? 'bg-white/20'
                : isDarkTheme(theme) ? 'bg-gray-600' : 'bg-gray-200'
            }`}>
              {status === 'all'
                ? companyStats.total
                : companyStats[status as keyof typeof companyStats]}
            </span>
          </button>
        ))}
      </div>

      {/* Companies Grid */}
      {pagedCompanies.length === 0 ? (
        <div className='text-center py-12'>
          <Building2 className='w-12 h-12 mx-auto mb-4 opacity-30' />
          <p className={isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}>
            No companies found
          </p>
        </div>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {pagedCompanies.map((company) => (
            <div
              key={company.id}
              className={`rounded-xl border p-5 ${
                isDarkTheme(theme)
                  ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              } transition-colors`}
            >
              {/* Header */}
              <div className='flex items-start justify-between mb-3'>
                <div className='flex-1 min-w-0'>
                  <h3 className={`font-semibold truncate ${
                    isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                  }`}>
                    {company.name}
                  </h3>
                  {company.dotNumber && (
                    <p className='text-xs text-gray-500'>DOT: {company.dotNumber}</p>
                  )}
                </div>
                <div className='flex flex-col items-end gap-1'>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    company.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : company.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {company.status}
                  </span>
                  {company.status === 'pending' && (() => {
                    const days = Math.floor((Date.now() - new Date(company.createdAt).getTime()) / 86_400_000)
                    return days >= 7 ? (
                      <span className='flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'>
                        <Clock className='w-2.5 h-2.5' />
                        {days}d waiting
                      </span>
                    ) : days > 0 ? (
                      <span className={`text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                        {days}d
                      </span>
                    ) : null
                  })()}
                </div>
              </div>

              {/* Owner Info */}
              <div className={`text-sm mb-3 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                <div className='flex items-center gap-2'>
                  <UserCircle className='w-4 h-4' />
                  <span className='truncate'>
                    {company.owner?.name || company.ownerEmail || 'No owner assigned'}
                  </span>
                </div>
                {/* Clickable team member count */}
                <button
                  onClick={() => {
                    if (expandedCompanyId === company.id) {
                      setExpandedCompanyId(null)
                      setCompanyMembers([])
                      setCompanyEmployerHub(null)
                    } else {
                      setExpandedCompanyId(company.id)
                      setInviteError(null)
                      fetchCompanyMembers(company.id)
                    }
                  }}
                  className={`flex items-center gap-2 mt-1 hover:underline ${
                    expandedCompanyId === company.id ? 'text-blue-500' : ''
                  }`}
                >
                  <Users className='w-4 h-4' />
                  <span>
                    {company.teamMemberCount} team member{company.teamMemberCount !== 1 ? 's' : ''}
                    {' '}
                    <span className='text-xs'>
                      {expandedCompanyId === company.id ? '▲' : '▼'}
                    </span>
                  </span>
                </button>
              </div>

              {/* Location */}
              {(company.city || company.state) && (
                <p className={`text-xs mb-3 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                  {[company.city, company.state].filter(Boolean).join(', ')}
                </p>
              )}

              {/* Actions */}
              <div className='flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700'>
                {company.status === 'pending' && (
                  <button
                    onClick={async () => {
                      await fetch(`/api/admin/companies/${company.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-wallet-address': sessionUserId || '',
                        },
                        body: JSON.stringify({ action: 'approve' }),
                      })
                      fetchData()
                    }}
                    className='flex-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600'
                  >
                    Approve
                  </button>
                )}
                {company.status === 'active' && (
                  <button
                    onClick={async () => {
                      const reason = prompt('Suspension reason (optional):')
                      await fetch(`/api/admin/companies/${company.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-wallet-address': sessionUserId || '',
                        },
                        body: JSON.stringify({ action: 'suspend', reason }),
                      })
                      fetchData()
                    }}
                    className='flex-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600'
                  >
                    Suspend
                  </button>
                )}
                {company.status === 'suspended' && (
                  <button
                    onClick={async () => {
                      await fetch(`/api/admin/companies/${company.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-wallet-address': sessionUserId || '',
                        },
                        body: JSON.stringify({ action: 'reactivate' }),
                      })
                      fetchData()
                    }}
                    className='flex-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600'
                  >
                    Reactivate
                  </button>
                )}
                <button
                  onClick={() => {
                    const notes = prompt('Admin notes:', company.adminNotes || '')
                    if (notes !== null) {
                      fetch(`/api/admin/companies/${company.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-wallet-address': sessionUserId || '',
                        },
                        body: JSON.stringify({ adminNotes: notes }),
                      }).then(() => fetchData())
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    isDarkTheme(theme)
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Notes
                </button>
                <button
                  onClick={async () => {
                    const confirmed = confirm(
                      `DELETE "${company.name}"?\n\nThis will permanently remove the company and all associated:\n- Team members\n- Job postings\n- Applications\n\nThis cannot be undone.`
                    )
                    if (confirmed) {
                      try {
                        const res = await fetch(`/api/admin/companies/${company.id}`, {
                          method: 'DELETE',
                          headers: { 'x-wallet-address': sessionUserId || '' },
                        })
                        const data = await res.json()
                        if (data.success) {
                          fetchData()
                        } else {
                          alert('Delete failed: ' + (data.error || 'Unknown error'))
                        }
                      } catch {
                        alert('Delete failed: Network error')
                      }
                    }
                  }}
                  className='px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30'
                  title='Delete company permanently'
                >
                  Delete
                </button>
              </div>

              {/* Admin Notes Preview */}
              {company.adminNotes && (
                <p className='mt-3 text-xs text-gray-500 italic line-clamp-2'>
                  {company.adminNotes}
                </p>
              )}

              {/* Expanded Team Members */}
              {expandedCompanyId === company.id && (
                <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
                  <h4 className={`text-sm font-medium mb-3 ${
                    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Team Members
                  </h4>
                  {loadingMembers ? (
                    <div className='flex items-center justify-center py-4'>
                      <Loader2 className='w-5 h-5 animate-spin text-gray-400' />
                    </div>
                  ) : companyMembers.length === 0 ? (
                    <p className='text-sm text-gray-500'>No team members</p>
                  ) : (
                    <div className='space-y-2'>
                      {companyMembers.map(member => (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            isDarkTheme(theme) ? 'bg-gray-700/50' : 'bg-gray-100'
                          }`}
                        >
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center gap-2'>
                              <span className={`text-sm font-medium truncate ${
                                isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                              }`}>
                                {member.name || member.email || 'Unknown'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                member.role === 'owner'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                  : member.role === 'admin'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                              }`}>
                                {member.role}
                              </span>
                              {member.isPending && (
                                <span className='px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'>
                                  pending
                                </span>
                              )}
                            </div>
                            {member.sessionUserId && (
                              <p className='text-xs text-gray-500 truncate'>
                                {member.sessionUserId.slice(0, 6)}...{member.sessionUserId.slice(-4)}
                              </p>
                            )}
                            {member.email && member.email !== member.name && (
                              <p className='text-xs text-gray-500 truncate'>{member.email}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveCompanyMember(company.id, member.id, member.name || member.email || '')}
                            disabled={removingMemberId === member.id}
                            className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-50'
                            title='Remove member'
                          >
                            {removingMemberId === member.id ? (
                              <Loader2 className='w-4 h-4 animate-spin' />
                            ) : (
                              <Trash2 className='w-4 h-4' />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className='mt-4 space-y-2'>
                    <p className={`text-xs font-medium ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                      Invite a teammate
                    </p>
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                      <input
                        type='email'
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder='metro@pacedrivers.com'
                        className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm ${
                          isDarkTheme(theme)
                            ? 'border-gray-600 bg-gray-900 text-white placeholder-gray-500'
                            : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400'
                        }`}
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className={`rounded-lg border px-2 py-2 text-sm ${
                          isDarkTheme(theme)
                            ? 'border-gray-600 bg-gray-900 text-white'
                            : 'border-gray-300 bg-white text-gray-900'
                        }`}
                      >
                        <option value='recruiter'>Team member</option>
                        <option value='admin'>Admin</option>
                        <option value='viewer'>Viewer</option>
                      </select>
                      <button
                        type='button'
                        onClick={() => handleInviteCompanyMember(company.id)}
                        disabled={inviting}
                        className='inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50'
                      >
                        {inviting ? <Loader2 className='h-4 w-4 animate-spin' /> : <UserPlus className='h-4 w-4' />}
                        Invite
                      </button>
                    </div>
                    {inviteError && (
                      <p className='text-xs text-red-500'>{inviteError}</p>
                    )}
                  </div>

                  {companyEmployerHub?.companyId === company.id && (
                    <div className='mt-6 border-t border-gray-200 pt-4 dark:border-gray-700'>
                      {/* Read-only: employer blocks are auto-provisioned on hub
                          load, so admin install/remove would be undone anyway. */}
                      <h4
                        className={`mb-2 text-sm font-medium ${
                          isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        Employer blocks
                      </h4>
                      {companyEmployerHub.blocks.length === 0 ? (
                        <p className='text-sm text-gray-500 dark:text-gray-400'>
                          None yet — blocks auto-provision the first time this company loads its hub.
                        </p>
                      ) : (
                        <ul className='mb-3 space-y-2'>
                          {companyEmployerHub.blocks.map((b) => {
                            const label = getEmployerBlockDefinition(b.block_type)?.label ?? b.block_type
                            return (
                              <li
                                key={b.id}
                                className={`rounded-lg p-2 text-sm ${
                                  isDarkTheme(theme) ? 'bg-gray-700/40 text-gray-200' : 'bg-gray-50 text-gray-900'
                                }`}
                              >
                                <p className='font-medium'>{label}</p>
                                <p className='text-xs text-gray-500'>Added {new Date(b.added_at).toLocaleString()}</p>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      {companyEmployerHub.recentAudit.length > 0 && (
                        <div>
                          <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500'>
                            Recent audit
                          </p>
                          <ul className='space-y-1 text-xs text-gray-600 dark:text-gray-400'>
                            {companyEmployerHub.recentAudit.slice(0, 5).map((a) => (
                              <li key={a.id}>
                                <span className='font-medium text-gray-800 dark:text-gray-200'>{a.blockType}</span>
                                {' · '}
                                {a.action}
                                {' · '}
                                {a.actorKind}
                                {a.actorEmail ? ` · ${a.actorEmail}` : ''}
                                {' · '}
                                {new Date(a.createdAt).toLocaleString()}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Company Button */}
      <div className='mt-6 pt-6 border-t border-gray-200 dark:border-gray-700'>
        <button
          onClick={onCreateCompany}
          className='flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-indigo-500 text-white hover:bg-indigo-600'
        >
          <UserPlus className='w-4 h-4' />
          Pre-Create Company
        </button>
        <p className={`mt-2 text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
          Pre-create a company for a client. When the designated owner logs in with their email, they will automatically be linked as the owner.
        </p>
      </div>
    </div>
  )
}
