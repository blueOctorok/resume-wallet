'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AdminTabProps } from '@/components/admin/admin-types'
import { getTableCellClass, getTableHeaderClass } from '@/components/admin/admin-styles'
import { isDarkTheme } from '@/lib/theme-storage'
import { surveyAnswerRows, type DriverSurveyAnswers } from '@/lib/driver-survey'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface SurveyListItem {
  userId: string
  name: string | null
  email: string | null
  submittedAt: string
  updatedAt: string
  answers: DriverSurveyAnswers
}

export default function SurveysTab({
  theme,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
}: AdminTabProps) {
  const [surveys, setSurveys] = useState<SurveyListItem[]>([])
  const [open, setOpen] = useState<SurveyListItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * pageSize
      const response = await fetch(
        `/api/admin/surveys?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
      )
      const data = (await response.json()) as {
        success?: boolean
        error?: string
        surveys?: SurveyListItem[]
        total?: number
      }
      if (!response.ok || !data.success) {
        setError(data.error || 'Could not load surveys')
        return
      }
      setError(null)
      setSurveys(data.surveys ?? [])
      setTotalCount(data.total ?? 0)
    } catch (err) {
      console.error('[ADMIN SURVEYS]', err)
      setError('Could not load surveys')
    }
  }, [searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const header = getTableHeaderClass(theme)
  const cell = getTableCellClass(theme)

  return (
    <div>
      {error && <p className='mb-3 text-sm text-red-600 dark:text-red-400'>{error}</p>}
      {surveys.length === 0 && !error ? (
        <p className={`py-8 text-center text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
          No surveys yet.
        </p>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}>
              <tr>
                <th className={`${header} px-4 py-3 text-left`}>Driver</th>
                <th className={`${header} px-4 py-3 text-left`}>Email</th>
                <th className={`${header} px-4 py-3 text-left`}>Submitted</th>
                <th className={`${header} px-4 py-3 text-left`}>Updated</th>
                <th className={`${header} px-4 py-3`} />
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
              {surveys.map((survey) => (
                <tr key={survey.userId}>
                  <td className={cell}>{survey.name || '—'}</td>
                  <td className={cell}>{survey.email || '—'}</td>
                  <td className={cell}>{new Date(survey.submittedAt).toLocaleString()}</td>
                  <td className={cell}>{new Date(survey.updatedAt).toLocaleString()}</td>
                  <td className={cell}>
                    <Button variant='ghost' size='sm' onClick={() => setOpen(survey)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal onClose={() => setOpen(null)} maxWidth='max-w-2xl' zIndex={1100}>
          <ModalHeader
            title={open.name || 'Driver survey'}
            subtitle={open.email || undefined}
            onClose={() => setOpen(null)}
          />
          <dl className='space-y-4 p-4 sm:p-5'>
            {surveyAnswerRows(open.answers).map((row) => (
              <div key={row.question}>
                <dt className='text-xs font-medium text-gray-500 dark:text-gray-400'>{row.question}</dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100'>{row.answer}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  )
}
