'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type ComplianceReviewProps = {
  form1Data?: unknown
  form2Data?: unknown
  form3Data?: unknown
  applicationSummary?: string
}

export default function ComplianceReview({ form1Data, form2Data, form3Data, applicationSummary }: ComplianceReviewProps) {
  const [taskId, setTaskId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'pending' | 'running' | 'completed' | 'failed'>('idle')
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string>('')
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const canStart = useMemo(() => status === 'idle' || status === 'failed' || status === 'completed', [status])

  const clearPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const pollStatus = useCallback((id: string) => {
    clearPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/ai/compliance-review/status?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          setError(`Status error: ${text || resp.statusText}`)
          setStatus('failed')
          clearPolling()
          return
        }
        const data = await resp.json()
        const s = (data.status as typeof status) || 'pending'
        setStatus(s)
        if (s === 'completed') {
          const out = data.output_text || data.output || ''
          setOutput(typeof out === 'string' ? out : JSON.stringify(out, null, 2))
          clearPolling()
        } else if (s === 'failed') {
          setError(data.error || 'Task failed')
          clearPolling()
        }
      } catch (e: any) {
        setError(e?.message ?? 'Unexpected polling error')
        setStatus('failed')
        clearPolling()
      }
    }, 3000)
  }, [])

  const startReview = useCallback(async () => {
    if (!canStart) return
    setError('')
    setOutput('')
    setStatus('pending')
    try {
      const resp = await fetch('/api/ai/compliance-review/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationSummary, form1Data, form2Data, form3Data }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        setError(text || resp.statusText)
        setStatus('failed')
        return
      }
      const data = await resp.json()
      if (!data.id) {
        setError('No background task id returned')
        setStatus('failed')
        return
      }
      setTaskId(data.id)
      setStatus('running')
      pollStatus(data.id)
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error starting review')
      setStatus('failed')
    }
  }, [applicationSummary, form1Data, form2Data, form3Data, canStart, pollStatus])

  useEffect(() => {
    return () => clearPolling()
  }, [])

  return (
    <div className='w-full rounded-lg border p-4 space-y-3'>
      <div className='flex items-center justify-between'>
        <h3 className='text-base font-semibold'>AI Compliance Review</h3>
        <button
          type='button'
          onClick={startReview}
          disabled={!canStart}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            canStart ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {status === 'running' || status === 'pending' ? 'Running…' : 'Run Compliance Review'}
        </button>
      </div>

      {taskId && (
        <p className='text-xs text-gray-500'>Task ID: {taskId}</p>
      )}

      {error && (
        <div className='rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      {output && (
        <div className='rounded-md border bg-white p-3 text-sm whitespace-pre-wrap'>
          {output}
        </div>
      )}
    </div>
  )
}


