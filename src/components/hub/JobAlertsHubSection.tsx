'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, LayoutGrid, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import BlockCard from '@/components/ui/BlockCard'
import VaultHorizontalVaultShell from '@/components/ui/VaultHorizontalVaultShell'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import {
  JOB_ALERTS_MAX_FREE,
  JOB_ALERTS_MAX_WITH_CREDITS,
  type JobAlertPreferenceRow,
} from '@/lib/job-alert-types'

function formatScan(iso: string | null): string {
  if (!iso) return 'Not scanned yet'
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const hrs = Math.floor(diff / 3_600_000)
  if (hrs < 1) return 'Scanned recently'
  if (hrs < 48) return `Last scan ${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `Last scan ${days}d ago`
}

export default function JobAlertsHubSection() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  const [preferences, setPreferences] = useState<JobAlertPreferenceRow[]>([])
  const [maxAlerts, setMaxAlerts] = useState(JOB_ALERTS_MAX_FREE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<JobAlertPreferenceRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [minMatch, setMinMatch] = useState(72)

  const [deleteTarget, setDeleteTarget] = useState<JobAlertPreferenceRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!walletAddress) {
      setPreferences([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/job-alerts', {
        headers: { 'x-wallet-address': walletAddress },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not load alerts')
        return
      }
      setPreferences(data.preferences ?? [])
      setMaxAlerts(typeof data.maxAlerts === 'number' ? data.maxAlerts : JOB_ALERTS_MAX_FREE)
    } catch {
      setError('Could not load alerts')
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setLabel('')
    setKeywords('')
    setLocation('')
    setSalaryMin('')
    setMinMatch(72)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (p: JobAlertPreferenceRow) => {
    setEditing(p)
    setLabel(p.label ?? '')
    setKeywords(p.keywords)
    setLocation(p.location ?? '')
    setSalaryMin(p.salary_min != null ? String(p.salary_min) : '')
    setMinMatch(p.min_match_score ?? 72)
    setFormError(null)
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!walletAddress) return
    const kw = keywords.trim()
    if (!kw) {
      setFormError('Add keywords (job title, skills, or role).')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const salary_min =
        salaryMin.trim() === '' ? null : Math.max(0, Math.round(Number(salaryMin)))
      if (salaryMin.trim() !== '' && !Number.isFinite(salary_min)) {
        setFormError('Salary minimum must be a number.')
        setSaving(false)
        return
      }

      const payload = {
        label: label.trim() || null,
        keywords: kw,
        location: location.trim() || null,
        salary_min,
        min_match_score: minMatch,
      }

      if (editing) {
        const res = await fetch(`/api/job-alerts/${editing.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': walletAddress,
          },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          setFormError(typeof data.error === 'string' ? data.error : 'Update failed')
          return
        }
      } else {
        const res = await fetch('/api/job-alerts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': walletAddress,
          },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          setFormError(typeof data.error === 'string' ? data.error : 'Could not create alert')
          return
        }
      }
      setFormOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (p: JobAlertPreferenceRow) => {
    if (!walletAddress) return
    try {
      const res = await fetch(`/api/job-alerts/${p.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ is_active: !p.is_active }),
      })
      if (res.ok) await load()
    } catch {
      /* ignore */
    }
  }

  const confirmDelete = async () => {
    if (!walletAddress || !deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/job-alerts/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'x-wallet-address': walletAddress },
      })
      if (res.ok) {
        setDeleteTarget(null)
        await load()
      }
    } finally {
      setDeleting(false)
    }
  }

  if (!walletAddress) return null

  const activeCount = preferences.filter((p) => p.is_active).length
  const atCap = preferences.length >= maxAlerts

  return (
    <>
      <VaultHorizontalVaultShell isDark={isDark} layout='panel' accent='sky' contentClassName='p-4 sm:p-5 lg:p-6'>
        <BlockCard
          variant='embed'
          icon={Bell}
          title='AI job alerts'
          description='Browse Storm + external listings; star roles on Hunt Desk. Daily scans, Stormi-scored matches, in-app notifications — each job pings once.'
          headerActions={
            <div className='flex flex-wrap gap-2 justify-end max-w-[min(100%,22rem)] sm:max-w-none'>
              <Button variant='secondary' size='sm' className='shrink-0' onClick={() => setCurrentPage('jobs')}>
                <Search className='w-3.5 h-3.5 shrink-0' />
                Browse jobs
              </Button>
              <Button variant='secondary' size='sm' className='shrink-0' onClick={() => setCurrentPage('hunt-desk')}>
                <LayoutGrid className='w-3.5 h-3.5 shrink-0' />
                Hunt Desk
              </Button>
              <Button
                variant='primary'
                size='sm'
                className={cn(
                  'shrink-0',
                  'bg-sky-800 hover:bg-sky-700 text-white',
                  'dark:bg-sky-300 dark:hover:bg-sky-200 dark:text-gray-900',
                )}
                disabled={atCap}
                onClick={openCreate}
              >
                Add alert
              </Button>
            </div>
          }
        >
        <p className={cn('text-xs mb-3', isDark ? 'text-gray-500' : 'text-slate-500')}>
          {activeCount} active · {preferences.length}/{maxAlerts} saved
          {maxAlerts === JOB_ALERTS_MAX_WITH_CREDITS && (
            <span className='text-teal-600 dark:text-teal-400'> (credits)</span>
          )}
          {maxAlerts === JOB_ALERTS_MAX_FREE && preferences.length >= JOB_ALERTS_MAX_FREE && (
            <span> · Add Stormi credits for up to {JOB_ALERTS_MAX_WITH_CREDITS}</span>
          )}
        </p>

        {error && (
          <p className='text-xs text-red-600 dark:text-red-400 mb-3'>{error}</p>
        )}

        {loading ? (
          <div className='flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
            <Loader2 className='w-4 h-4 animate-spin' />
            Loading alerts…
          </div>
        ) : preferences.length === 0 ? (
          <div className='text-center py-6 rounded-xl border border-dashed border-slate-300/80 dark:border-gray-600'>
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
              No alerts yet — add keywords and we&apos;ll watch for new postings.
            </p>
          </div>
        ) : (
          <ul className='space-y-2'>
            {preferences.map((p) => (
              <li
                key={p.id}
                className={cn(
                  'rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
                  isDark ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-gray-50/80',
                  !p.is_active && 'opacity-60',
                )}
              >
                <div className='min-w-0'>
                  <p className={cn('text-sm font-semibold truncate', isDark ? 'text-white' : 'text-slate-900')}>
                    {p.label?.trim() || p.keywords}
                  </p>
                  {p.label?.trim() && (
                    <p className={cn('text-xs truncate', isDark ? 'text-gray-400' : 'text-slate-600')}>
                      {p.keywords}
                      {p.location ? ` · ${p.location}` : ''}
                    </p>
                  )}
                  {!p.label?.trim() && p.location && (
                    <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-slate-600')}>{p.location}</p>
                  )}
                  <p className={cn('text-[11px] mt-1', isDark ? 'text-gray-500' : 'text-slate-500')}>
                    Match ≥{p.min_match_score}%
                    {p.salary_min != null ? ` · Min salary ~$${p.salary_min.toLocaleString()}` : ''}
                    {' · '}
                    {formatScan(p.last_scan_at)}
                  </p>
                </div>
                <div className='flex flex-wrap items-center gap-2 shrink-0'>
                  <Button variant='secondary' size='sm' onClick={() => toggleActive(p)}>
                    {p.is_active ? 'Pause' : 'Resume'}
                  </Button>
                  <Button variant='ghost' size='sm' onClick={() => openEdit(p)} aria-label='Edit alert'>
                    <Pencil className='w-4 h-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-red-600 dark:text-red-400'
                    onClick={() => setDeleteTarget(p)}
                    aria-label='Delete alert'
                  >
                    <Trash2 className='w-4 h-4' />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        </BlockCard>
      </VaultHorizontalVaultShell>

      {formOpen && (
        <Modal onClose={() => !saving && setFormOpen(false)} maxWidth='max-w-md'>
          <ModalHeader
            title={editing ? 'Edit job alert' : 'New job alert'}
            subtitle="Stormi compares new listings to your profile; you only get notified when the score clears your threshold."
            onClose={() => !saving && setFormOpen(false)}
          />
          <div className='p-4 space-y-3'>
            {formError && (
              <p className='text-sm text-red-600 dark:text-red-400'>{formError}</p>
            )}
            <div>
              <label
                className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-slate-700')}
              >
                Label (optional)
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-sm',
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                    : 'bg-white border-gray-300 text-slate-900',
                )}
                placeholder='e.g. Remote React roles'
                maxLength={120}
              />
            </div>
            <div>
              <label
                className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-slate-700')}
              >
                Keywords
              </label>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-sm',
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                    : 'bg-white border-gray-300 text-slate-900',
                )}
                placeholder='e.g. truck driver class A OR senior frontend engineer'
                maxLength={280}
              />
            </div>
            <div>
              <label
                className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-slate-700')}
              >
                Location (optional)
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-sm',
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                    : 'bg-white border-gray-300 text-slate-900',
                )}
                placeholder='e.g. Ohio or remote'
                maxLength={120}
              />
            </div>
            <div>
              <label
                className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-slate-700')}
              >
                Minimum salary (optional, USD)
              </label>
              <input
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                inputMode='numeric'
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-sm',
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                    : 'bg-white border-gray-300 text-slate-900',
                )}
                placeholder='e.g. 65000'
              />
            </div>
            <div>
              <label
                className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-slate-700')}
              >
                Min match score: {minMatch}%
              </label>
              <input
                type='range'
                min={50}
                max={95}
                value={minMatch}
                onChange={(e) => setMinMatch(Number(e.target.value))}
                className='w-full accent-sky-600'
              />
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <Button variant='secondary' onClick={() => !saving && setFormOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant='primary' onClick={() => void submitForm()} isLoading={saving}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => !deleting && setDeleteTarget(null)} maxWidth='max-w-sm'>
          <ModalHeader
            title='Remove alert?'
            subtitle='You can add it again anytime. Past notifications are unchanged.'
            onClose={() => !deleting && setDeleteTarget(null)}
          />
          <div className='p-4 flex justify-end gap-2'>
            <Button variant='secondary' onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant='danger' onClick={() => void confirmDelete()} isLoading={deleting}>
              Remove
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
