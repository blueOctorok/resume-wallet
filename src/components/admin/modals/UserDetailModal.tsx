'use client'

import React from 'react'
import {
  X,
  Loader2,
  Trash2,
  FileText,
  CheckCircle,
  Code,
  FolderGit2,
  Github,
  ExternalLink,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import type {
  UserDetail,
  DeleteTarget,
} from '@/components/admin/admin-types'

interface UserDetailModalProps {
  theme: 'light' | 'dark'
  user: UserDetail | null
  loading: boolean
  onClose: () => void
  onDelete: (target: DeleteTarget) => void
}

export default function UserDetailModal({
  theme,
  user,
  loading,
  onClose,
  onDelete,
}: UserDetailModalProps) {
  if (!user && !loading) return null

  const handleDeleteAndClose = (target: DeleteTarget) => {
    onClose()
    onDelete(target)
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-4xl">
      {loading ? (
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='w-8 h-8 animate-spin text-indigo-400' />
        </div>
      ) : (
        user && (
          <>
            {/* Header — custom because it includes admin badge + wallet + email */}
            <div className='flex items-center justify-between p-6 pb-0 mb-6'>
              <div>
                <h3
                  className={`text-xl font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {user.user.displayName || 'Unnamed User'}
                  {user.user.isAdmin && (
                    <span className='ml-2 px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-semibold'>
                      Admin
                    </span>
                  )}
                </h3>
                <p
                  className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  <code>{user.user.wallet_address}</code>
                </p>
                {user.user.displayEmail && (
                  <p
                    className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {user.user.displayEmail}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg ${
                  theme === 'dark'
                    ? 'hover:bg-gray-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='px-6 pb-6'>
              {/* Driver Profile Section */}
              {user.profile && (
                <div className='mb-6'>
                  <div className='flex items-center justify-between mb-3'>
                    <h4
                      className={`font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Driver Profile
                    </h4>
                    {!user.user.isAdmin && (
                      <button
                        onClick={() =>
                          handleDeleteAndClose({
                            type: 'profile',
                            id: user.profile!.id,
                            name: `${user.user.displayName}'s profile`,
                          })
                        }
                        className='text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                      >
                        Delete Profile
                      </button>
                    )}
                  </div>
                  <div
                    className={`p-4 rounded-lg ${
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}
                  >
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                      <div>
                        <span className='opacity-60'>CDL:</span>{' '}
                        {user.profile.cdl_number || '-'}
                      </div>
                      <div>
                        <span className='opacity-60'>State:</span>{' '}
                        {user.profile.cdl_state || '-'}
                      </div>
                      <div>
                        <span className='opacity-60'>Phone:</span>{' '}
                        {user.profile.phone || '-'}
                      </div>
                      <div>
                        <span className='opacity-60'>Updated:</span>{' '}
                        {user.profile.updated_at
                          ? new Date(
                              user.profile.updated_at
                            ).toLocaleDateString()
                          : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DOT Applications */}
              <div className='mb-6'>
                <h4
                  className={`font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  DOT Applications ({user.dotApps.length})
                </h4>
                {user.dotApps.length === 0 ? (
                  <p
                    className={`text-sm ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    No DOT applications
                  </p>
                ) : (
                  <div className='space-y-2'>
                    {user.dotApps.map((app) => (
                      <div
                        key={app.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          theme === 'dark'
                            ? 'bg-gray-700/50'
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className='flex items-center gap-3'>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              app.is_complete
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}
                          >
                            {app.is_complete
                              ? 'Complete'
                              : `Step ${app.current_step}`}
                          </span>
                          <span className='text-sm'>
                            {new Date(app.created_at).toLocaleDateString()}
                          </span>
                          <span
                            className={`text-xs ${
                              theme === 'dark'
                                ? 'text-gray-500'
                                : 'text-gray-400'
                            }`}
                          >
                            {app.verification_status}
                          </span>
                        </div>
                        {!user.user.isAdmin && (
                          <button
                            onClick={() =>
                              handleDeleteAndClose({
                                type: 'dotApp',
                                id: app.id,
                                name: `DOT application from ${new Date(app.created_at).toLocaleDateString()}`,
                              })
                            }
                            className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumes */}
              <div className='mb-6'>
                <h4
                  className={`font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Resumes ({user.resumes.length})
                </h4>
                {user.resumes.length === 0 ? (
                  <p
                    className={`text-sm ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    No resumes
                  </p>
                ) : (
                  <div className='space-y-2'>
                    {user.resumes.map((resume) => (
                      <div
                        key={resume.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          theme === 'dark'
                            ? 'bg-gray-700/50'
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className='flex items-center gap-3'>
                          <FileText className='w-4 h-4 opacity-60' />
                          <span className='text-sm'>
                            {resume.title || resume.filename || 'Untitled'}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              resume.resume_type === 'built'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                : resume.resume_type === 'developer_built'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            {resume.resume_type === 'built'
                              ? 'Driver Resume'
                              : resume.resume_type === 'developer_built'
                                ? 'Developer Resume'
                                : 'Uploaded'}
                          </span>
                          {resume.verification_status === 'VERIFIED' && (
                            <CheckCircle className='w-4 h-4 text-green-500' />
                          )}
                        </div>
                        {!user.user.isAdmin && (
                          <button
                            onClick={() =>
                              handleDeleteAndClose({
                                type: 'resume',
                                id: resume.id,
                                name:
                                  resume.title ||
                                  resume.filename ||
                                  'resume',
                              })
                            }
                            className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Developer Profile */}
              {user.devProfile && (
                <div className='mb-6'>
                  <div className='flex items-center justify-between mb-3'>
                    <h4
                      className={`font-semibold flex items-center gap-2 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      <Code className='w-4 h-4 text-teal-500' />
                      Developer Profile
                    </h4>
                    {!user.user.isAdmin && (
                      <button
                        onClick={() =>
                          handleDeleteAndClose({
                            type: 'devProfile',
                            id: user.devProfile!.id,
                            name: `${user.user.displayName}'s developer profile`,
                          })
                        }
                        className='text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                      >
                        Delete Dev Profile
                      </button>
                    )}
                  </div>
                  <div
                    className={`p-4 rounded-lg ${
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}
                  >
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                      <div>
                        <span className='opacity-60'>Name:</span>{' '}
                        {[user.devProfile.first_name, user.devProfile.last_name].filter(Boolean).join(' ') || user.devProfile.display_name || '-'}
                      </div>
                      <div>
                        <span className='opacity-60'>GitHub:</span>{' '}
                        {user.devProfile.github_username ? (
                          <a
                            href={`https://github.com/${user.devProfile.github_username}`}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-brand-mint hover:underline'
                          >
                            @{user.devProfile.github_username}
                          </a>
                        ) : (
                          '-'
                        )}
                      </div>
                      <div className='col-span-2'>
                        <span className='opacity-60'>Headline:</span>{' '}
                        {user.devProfile.headline || '-'}
                      </div>
                    </div>
                    {user.devProfile.skills &&
                      user.devProfile.skills.length > 0 && (
                        <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-600'>
                          <span className='text-xs opacity-60'>Skills:</span>
                          <div className='flex flex-wrap gap-1 mt-1'>
                            {user.devProfile.skills
                              .slice(0, 10)
                              .map((skill, i) => (
                                <span
                                  key={i}
                                  className='px-2 py-0.5 rounded text-xs bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
                                >
                                  {typeof skill === 'string'
                                    ? skill
                                    : skill.name}
                                </span>
                              ))}
                            {user.devProfile.skills.length > 10 && (
                              <span className='text-xs opacity-60'>
                                +{user.devProfile.skills.length - 10} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Developer Projects */}
              {user.devProjects && user.devProjects.length > 0 && (
                <div className='mb-6'>
                  <h4
                    className={`font-semibold mb-3 flex items-center gap-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    <FolderGit2 className='w-4 h-4 text-cyan-500' />
                    Developer Projects ({user.devProjects.length})
                  </h4>
                  <div className='space-y-2'>
                    {user.devProjects.map((project) => (
                      <div
                        key={project.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          theme === 'dark'
                            ? 'bg-gray-700/50'
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className='flex-1'>
                          <div className='flex items-center gap-2'>
                            <span className='text-sm font-medium'>
                              {project.title}
                            </span>
                            {project.is_featured && (
                              <span className='px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'>
                                Featured
                              </span>
                            )}
                            {project.is_public ? (
                              <span className='px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>
                                Public
                              </span>
                            ) : (
                              <span className='px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'>
                                Private
                              </span>
                            )}
                          </div>
                          {project.tech_stack &&
                            project.tech_stack.length > 0 && (
                              <div className='flex flex-wrap gap-1 mt-1'>
                                {project.tech_stack
                                  .slice(0, 5)
                                  .map((tech, i) => (
                                    <span
                                      key={i}
                                      className='px-1 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                    >
                                      {tech}
                                    </span>
                                  ))}
                              </div>
                            )}
                        </div>
                        <div className='flex items-center gap-2'>
                          {project.live_url && (
                            <a
                              href={project.live_url}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-brand-mint hover:underline'
                            >
                              <ExternalLink className='w-4 h-4' />
                            </a>
                          )}
                          {project.repo_url && (
                            <a
                              href={project.repo_url}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='opacity-60 hover:opacity-100'
                            >
                              <Github className='w-4 h-4' />
                            </a>
                          )}
                          {!user.user.isAdmin && (
                            <button
                              onClick={() =>
                                handleDeleteAndClose({
                                  type: 'devProject',
                                  id: project.id,
                                  name: project.title,
                                })
                              }
                              className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                            >
                              <Trash2 className='w-4 h-4' />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete All User Data Button */}
              {!user.user.isAdmin && (
                <div className='pt-4 border-t border-gray-200 dark:border-gray-700'>
                  <button
                    onClick={() =>
                      handleDeleteAndClose({
                        type: 'user',
                        id: user.user.id,
                        name:
                          user.user.displayName ||
                          user.user.wallet_address,
                      })
                    }
                    className='w-full px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700'
                  >
                    Delete User and All Data
                  </button>
                </div>
              )}
            </div>
            </>
          )
        )}
    </Modal>
  )
}
