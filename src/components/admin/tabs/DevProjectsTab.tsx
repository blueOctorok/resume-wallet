'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Trash2, Github, ExternalLink } from 'lucide-react'
import type { AdminTabProps, DevProject } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

export default function DevProjectsTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [devProjects, setDevProjects] = useState<DevProject[]>([])

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/dev-projects?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } }
      )
      const data = await res.json()
      if (data.success) {
        setDevProjects(data.projects)
        setTotalCount(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch dev projects:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className='overflow-x-auto'>
      <table className='w-full'>
        <thead
          className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}
        >
          <tr>
            <th className={`${tableHeaderClass} px-4 py-3`}>Project</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Tech Stack</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Links</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Featured</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Public</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
          {devProjects.map((project) => (
            <tr
              key={project.id}
              className={
                theme === 'dark'
                  ? 'hover:bg-gray-800/50'
                  : 'hover:bg-gray-50'
              }
            >
              <td className={tableCellClass}>
                <div className='font-medium'>{project.title}</div>
                <div className='text-xs opacity-60'>
                  {project.ownerName}
                </div>
              </td>
              <td className={tableCellClass}>
                <div className='flex flex-wrap gap-1'>
                  {project.tech_stack
                    ?.slice(0, 3)
                    .map((tech, i) => (
                      <span
                        key={i}
                        className='px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      >
                        {tech}
                      </span>
                    ))}
                  {(project.techCount || 0) > 3 && (
                    <span className='text-xs opacity-60'>
                      +{project.techCount - 3} more
                    </span>
                  )}
                </div>
              </td>
              <td className={tableCellClass}>
                <div className='flex gap-2'>
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
                  {!project.live_url && !project.repo_url && (
                    <span className='text-xs opacity-50'>-</span>
                  )}
                </div>
              </td>
              <td className={tableCellClass}>
                {project.is_featured ? (
                  <span className='px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'>
                    Featured
                  </span>
                ) : (
                  <span className='text-xs opacity-50'>-</span>
                )}
              </td>
              <td className={tableCellClass}>
                {project.is_public ? (
                  <span className='px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>
                    Public
                  </span>
                ) : (
                  <span className='px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'>
                    Private
                  </span>
                )}
              </td>
              <td className={tableCellClass}>
                {new Date(project.created_at).toLocaleDateString()}
              </td>
              <td className={tableCellClass}>
                <button
                  onClick={() =>
                    onDelete({
                      type: 'devProject',
                      id: project.id,
                      name: project.title,
                    })
                  }
                  className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                  title='Delete project'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {devProjects.length === 0 && (
        <div className='text-center py-12 text-gray-500'>
          No developer projects found
        </div>
      )}
    </div>
  )
}
