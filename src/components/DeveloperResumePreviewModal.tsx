'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  X,
  Download,
  Edit,
  Shield,
  Trash2,
  Loader2,
  User,
  Code,
  Briefcase,
  Folder,
  GraduationCap,
  FileCheck,
  Github,
  Globe,
  ExternalLink,
  CheckCircle,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import type { DeveloperResumeData } from './DeveloperResumeBuilder'
import { generateDeveloperResumePDF } from '@/lib/developer-resume-pdf'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'

interface DeveloperResumePreviewModalProps {
  resume: {
    id: string
    title: string
    structured_data: DeveloperResumeData
    verification_status: string
    blockchain_tx_hash?: string
    ipfs_hash?: string
    created_at: string
  }
  onClose: () => void
  onEdit: () => void
  onVerify: () => void
  onDelete: () => void
  userAddress: string
  /** My Files / career card: preview only — row has Edit, Verify, Delete */
  viewOnly?: boolean
}

export default function DeveloperResumePreviewModal({
  resume,
  onClose,
  onEdit,
  onVerify,
  onDelete,
  userAddress,
  viewOnly = false,
}: DeveloperResumePreviewModalProps) {
  const { theme } = useTheme()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const data = resume.structured_data
  const isVerified = resume.verification_status === 'VERIFIED'

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const pdfBlob = await generateDeveloperResumePDF(data)
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.personalInfo.firstName}_${data.personalInfo.lastName}_Resume.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download error:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleVerify = async () => {
    setIsVerifying(true)
    try {
      const res = await fetch(`/api/resumes/${resume.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({ resumeType: 'developer' }),
      })

      if (res.ok) {
        onVerify()
        void syncDriverHubFromApi(userAddress)
      }
    } catch (error) {
      console.error('Verify error:', error)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/resumes/${resume.id}`, {
        method: 'DELETE',
        headers: { 'x-wallet-address': userAddress },
      })

      if (res.ok) {
        onDelete()
        void syncDriverHubFromApi(userAddress)
      }
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const sectionClass = `mb-6 p-4 rounded-xl ${
    theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
  }`
  const sectionTitleClass = `text-lg font-semibold mb-3 flex items-center gap-2 ${
    theme === 'dark' ? 'text-white' : 'text-gray-900'
  }`

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${
            theme === 'dark'
              ? 'bg-gray-900 border-gray-800'
              : 'bg-white border-gray-200'
          }`}
        >
          <div>
            <h2
              className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              {resume.title}
            </h2>
            {isVerified && (
              <span className='inline-flex items-center gap-1 mt-1 text-xs text-green-400'>
                <CheckCircle className='w-3 h-3' />
                Verified on Blockchain
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${
              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            }`}
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Actions — full toolbar unless viewOnly (My Files row owns Edit / Verify / Delete) */}
        <div
          className={`flex flex-wrap gap-2 p-4 border-b ${
            theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
          }`}
        >
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className='flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-500 disabled:opacity-50'
          >
            {isDownloading ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <Download className='w-4 h-4' />
            )}
            Download PDF
          </button>

          {!viewOnly && (
            <>
              <button
                onClick={onEdit}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-white hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                }`}
              >
                <Edit className='w-4 h-4' />
                Edit
              </button>

              {!isVerified && (
                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className='flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 disabled:opacity-50'
                >
                  {isVerifying ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Shield className='w-4 h-4' />
                  )}
                  Verify on Blockchain
                </button>
              )}

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className='flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg font-medium hover:bg-red-600/30 ml-auto'
              >
                <Trash2 className='w-4 h-4' />
                Delete
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div
          className='overflow-y-auto p-4'
          style={{ maxHeight: 'calc(90vh - 180px)' }}
        >
          {/* Personal Info */}
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>
              <User className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Personal Information
            </h3>
            <div className='space-y-2'>
              <p
                className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                {data.personalInfo.firstName} {data.personalInfo.lastName}
              </p>
              {data.personalInfo.headline && (
                <p className='text-teal-600 dark:text-teal-400'>{data.personalInfo.headline}</p>
              )}
              <div
                className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                {data.personalInfo.email && <p>{data.personalInfo.email}</p>}
                {data.personalInfo.phone && <p>{data.personalInfo.phone}</p>}
                {data.personalInfo.location && (
                  <p>{data.personalInfo.location}</p>
                )}
              </div>
              {data.personalInfo.summary && (
                <p
                  className={`mt-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {data.personalInfo.summary}
                </p>
              )}
              {/* Links */}
              <div className='flex flex-wrap gap-3 mt-3'>
                {data.personalInfo.githubUrl && (
                  <a
                    href={data.personalInfo.githubUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                  >
                    <Github className='w-4 h-4' /> GitHub
                  </a>
                )}
                {data.personalInfo.linkedinUrl && (
                  <a
                    href={data.personalInfo.linkedinUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                  >
                    <ExternalLink className='w-4 h-4' /> LinkedIn
                  </a>
                )}
                {data.personalInfo.portfolioUrl && (
                  <a
                    href={data.personalInfo.portfolioUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                  >
                    <Folder className='w-4 h-4' /> Portfolio
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Skills */}
          {data.skills.length > 0 && (
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <Code className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Technical Skills
              </h3>
              <div className='flex flex-wrap gap-2'>
                {data.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {skill.name}
                    <span className='ml-1 text-xs opacity-60'>
                      ({skill.proficiency})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {data.experience.length > 0 && (
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <Briefcase className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Work
                Experience
              </h3>
              <div className='space-y-4'>
                {data.experience.map((exp) => (
                  <div
                    key={exp.id}
                    className='border-l-2 border-teal-500/30 pl-4'
                  >
                    <p
                      className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                    >
                      {exp.title}
                    </p>
                    <p
                      className={
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }
                    >
                      {exp.company} {exp.location && `• ${exp.location}`}
                    </p>
                    <p
                      className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                    >
                      {exp.startDate} -{' '}
                      {exp.isCurrent ? 'Present' : exp.endDate}
                    </p>
                    {exp.description && (
                      <p
                        className={`mt-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                      >
                        {exp.description}
                      </p>
                    )}
                    {exp.achievements.filter(Boolean).length > 0 && (
                      <ul
                        className={`mt-2 text-sm list-disc list-inside ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                      >
                        {exp.achievements.filter(Boolean).map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {data.projects.length > 0 && (
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <Folder className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Projects
              </h3>
              <div className='space-y-4'>
                {data.projects.map((project) => (
                  <div
                    key={project.id}
                    className='border-l-2 border-teal-500/30 pl-4'
                  >
                    <p
                      className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                    >
                      {project.name}
                      {project.role && (
                        <span className='font-normal text-sm ml-2'>
                          ({project.role})
                        </span>
                      )}
                    </p>
                    {project.description && (
                      <p
                        className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                      >
                        {project.description}
                      </p>
                    )}
                    <div className='flex gap-3 mt-2'>
                      {project.liveUrl && (
                        <a
                          href={project.liveUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                        >
                          <Globe className='w-3 h-3' /> Live
                        </a>
                      )}
                      {project.repoUrl && (
                        <a
                          href={project.repoUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1'
                        >
                          <Github className='w-3 h-3' /> Repo
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {data.education.length > 0 && (
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <GraduationCap className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Education
              </h3>
              <div className='space-y-3'>
                {data.education.map((edu) => (
                  <div key={edu.id}>
                    <p
                      className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                    >
                      {edu.degree} {edu.field && `in ${edu.field}`}
                    </p>
                    <p
                      className={
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }
                    >
                      {edu.institution}
                    </p>
                    <p
                      className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                    >
                      {edu.startDate} - {edu.endDate}{' '}
                      {edu.gpa && `• GPA: ${edu.gpa}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {data.certifications.length > 0 && (
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <FileCheck className='w-5 h-5 text-teal-600 dark:text-teal-400' /> Certifications
              </h3>
              <div className='space-y-2'>
                {data.certifications.map((cert) => (
                  <div
                    key={cert.id}
                    className='flex items-center justify-between'
                  >
                    <div>
                      <p
                        className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                      >
                        {cert.name}
                      </p>
                      <p
                        className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                      >
                        {cert.issuer} {cert.date && `• ${cert.date}`}
                      </p>
                    </div>
                    {cert.url && (
                      <a
                        href={cert.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-sm text-teal-600 dark:text-teal-400 hover:underline'
                      >
                        Verify
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation — higher zIndex to stack above outer modal */}
      {showDeleteConfirm && (
        <Modal onClose={() => setShowDeleteConfirm(false)} maxWidth="max-w-sm" zIndex={1100}>
          <div className='p-6'>
            <h3
              className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Delete Resume?
            </h3>
            <p
              className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            >
              This action cannot be undone. The resume will be permanently
              deleted.
            </p>
            <div className='flex gap-3'>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                  theme === 'dark'
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className='flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-500 disabled:opacity-50'
              >
                {isDeleting ? (
                  <Loader2 className='w-4 h-4 animate-spin mx-auto' />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
