'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React from 'react'
import { X, Download, Loader2, Edit, Shield, Trash2, Share2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DriverResumeDocument from '@/components/resume/DriverResumeDocument'
import type { DriverResumePacket } from '@/lib/driver-resume-packet'

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

export interface ResumePreviewMvrSummary {
  licenseState: string | null
  licenseStatus: string | null
  totalPoints: number
  violationCount: number
  verifiedByStorm?: boolean
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
  /** Override default "Edit" label (e.g. "Continue DOT") */
  editLabel?: string
  onVerify?: () => void
  onDelete?: () => void
  isVerifying?: boolean
  canVerify?: boolean
  // Allow overriding z-index when stacking above other modals
  zIndex?: number
  /** Live hub projection banner */
  subtitle?: string
  /** Issuer-backed MVR rollup (optional section) */
  mvrSummary?: ResumePreviewMvrSummary | null
  /** Premium DOT-packet layout — replaces form-dump body when set */
  packet?: DriverResumePacket | null
  /** Open career-card share (link + social caption) — packet toolbar */
  onShare?: () => void
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
  editLabel = 'Edit',
  onVerify,
  onDelete,
  isVerifying = false,
  canVerify = false,
  zIndex = 1000,
  subtitle,
  mvrSummary = null,
  packet = null,
  onShare,
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
            isDarkTheme(theme) ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <h3 className={`text-lg font-bold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
                {title}
              </h3>
              {subtitle ? (
                <p
                  className={`mt-0.5 text-xs ${
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors shrink-0 ${
                isDarkTheme(theme) ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Action buttons — packet mode: Download PDF / Share card */}
          {packet ? (
            <div className="flex flex-wrap items-center gap-2">
              {onDownloadProp ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isDownloading}
                  onClick={onDownloadProp}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {isDownloading ? 'Generating…' : 'Download PDF'}
                </Button>
              ) : null}
              {onShare ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onShare}
                  className="gap-1.5"
                  title="Copy your public career card link"
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                  Share card
                </Button>
              ) : null}
              <div className="flex-1 min-w-[0.5rem]" />
              {onEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="gap-1.5"
                >
                  <Edit className="h-4 w-4" aria-hidden />
                  {editLabel}
                </Button>
              ) : null}
            </div>
          ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {onDownloadProp ? (
              <button
                type="button"
                onClick={onDownloadProp}
                disabled={isDownloading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                  isDarkTheme(theme)
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

            {onEdit && (
              <button
                onClick={onEdit}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  isDarkTheme(theme)
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30'
                    : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                <Edit className="w-4 h-4" />
                {editLabel}
              </button>
            )}
            
            {canVerify && onVerify && (
              <button
                onClick={onVerify}
                disabled={isVerifying}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                  isDarkTheme(theme)
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
            
            {onDelete && (
              <button
                onClick={onDelete}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  isDarkTheme(theme)
                    ? 'text-red-400 border border-red-500/40 hover:bg-red-500/20'
                    : 'text-red-600 border border-red-200 hover:bg-red-50'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
          )}
        </div>

        {/* Scrollable content area */}
        <div
          className={`flex-1 overflow-y-auto ${
            packet
              ? // Always light “desk” under the paper page (Quiet Ink must not darken it)
                'resume-packet-mat bg-stone-100 p-4 sm:p-6'
              : 'p-6'
          }`}
        >
          {packet ? (
            <DriverResumeDocument packet={packet} />
          ) : (
          /* Resume preview content - matches ReviewStep styling */
          <div
            className={`rounded-lg border p-6 ${
              isDarkTheme(theme) ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            {/* Personal Information */}
            <section className="mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
              <h5
                className={`text-xl font-bold mb-2 ${
                  isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                }`}
              >
                {personalInfo.firstName || personalInfo.lastName
                  ? `${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`.trim()
                  : 'Your Name'}
              </h5>
              <div
                className={`text-sm space-y-1 ${
                  isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
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
                    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {personalInfo.professionalSummary}
                </p>
              )}
            </section>

            {/* Issuer-backed MVR rollup (live projection) */}
            {mvrSummary && (
              <section className="mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h5
                    className={`text-base font-semibold ${
                      isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Driving record (MVR)
                  </h5>
                  {mvrSummary.verifiedByStorm !== false && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        isDarkTheme(theme)
                          ? 'bg-teal-500/15 text-teal-300'
                          : 'bg-teal-50 text-teal-800'
                      }`}
                    >
                      <Shield className="w-3 h-3" aria-hidden />
                      Verified by Storm
                    </span>
                  )}
                </div>
                <div
                  className={`text-sm space-y-1 ${
                    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {mvrSummary.licenseState && (
                    <p>
                      <span className="font-medium">License state:</span> {mvrSummary.licenseState}
                    </p>
                  )}
                  {mvrSummary.licenseStatus && (
                    <p>
                      <span className="font-medium">License status:</span> {mvrSummary.licenseStatus}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Points:</span> {mvrSummary.totalPoints}
                    <span className="mx-2">·</span>
                    <span className="font-medium">Violations:</span> {mvrSummary.violationCount}
                  </p>
                </div>
              </section>
            )}

            {/* CDL Information */}
            {(cdlInfo.cdlClass || (cdlInfo.endorsements && cdlInfo.endorsements.length > 0) || cdlInfo.expirationDate) && (
              <section className="mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
                <h5
                  className={`text-base font-semibold mb-3 ${
                    isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  CDL & License Information
                </h5>
                <div
                  className={`text-sm space-y-1 ${
                    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
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
                    isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
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
                              isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {emp.position || 'Position'}
                          </p>
                          <p
                            className={`text-sm ${
                              isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            {emp.companyName || 'Company'} {emp.location && `• ${emp.location}`}
                          </p>
                        </div>
                        <p
                          className={`text-sm mt-1 sm:mt-0 ${
                            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {formatDate(emp.startDate)} – {emp.isCurrent ? 'Present' : formatDate(emp.endDate)}
                        </p>
                      </div>
                      {emp.responsibilities && emp.responsibilities.length > 0 && (
                        <ul
                          className={`mt-2 ml-4 list-disc text-sm space-y-1 ${
                            isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
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
                    isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Education & Training
                </h5>
                <div className="space-y-2">
                  {educations.map((edu, idx) => (
                    <div key={edu.id || idx}>
                      <p
                        className={`font-semibold ${
                          isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {edu.degree || 'Degree'} {edu.field && `in ${edu.field}`}
                      </p>
                      <p
                        className={`text-sm ${
                          isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        {edu.school} {edu.year && `• ${edu.year}`}
                      </p>
                      {edu.certifications && edu.certifications.length > 0 && (
                        <p
                          className={`text-sm mt-1 ${
                            isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
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
                    isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
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
                            isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                          }`}
                        >
                          {category.label}:
                        </p>
                        <p
                          className={`text-sm ${
                            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
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
                    isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Professional References
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {references.map((ref, idx) => (
                    <div key={ref.id || idx}>
                      <p
                        className={`font-semibold ${
                          isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {ref.name || 'Name'}
                      </p>
                      <p
                        className={`text-sm ${
                          isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        {ref.title} {ref.company && `at ${ref.company}`}
                      </p>
                      {ref.phone && (
                        <p
                          className={`text-xs ${
                            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {ref.phone}
                        </p>
                      )}
                      {ref.email && (
                        <p
                          className={`text-xs ${
                            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
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
                    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  <p>No resume data available.</p>
                </div>
              )}
          </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
