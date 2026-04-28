'use client'

import React from 'react'
import { X, Download, Loader2, Edit, Shield, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'

// Types for structured resume data
interface PersonalInfo {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  professionalSummary?: string
}

interface CDLInfo {
  cdlNumber?: string
  cdlState?: string
  cdlClass?: string
  endorsements?: string[]
  expirationDate?: string
  restrictions?: string[]
}

interface Employment {
  id?: string
  companyName?: string
  position?: string
  location?: string
  startDate?: string
  endDate?: string
  isCurrent?: boolean
  responsibilities?: string[]
}

interface Education {
  id?: string
  school?: string
  degree?: string
  field?: string
  year?: string
  certifications?: string[]
}

interface Skill {
  id?: string
  name?: string
  category?: 'equipment' | 'route' | 'technology' | 'safety' | 'other'
}

interface Reference {
  id?: string
  name?: string
  title?: string
  company?: string
  phone?: string
  email?: string
  relationship?: string
}

interface StructuredResumeData {
  personalInfo?: PersonalInfo
  cdlInfo?: CDLInfo
  employments?: Employment[]
  educations?: Education[]
  skills?: Skill[]
  references?: Reference[]
}

interface ResumePreviewModalProps {
  title: string
  structuredData: StructuredResumeData | null
  onClose: () => void
  /** Omitted in product UI — PDF generation remains available server-side for admins/fallback. */
  onDownload?: () => void
  isDownloading?: boolean
  theme: string
  // Optional action handlers
  onEdit?: () => void
  onVerify?: () => void
  onDelete?: () => void
  isVerifying?: boolean
  canVerify?: boolean
  // Allow overriding z-index when stacking above other modals
  zIndex?: number
}

const SKILL_CATEGORIES: { value: 'equipment' | 'route' | 'technology' | 'safety' | 'other'; label: string }[] = [
  { value: 'equipment', label: 'Equipment' },
  { value: 'route', label: 'Route Knowledge' },
  { value: 'technology', label: 'Technology' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
]

export default function ResumePreviewModal({
  title,
  structuredData,
  onClose,
  onDownload: onDownloadProp,
  isDownloading = false,
  theme,
  onEdit,
  onVerify,
  onDelete,
  isVerifying = false,
  canVerify = false,
  zIndex = 1000,
}: ResumePreviewModalProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  }

  const personalInfo = structuredData?.personalInfo || {}
  const cdlInfo = structuredData?.cdlInfo || {}
  const employments = structuredData?.employments || []
  const educations = structuredData?.educations || []
  const skills = structuredData?.skills || []
  const references = structuredData?.references || []

  // Group skills by category
  const skillsByCategory = skills.reduce(
    (acc, skill) => {
      const category = skill.category || 'other'
      if (!acc[category]) acc[category] = []
      acc[category].push(skill)
      return acc
    },
    {} as Record<string, Skill[]>
  )

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl" zIndex={zIndex}>
      <div className="flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header with title and actions */}
        <div
          className={`sticky top-0 z-10 p-4 border-b ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h3>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Action buttons row */}
          <div className="flex items-center gap-2 flex-wrap">
            {onDownloadProp ? (
              <button
                type="button"
                onClick={onDownloadProp}
                disabled={isDownloading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                  theme === 'dark'
                    ? 'bg-teal-500 text-gray-900 hover:bg-teal-400'
                    : 'bg-teal-600 text-white hover:bg-teal-700'
                }`}
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloading ? 'Generating...' : 'Download PDF'}
              </button>
            ) : null}

            {/* Edit button */}
            {onEdit && (
              <button
                onClick={onEdit}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  theme === 'dark'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30'
                    : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
            
            {/* Verify button */}
            {canVerify && onVerify && (
              <button
                onClick={onVerify}
                disabled={isVerifying}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                  theme === 'dark'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30'
                    : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                }`}
              >
                {isVerifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {isVerifying ? 'Verifying...' : 'Verify'}
              </button>
            )}
            
            {/* Delete button */}
            {onDelete && (
              <button
                onClick={onDelete}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  theme === 'dark'
                    ? 'text-red-400 border border-red-500/40 hover:bg-red-500/20'
                    : 'text-red-600 border border-red-200 hover:bg-red-50'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Resume preview content - matches ReviewStep styling */}
          <div
            className={`rounded-lg border p-6 ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            {/* Personal Information */}
            <section className="mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
              <h5
                className={`text-xl font-bold mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                {personalInfo.firstName || personalInfo.lastName
                  ? `${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`.trim()
                  : 'Your Name'}
              </h5>
              <div
                className={`text-sm space-y-1 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {personalInfo.email && <p>{personalInfo.email}</p>}
                {personalInfo.phone && <p>{personalInfo.phone}</p>}
                {(personalInfo.city || personalInfo.state) && (
                  <p>
                    {[personalInfo.city, personalInfo.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              {personalInfo.professionalSummary && (
                <p
                  className={`mt-3 text-sm leading-relaxed ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {personalInfo.professionalSummary}
                </p>
              )}
            </section>

            {/* CDL Information */}
            {(cdlInfo.cdlClass || (cdlInfo.endorsements && cdlInfo.endorsements.length > 0) || cdlInfo.expirationDate) && (
              <section className="mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
                <h5
                  className={`text-base font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  CDL & License Information
                </h5>
                <div
                  className={`text-sm space-y-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {cdlInfo.cdlState && (
                    <p>
                      <span className="font-medium">Licensed State:</span> {cdlInfo.cdlState}
                    </p>
                  )}
                  {cdlInfo.cdlClass && (
                    <p>
                      <span className="font-medium">Class:</span> {cdlInfo.cdlClass}
                    </p>
                  )}
                  {cdlInfo.endorsements && cdlInfo.endorsements.length > 0 && (
                    <p>
                      <span className="font-medium">Endorsements:</span> {cdlInfo.endorsements.join(', ')}
                    </p>
                  )}
                  {cdlInfo.expirationDate && (
                    <p>
                      <span className="font-medium">Expiration:</span> {formatDate(cdlInfo.expirationDate)}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Employment History */}
            {employments.length > 0 && (
              <section className="mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
                <h5
                  className={`text-base font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Professional Experience
                </h5>
                <div className="space-y-4">
                  {employments.map((emp, idx) => (
                    <div key={emp.id || idx}>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-1">
                        <div>
                          <p
                            className={`font-semibold ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {emp.position || 'Position'}
                          </p>
                          <p
                            className={`text-sm ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            {emp.companyName || 'Company'} {emp.location && `• ${emp.location}`}
                          </p>
                        </div>
                        <p
                          className={`text-sm mt-1 sm:mt-0 ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {formatDate(emp.startDate)} – {emp.isCurrent ? 'Present' : formatDate(emp.endDate)}
                        </p>
                      </div>
                      {emp.responsibilities && emp.responsibilities.length > 0 && (
                        <ul
                          className={`mt-2 ml-4 list-disc text-sm space-y-1 ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}
                        >
                          {emp.responsibilities.map((resp, i) => (
                            <li key={i}>{resp}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {educations.length > 0 && (
              <section className="mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
                <h5
                  className={`text-base font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Education & Training
                </h5>
                <div className="space-y-2">
                  {educations.map((edu, idx) => (
                    <div key={edu.id || idx}>
                      <p
                        className={`font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {edu.degree || 'Degree'} {edu.field && `in ${edu.field}`}
                      </p>
                      <p
                        className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        {edu.school} {edu.year && `• ${edu.year}`}
                      </p>
                      {edu.certifications && edu.certifications.length > 0 && (
                        <p
                          className={`text-sm mt-1 ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}
                        >
                          Certifications: {edu.certifications.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <section className="mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
                <h5
                  className={`text-base font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Skills & Equipment
                </h5>
                <div className="space-y-2">
                  {SKILL_CATEGORIES.map((category) => {
                    const categorySkills = skillsByCategory[category.value] || []
                    if (categorySkills.length === 0) return null

                    return (
                      <div key={category.value}>
                        <p
                          className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}
                        >
                          {category.label}:
                        </p>
                        <p
                          className={`text-sm ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {categorySkills.map((s) => s.name).filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* References */}
            {references.length > 0 && (
              <section>
                <h5
                  className={`text-base font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Professional References
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {references.map((ref, idx) => (
                    <div key={ref.id || idx}>
                      <p
                        className={`font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {ref.name || 'Name'}
                      </p>
                      <p
                        className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        {ref.title} {ref.company && `at ${ref.company}`}
                      </p>
                      {ref.phone && (
                        <p
                          className={`text-xs ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {ref.phone}
                        </p>
                      )}
                      {ref.email && (
                        <p
                          className={`text-xs ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {ref.email}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {!personalInfo.firstName &&
              employments.length === 0 &&
              educations.length === 0 &&
              skills.length === 0 &&
              references.length === 0 && (
                <div
                  className={`text-center py-8 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  <p>No resume data available.</p>
                </div>
              )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
