'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  User,
  Briefcase,
  Clock,
  ChevronRight,
  Car,
  Code,
  GripVertical,
  Loader2,
} from 'lucide-react'

// Application status configuration
const PIPELINE_COLUMNS = [
  { status: 'submitted', label: 'New', color: 'blue' },
  { status: 'under_review', label: 'Reviewing', color: 'yellow' },
  { status: 'interview', label: 'Interviewing', color: 'purple' },
  { status: 'offer', label: 'Offer Sent', color: 'teal' },
  { status: 'hired', label: 'Hired', color: 'green' },
  { status: 'rejected', label: 'Rejected', color: 'gray' },
] as const

type PipelineStatus = typeof PIPELINE_COLUMNS[number]['status']

interface KanbanApplicant {
  applicationId: string
  status: string
  appliedAt: string
  applicantUserId: string
  applicantName: string
  applicantRole: string | null
  jobTitle: string
  jobPostingId: string
}

interface ApplicantKanbanProps {
  applicants: KanbanApplicant[]
  walletAddress: string
  onStatusChange: (applicationId: string, newStatus: string) => Promise<void>
  onSelectApplicant: (applicant: KanbanApplicant) => void
  isUpdating?: string | null
}

export default function ApplicantKanban({
  applicants,
  walletAddress,
  onStatusChange,
  onSelectApplicant,
  isUpdating,
}: ApplicantKanbanProps) {
  const { theme } = useTheme()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // Group applicants by status
  const columns = PIPELINE_COLUMNS.map(col => ({
    ...col,
    applicants: applicants.filter(a => a.status === col.status),
  }))

  const handleDragStart = (e: React.DragEvent, applicationId: string) => {
    setDraggedId(applicationId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', applicationId)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const applicationId = e.dataTransfer.getData('text/plain')
    const applicant = applicants.find(a => a.applicationId === applicationId)
    
    if (applicant && applicant.status !== newStatus) {
      await onStatusChange(applicationId, newStatus)
    }
    
    setDraggedId(null)
    setDragOverColumn(null)
  }

  const getDaysInStage = (appliedAt: string) => {
    const days = Math.floor(
      (Date.now() - new Date(appliedAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (days === 0) return 'Today'
    if (days === 1) return '1 day'
    return `${days} days`
  }

  const getColumnColors = (color: string) => {
    const colors: Record<string, { header: string; bg: string; border: string; badge: string }> = {
      blue: {
        header: theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
        bg: theme === 'dark' ? 'bg-blue-500/5' : 'bg-blue-50/50',
        border: theme === 'dark' ? 'border-blue-500/30' : 'border-blue-200',
        badge: 'bg-blue-500 text-white',
      },
      yellow: {
        header: theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700',
        bg: theme === 'dark' ? 'bg-yellow-500/5' : 'bg-yellow-50/50',
        border: theme === 'dark' ? 'border-yellow-500/30' : 'border-yellow-200',
        badge: 'bg-yellow-500 text-white',
      },
      purple: {
        header: theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700',
        bg: theme === 'dark' ? 'bg-purple-500/5' : 'bg-purple-50/50',
        border: theme === 'dark' ? 'border-purple-500/30' : 'border-purple-200',
        badge: 'bg-purple-500 text-white',
      },
      teal: {
        header: theme === 'dark' ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700',
        bg: theme === 'dark' ? 'bg-teal-500/5' : 'bg-teal-50/50',
        border: theme === 'dark' ? 'border-teal-500/30' : 'border-teal-200',
        badge: 'bg-teal-500 text-white',
      },
      green: {
        header: theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
        bg: theme === 'dark' ? 'bg-green-500/5' : 'bg-green-50/50',
        border: theme === 'dark' ? 'border-green-500/30' : 'border-green-200',
        badge: 'bg-green-500 text-white',
      },
      gray: {
        header: theme === 'dark' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700',
        bg: theme === 'dark' ? 'bg-gray-500/5' : 'bg-gray-50/50',
        border: theme === 'dark' ? 'border-gray-500/30' : 'border-gray-200',
        badge: 'bg-gray-500 text-white',
      },
    }
    return colors[color] || colors.gray
  }

  const cardClass = theme === 'dark'
    ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
    : 'bg-white border-gray-200 hover:border-gray-300'

  return (
    <div className='flex gap-4 overflow-x-auto pb-4'>
      {columns.map(column => {
        const colors = getColumnColors(column.color)
        const isDropTarget = dragOverColumn === column.status && draggedId !== null
        
        return (
          <div
            key={column.status}
            className='flex-shrink-0 w-72'
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            {/* Column Header */}
            <div className={`rounded-t-xl px-4 py-3 ${colors.header}`}>
              <div className='flex items-center justify-between'>
                <span className='font-semibold'>{column.label}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors.badge}`}>
                  {column.applicants.length}
                </span>
              </div>
            </div>

            {/* Column Body */}
            <div
              className={`min-h-[400px] rounded-b-xl border-2 p-3 space-y-3 transition-colors ${
                isDropTarget
                  ? `${colors.border} ${colors.bg}`
                  : theme === 'dark'
                    ? 'border-gray-700 bg-gray-900/30'
                    : 'border-gray-200 bg-gray-50/50'
              }`}
            >
              {column.applicants.length === 0 ? (
                <div className={`text-center py-8 text-sm ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {isDropTarget ? 'Drop here' : 'No applicants'}
                </div>
              ) : (
                column.applicants.map(applicant => {
                  const isDragging = draggedId === applicant.applicationId
                  const isBeingUpdated = isUpdating === applicant.applicationId

                  return (
                    <div
                      key={applicant.applicationId}
                      draggable={!isBeingUpdated}
                      onDragStart={(e) => handleDragStart(e, applicant.applicationId)}
                      onDragEnd={handleDragEnd}
                      onClick={() => !isBeingUpdated && onSelectApplicant(applicant)}
                      className={`rounded-xl border p-3 cursor-pointer transition-all ${cardClass} ${
                        isDragging ? 'opacity-50 scale-95' : ''
                      } ${isBeingUpdated ? 'opacity-70' : ''}`}
                    >
                      <div className='flex items-start gap-3'>
                        {/* Drag Handle */}
                        <div className={`mt-1 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`}>
                          {isBeingUpdated ? (
                            <Loader2 className='w-4 h-4 animate-spin text-teal-500' />
                          ) : (
                            <GripVertical className='w-4 h-4' />
                          )}
                        </div>

                        {/* Content */}
                        <div className='flex-1 min-w-0'>
                          {/* Name & Role */}
                          <div className='flex items-center gap-2 mb-1'>
                            <span className={`font-medium truncate ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                              {applicant.applicantName}
                            </span>
                            {applicant.applicantRole === 'driver' ? (
                              <span className='flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-teal-500/20 text-teal-500'>
                                <Car className='w-3 h-3' />
                              </span>
                            ) : applicant.applicantRole === 'developer' ? (
                              <span className='flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-purple-500/20 text-purple-500'>
                                <Code className='w-3 h-3' />
                              </span>
                            ) : null}
                          </div>

                          {/* Job Title */}
                          <div className='flex items-center gap-1.5 mb-2'>
                            <Briefcase className={`w-3 h-3 ${
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            }`} />
                            <span className={`text-xs truncate ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {applicant.jobTitle}
                            </span>
                          </div>

                          {/* Time in Stage */}
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-1'>
                              <Clock className={`w-3 h-3 ${
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              }`} />
                              <span className={`text-xs ${
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                {getDaysInStage(applicant.appliedAt)}
                              </span>
                            </div>
                            <ChevronRight className={`w-4 h-4 ${
                              theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                            }`} />
                          </div>
                        </div>
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

// Export the status configuration for use elsewhere
export { PIPELINE_COLUMNS }
export type { KanbanApplicant, PipelineStatus }
