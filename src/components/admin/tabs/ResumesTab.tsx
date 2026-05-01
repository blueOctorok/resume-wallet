'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Trash2 } from 'lucide-react'
import type { AdminTabProps, Resume } from '@/components/admin/admin-types'
import { getTableHeaderClass, getTableCellClass } from '@/components/admin/admin-styles'

const RESUME_TYPE_LABELS: Record<string, string> = {
  built: 'Resume (Built)',
  developer_built: 'Resume (Dev Built)',
  uploaded: 'Resume (Uploaded)',
}

const RESUME_TYPE_STYLES: Record<string, string> = {
  built: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  developer_built: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  uploaded: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
}

export default function ResumesTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [resumes, setResumes] = useState<Resume[]>([])

  const tableHeaderClass = getTableHeaderClass(theme)
  const tableCellClass = getTableCellClass(theme)

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    try {
      const offset = (currentPage - 1) * pageSize
      const res = await fetch(
        `/api/admin/resumes?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
        { headers: { 'x-wallet-address': walletAddress } }
      )
      const data = await res.json()
      if (data.success) {
        setResumes(data.resumes)
        setTotalCount(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch resumes:', err)
    }
  }, [walletAddress, searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className='overflow-x-auto'>
      <table className='w-full'>
        <thead
          className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}
        >
          <tr>
            <th className={`${tableHeaderClass} px-4 py-3`}>Owner</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Title</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Type</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Verification</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Created</th>
            <th className={`${tableHeaderClass} px-4 py-3`}>Actions</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
          {resumes.map((resume) => (
            <tr
              key={resume.id}
              className={
                isDarkTheme(theme)
                  ? 'hover:bg-gray-800/50'
                  : 'hover:bg-gray-50'
              }
            >
              <td className={tableCellClass}>
                <div>
                  <div>{resume.ownerName}</div>
                  <code className='text-xs opacity-75'>
                    {resume.walletAddress.slice(0, 8)}...
                  </code>
                </div>
              </td>
              <td className={tableCellClass}>
                {resume.title || resume.filename || 'Untitled'}
              </td>
              <td className={tableCellClass}>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    RESUME_TYPE_STYLES[resume.resume_type] ||
                    RESUME_TYPE_STYLES.uploaded
                  }`}
                >
                  {RESUME_TYPE_LABELS[resume.resume_type] ||
                    RESUME_TYPE_LABELS.uploaded}
                </span>
              </td>
              <td className={tableCellClass}>
                {resume.verification_status === 'VERIFIED' ? (
                  <CheckCircle className='w-4 h-4 text-green-500' />
                ) : (
                  <span className='text-xs opacity-75'>
                    {resume.verification_status}
                  </span>
                )}
              </td>
              <td className={tableCellClass}>
                {new Date(resume.created_at).toLocaleDateString()}
              </td>
              <td className={tableCellClass}>
                <button
                  onClick={() =>
                    onDelete({
                      type: 'resume',
                      id: resume.id,
                      name: resume.title || resume.filename || 'resume',
                    })
                  }
                  className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500'
                  title='Delete resume'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {resumes.length === 0 && (
        <div className='text-center py-12 text-gray-500'>
          No resumes found
        </div>
      )}
    </div>
  )
}
