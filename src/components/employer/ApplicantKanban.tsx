'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Clock,
  Loader2,
  FileText,
  ArrowRight,
  CheckCircle,
  Send,
  User,
  Trash2,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'

const PIPELINE_COLUMNS = [
  { status: 'submitted', label: 'New', color: 'blue' },
  { status: 'contacted', label: 'Contacted', color: 'teal' },
  { status: 'archived', label: 'Archived', color: 'gray' },
] as const

const TALENT_POOL_TITLE = '— Talent Pool —'

type PipelineStatus = typeof PIPELINE_COLUMNS[number]['status']

export interface KanbanApplicant {
  applicationId: string
  status: string
  appliedAt: string
  applicantUserId: string
  applicantName: string
  applicantRole: string | null
  avatarUrl?: string | null
  jobTitle: string
  jobPostingId: string
  hasResume: boolean
  resumeVerified: boolean
}

interface ApplicantKanbanProps {
  applicants: KanbanApplicant[]
  walletAddress: string
  onStatusChange: (applicationId: string, newStatus: string) => Promise<void>
  onSelectApplicant: (applicant: KanbanApplicant) => void
  /** Remove candidate from pipeline (deletes application); confirm in parent */
  onRemoveFromPipeline?: (applicant: KanbanApplicant) => void
  isUpdating?: string | null
  isRemoving?: string | null
}

type RequestState = 'loading' | 'sent' | 'pending'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function getDaysInStage(appliedAt: string) {
  const days = Math.floor(
    (Date.now() - new Date(appliedAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  const label = days === 0 ? 'Today' : days === 1 ? '1d' : `${days}d`
  const urgency =
    days === 0 ? 'fresh'
    : days <= 3  ? 'normal'
    : days <= 7  ? 'aging'
    : 'stale'
  return { label, urgency }
}

const URGENCY_CLASS: Record<string, string> = {
  fresh:  'text-green-500',
  normal: 'text-gray-400',
  aging:  'text-yellow-500',
  stale:  'text-red-400',
}

const COL_STYLES: Record<string, {
  bar: string; badge: string; drop: string; advance: string
}> = {
  blue:   { bar: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-400',   drop: 'bg-blue-500/8 border-blue-500/40',   advance: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' },
  yellow: { bar: 'bg-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400', drop: 'bg-yellow-500/8 border-yellow-500/40', advance: 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25' },
  purple: { bar: 'bg-purple-500', badge: 'bg-purple-500/20 text-purple-400', drop: 'bg-purple-500/8 border-purple-500/40', advance: 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25' },
  teal:   { bar: 'bg-teal-500',   badge: 'bg-teal-500/20 text-teal-400',   drop: 'bg-teal-500/8 border-teal-500/40',   advance: 'bg-teal-500/15 text-teal-400 hover:bg-teal-500/25' },
  green:  { bar: 'bg-green-500',  badge: 'bg-green-500/20 text-green-400',  drop: 'bg-green-500/8 border-green-500/40',  advance: 'bg-green-500/15 text-green-400 hover:bg-green-500/25' },
  gray:   { bar: 'bg-gray-500',   badge: 'bg-gray-500/20 text-gray-400',   drop: 'bg-gray-500/8 border-gray-500/40',   advance: 'bg-gray-500/15 text-gray-400 hover:bg-gray-500/25' },
}

export default function ApplicantKanban({
  applicants,
  walletAddress,
  onStatusChange,
  onSelectApplicant,
  onRemoveFromPipeline,
  isUpdating,
  isRemoving,
}: ApplicantKanbanProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const [requestStates, setRequestStates] = useState<Map<string, RequestState>>(new Map())

  const setRequestState = (key: string, state: RequestState | null) => {
    setRequestStates(prev => {
      const next = new Map(prev)
      if (state === null) next.delete(key)
      else next.set(key, state)
      return next
    })
  }

  const sendQuickRequest = useCallback(async (
    e: React.MouseEvent,
    applicantUserId: string,
    requestType: string,
    documentType: string,
  ) => {
    e.stopPropagation()
    const key = `${applicantUserId}-${documentType}`
    setRequestState(key, 'loading')

    try {
      const res = await fetch(`/api/employer/talent/${applicantUserId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestType, documentType, message: 'Requested via Storm Hiring Pipeline' }),
      })

      if (res.status === 409) {
        setRequestState(key, 'pending')
      } else if (res.ok) {
        setRequestState(key, 'sent')
        setTimeout(() => setRequestState(key, null), 3000)
      } else {
        setRequestState(key, null)
      }
    } catch {
      setRequestState(key, null)
    }
  }, [walletAddress])

  const columns = PIPELINE_COLUMNS.map(col => ({
    ...col,
    applicants: applicants.filter(a => a.status === col.status),
  }))

  const handleAdvance = async (e: React.MouseEvent, applicant: KanbanApplicant) => {
    e.stopPropagation()
    const colIndex = PIPELINE_COLUMNS.findIndex(c => c.status === applicant.status)
    const next = PIPELINE_COLUMNS[colIndex + 1]
    if (next) {
      await onStatusChange(applicant.applicationId, next.status)
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
  const handleDragEnd = () => { setDraggedId(null); setDragOverColumn(null) }
  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }
  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    const a = applicants.find(x => x.applicationId === id)
    if (a && a.status !== newStatus) await onStatusChange(id, newStatus)
    setDraggedId(null)
    setDragOverColumn(null)
  }

  const cardBase = isDark
    ? 'bg-gray-800 border-gray-700 hover:border-gray-500'
    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'

  return (
    <div className='flex gap-3 overflow-x-auto pb-4 -mx-1 px-1'>
      {columns.map(column => {
        const styles = COL_STYLES[column.color]
        const isDropTarget = dragOverColumn === column.status && draggedId !== null

        const avgDays = column.applicants.length > 0
          ? Math.round(
              column.applicants.reduce((sum, a) =>
                sum + Math.floor((Date.now() - new Date(a.appliedAt).getTime()) / 86_400_000), 0
              ) / column.applicants.length
            )
          : null

        return (
          <div
            key={column.status}
            className='flex-shrink-0 w-64'
            onDragOver={e => handleDragOver(e, column.status)}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={e => handleDrop(e, column.status)}
          >
            {/* Column header */}
            <div className={`rounded-xl mb-2 overflow-hidden border ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className={`h-1.5 ${styles.bar}`} />
              <div className={`px-3 py-2.5 ${isDark ? 'bg-gray-800/80' : 'bg-white'}`}>
                <div className='flex items-center justify-between'>
                  <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {column.label}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${styles.badge}`}>
                    {column.applicants.length}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {avgDays !== null ? `avg ${avgDays}d in stage` : 'drag or click to move'}
                </p>
              </div>
            </div>

            {/* Column body / drop zone */}
            <div className={`min-h-[500px] rounded-xl border-2 p-2 space-y-2 transition-all duration-150 ${
              isDropTarget
                ? `${styles.drop} border-dashed`
                : isDark
                  ? 'border-gray-800 bg-gray-900/20'
                  : 'border-gray-100 bg-gray-50/60'
            }`}>
              {column.applicants.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-40 text-center gap-2 ${
                  isDark ? 'text-gray-600' : 'text-gray-300'
                }`}>
                  {isDropTarget ? (
                    <p className={`text-sm font-semibold ${styles.bar.replace('bg-', 'text-')}`}>
                      Drop here
                    </p>
                  ) : (
                    <>
                      <User className='w-7 h-7 opacity-40' />
                      <p className='text-xs'>No candidates</p>
                    </>
                  )}
                </div>
              ) : (
                column.applicants.map(applicant => {
                  const isDragging    = draggedId === applicant.applicationId
                  const isUpdatingNow =
                    isUpdating === applicant.applicationId || isRemoving === applicant.applicationId
                  const { label: timeLabel, urgency } = getDaysInStage(applicant.appliedAt)
                  const initials   = getInitials(applicant.applicantName)
                  const colIndex   = PIPELINE_COLUMNS.findIndex(c => c.status === column.status)
                  const canAdvance =
                    colIndex >= 0 && colIndex < PIPELINE_COLUMNS.length - 1

                  return (
                    <div
                      key={applicant.applicationId}
                      draggable={!isUpdatingNow}
                      onDragStart={e => handleDragStart(e, applicant.applicationId)}
                      onDragEnd={handleDragEnd}
                      onClick={() => !isUpdatingNow && onSelectApplicant(applicant)}
                      className={`rounded-xl border p-3 cursor-pointer transition-all group ${cardBase} ${
                        isDragging    ? 'opacity-40 scale-95 rotate-1 shadow-xl' : ''
                      } ${isUpdatingNow ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      {/* Name row */}
                      <div className='flex items-center gap-2 mb-2'>
                        {isUpdatingNow
                          ? <div className='w-8 h-8 rounded-lg flex items-center justify-center bg-gray-200 dark:bg-gray-700 flex-shrink-0'>
                              <Loader2 className='w-3.5 h-3.5 animate-spin text-gray-400' />
                            </div>
                          : <Avatar
                              name={applicant.applicantName}
                              avatarUrl={applicant.avatarUrl}
                              size='sm'
                              color='teal'
                            />
                        }
                        <div className='flex-1 min-w-0'>
                          <p className={`text-sm font-semibold truncate leading-tight ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {applicant.applicantName}
                          </p>
                        </div>
                        {onRemoveFromPipeline && (
                          <button
                            type='button'
                            title='Remove from pipeline'
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemoveFromPipeline(applicant)
                            }}
                            disabled={isUpdatingNow}
                            className={`shrink-0 p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity ${
                              isDark
                                ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                        )}
                      </div>

                      {/* Job title or Talent Pool badge */}
                      {applicant.jobTitle === TALENT_POOL_TITLE ? (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md mb-2.5 ${
                          isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                        }`}>
                          Talent Pool
                        </span>
                      ) : (
                        <p className={`text-xs truncate mb-2.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {applicant.jobTitle}
                        </p>
                      )}

                      {/* Universal credential chips: resume only */}
                      <div className='flex flex-wrap items-center gap-1 mb-2.5'>
                        {applicant.hasResume ? (
                          <span className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md ${
                            applicant.resumeVerified
                              ? 'bg-green-500/15 text-green-500'
                              : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {applicant.resumeVerified
                              ? <CheckCircle className='w-2.5 h-2.5' />
                              : <FileText className='w-2.5 h-2.5' />
                            }
                            {applicant.resumeVerified ? 'Verified' : 'Resume'}
                          </span>
                        ) : (
                          <QuickRequestChip
                            label='Resume'
                            icon={<FileText className='w-2.5 h-2.5' />}
                            state={requestStates.get(`${applicant.applicantUserId}-resume`) ?? null}
                            isDark={isDark}
                            onClick={e => sendQuickRequest(e, applicant.applicantUserId, 'document_upload', 'resume')}
                          />
                        )}
                      </div>

                      {/* Footer: time in stage + advance button */}
                      <div className={`flex items-center justify-between pt-1.5 border-t ${
                        isDark ? 'border-gray-700/60' : 'border-gray-100'
                      }`}>
                        <span className={`flex items-center gap-1 text-xs ${URGENCY_CLASS[urgency]}`}>
                          <Clock className='w-2.5 h-2.5' />
                          {timeLabel}
                        </span>
                        {canAdvance && (
                          <button
                            onClick={e => handleAdvance(e, applicant)}
                            disabled={isUpdatingNow}
                            title={`Move to ${PIPELINE_COLUMNS[colIndex + 1]?.label}`}
                            className={`flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${styles.advance}`}
                          >
                            {PIPELINE_COLUMNS[colIndex + 1]?.label}
                            <ArrowRight className='w-2.5 h-2.5' />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── QuickRequestChip ───────────────────────────────────────────────────────

function QuickRequestChip({
  label,
  icon,
  state,
  isDark,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  state: RequestState | null
  isDark: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  if (state === 'loading') {
    return (
      <span className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md ${
        isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
      }`}>
        <Loader2 className='w-2.5 h-2.5 animate-spin' />
        {label}
      </span>
    )
  }

  if (state === 'sent') {
    return (
      <span className='flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-500'>
        <CheckCircle className='w-2.5 h-2.5' />
        Sent
      </span>
    )
  }

  if (state === 'pending') {
    return (
      <span className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md ${
        isDark ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-50 text-yellow-600'
      }`}>
        <Clock className='w-2.5 h-2.5' />
        Pending
      </span>
    )
  }

  return (
    <button
      onClick={onClick}
      title={`Request ${label}`}
      className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md transition-colors ${
        isDark
          ? 'bg-gray-700 text-gray-400 hover:bg-teal-500/20 hover:text-teal-400'
          : 'bg-gray-100 text-gray-500 hover:bg-teal-50 hover:text-teal-600'
      }`}
    >
      <Send className='w-2.5 h-2.5' />
      {label}
    </button>
  )
}

export { PIPELINE_COLUMNS }
export type { PipelineStatus }
