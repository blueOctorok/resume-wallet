'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Briefcase, Trash2 } from 'lucide-react'
import type { AdminTabProps, AdminJob } from '@/components/admin/admin-types'

export default function JobsTab({
  theme,
  walletAddress,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
  onDelete,
}: AdminTabProps) {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [jobsFilter, setJobsFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const fetchData = useCallback(async () => {
    if (!walletAddress) return
    try {
      const res = await fetch('/api/admin/jobs', {
        headers: { 'x-wallet-address': walletAddress },
      })
      const data = await res.json()
      if (data.jobs) {
        let filteredJobs = data.jobs
        if (jobsFilter === 'active') {
          filteredJobs = data.jobs.filter((j: AdminJob) => j.isActive)
        } else if (jobsFilter === 'inactive') {
          filteredJobs = data.jobs.filter((j: AdminJob) => !j.isActive)
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          filteredJobs = filteredJobs.filter((j: AdminJob) =>
            j.title.toLowerCase().includes(q) ||
            j.companyName.toLowerCase().includes(q)
          )
        }
        setJobs(filteredJobs)
        setTotalCount(filteredJobs.length)
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    }
  }, [walletAddress, searchQuery, jobsFilter, setTotalCount])

  useEffect(() => {
    fetchData()
  }, [fetchData, currentPage])

  return (
    <div className='p-6'>
      {/* Filter Pills */}
      <div className='flex flex-wrap gap-2 mb-6'>
        {(['all', 'active', 'inactive'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setJobsFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              jobsFilter === status
                ? 'bg-indigo-500 text-white'
                : theme === 'dark'
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'all' && ` (${jobs.length})`}
            {status === 'active' && ` (${jobs.filter(j => j.isActive).length})`}
            {status === 'inactive' && ` (${jobs.filter(j => !j.isActive).length})`}
          </button>
        ))}
      </div>

      {/* Jobs Grid */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {jobs.map((job) => (
          <div
            key={job.id}
            className={`p-4 rounded-xl border ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Header */}
            <div className='flex items-start justify-between mb-3'>
              <div className='flex-1 min-w-0'>
                <h3 className={`font-semibold truncate ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {job.title}
                </h3>
                <p className={`text-sm truncate ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {job.companyName}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                job.isActive
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {job.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Details */}
            <div className='space-y-1 text-sm mb-3'>
              {job.locationCity && job.locationState && (
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  📍 {job.locationCity}, {job.locationState}
                </p>
              )}
              {job.targetRole && (
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  👤 {job.targetRole}
                </p>
              )}
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                📝 {job.applicationCount} application{job.applicationCount !== 1 ? 's' : ''}
              </p>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                Created {new Date(job.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Actions */}
            <div className='flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700'>
              <button
                onClick={async () => {
                  await fetch(`/api/admin/jobs/${job.id}`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-wallet-address': walletAddress || '',
                    },
                    body: JSON.stringify({ isActive: !job.isActive }),
                  })
                  fetchData()
                }}
                className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  job.isActive
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {job.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Delete "${job.title}" permanently? This cannot be undone.`)) {
                    const res = await fetch(`/api/admin/jobs/${job.id}`, {
                      method: 'DELETE',
                      headers: { 'x-wallet-address': walletAddress || '' },
                    })
                    if (res.ok) {
                      fetchData()
                    } else {
                      const data = await res.json()
                      alert(data.error || 'Failed to delete job. It may have applications linked to it.')
                    }
                  }
                }}
                className='px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600'
              >
                <Trash2 className='w-4 h-4' />
              </button>
            </div>
          </div>
        ))}
      </div>

      {jobs.length === 0 && (
        <div className='text-center py-12'>
          <Briefcase className={`w-12 h-12 mx-auto mb-4 ${
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          }`} />
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            No job postings found
          </p>
        </div>
      )}
    </div>
  )
}
