'use client'

import { useState } from 'react'
import {
  Briefcase,
  Plus,
  MapPin,
  DollarSign,
  Users,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Car,
  Code,
  Warehouse,
  CheckCircle,
  XCircle,
  ChevronDown,
} from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface JobPosting {
  id: string
  title: string
  description: string | null
  targetRole: string | null
  locationCity: string | null
  locationState: string | null
  salaryMin: number | null
  salaryMax: number | null
  jobType: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  experienceRequired: number | null
  routeType: string | null
  remoteAllowed: boolean | null
  totalApplications: number
  newApplications: number
  viewedApplications: number
}

interface JobPostingsSectionProps {
  jobs: JobPosting[]
  sessionUserId: string
  theme: string
  onPostJob: () => void
  onRefresh: () => void
  isCollapsed?: boolean
  onToggle?: () => void
}

// ----------------------------------------------------------------
// Constants (mirrors JobPostingForm values)
// ----------------------------------------------------------------

const TARGET_ROLES = [
  { value: 'driver', label: 'Driver', Icon: Car },
  { value: 'developer', label: 'Developer', Icon: Code },
  { value: 'warehouse', label: 'Warehouse', Icon: Warehouse },
  { value: 'other', label: 'Other', Icon: Users },
]

const JOB_TYPES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
]

const ROUTE_TYPES = [
  { value: 'long-haul', label: 'Long Haul (OTR)' },
  { value: 'regional', label: 'Regional' },
  { value: 'local', label: 'Local' },
  { value: 'dedicated', label: 'Dedicated' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

// ----------------------------------------------------------------
// Edit form state shape
// ----------------------------------------------------------------

interface EditForm {
  title: string
  description: string
  targetRole: string
  locationCity: string
  locationState: string
  salaryMin: string
  salaryMax: string
  jobType: string
  routeType: string
  experienceRequired: string
  remoteAllowed: boolean
  isActive: boolean
}

function jobToEditForm(job: JobPosting): EditForm {
  return {
    title: job.title,
    description: job.description ?? '',
    targetRole: job.targetRole ?? 'driver',
    locationCity: job.locationCity ?? '',
    locationState: job.locationState ?? '',
    salaryMin: job.salaryMin != null ? String(job.salaryMin) : '',
    salaryMax: job.salaryMax != null ? String(job.salaryMax) : '',
    jobType: job.jobType ?? 'full-time',
    routeType: job.routeType ?? '',
    experienceRequired: job.experienceRequired != null ? String(job.experienceRequired) : '',
    remoteAllowed: job.remoteAllowed ?? false,
    isActive: job.isActive,
  }
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function roleLabel(role: string | null) {
  return TARGET_ROLES.find(r => r.value === role)?.label ?? (role ?? 'Other')
}

function roleColor(role: string | null, dark: boolean) {
  switch (role) {
    case 'driver':
      return dark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
    case 'developer':
      return dark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
    case 'warehouse':
      return dark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
    default:
      return dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'
  }
}

function formatSalary(min: number | null, max: number | null) {
  if (!min && !max) return null
  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

// ----------------------------------------------------------------
// Column: groups jobs by status
// ----------------------------------------------------------------

function KanbanColumn({
  title,
  accent,
  jobs,
  theme,
  onEdit,
  onToggleActive,
  onDelete,
  togglingId,
  deletingId,
}: {
  title: string
  accent: string
  jobs: JobPosting[]
  theme: string
  onEdit: (job: JobPosting) => void
  onToggleActive: (job: JobPosting) => void
  onDelete: (job: JobPosting) => void
  togglingId: string | null
  deletingId: string | null
}) {
  const dark = false
  return (
    <div className="flex-1 min-w-0">
      {/* Column header */}
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${accent}`} />
        <span className={`text-sm font-semibold uppercase tracking-wide ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
          {title}
        </span>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
          dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
        }`}>
          {jobs.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className={`rounded-xl border-2 border-dashed p-6 text-center ${
            dark ? 'border-gray-700 text-gray-600' : 'border-gray-200 text-gray-400'
          }`}>
            <Briefcase className="w-6 h-6 mx-auto mb-1 opacity-40" />
            <p className="text-xs">No jobs here</p>
          </div>
        ) : (
          jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              theme={theme}
              onEdit={() => onEdit(job)}
              onToggleActive={() => onToggleActive(job)}
              onDelete={() => onDelete(job)}
              isToggling={togglingId === job.id}
              isDeleting={deletingId === job.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Individual job card
// ----------------------------------------------------------------

function JobCard({
  job,
  theme,
  onEdit,
  onToggleActive,
  onDelete,
  isToggling,
  isDeleting,
}: {
  job: JobPosting
  theme: string
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
  isToggling: boolean
  isDeleting: boolean
}) {
  const dark = false
  const salary = formatSalary(job.salaryMin, job.salaryMax)

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      dark
        ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
        : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
    }`}>
      {/* Title + role badge */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className={`font-semibold leading-tight truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
            {job.title}
          </p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${roleColor(job.targetRole, dark)}`}>
          {roleLabel(job.targetRole)}
        </span>
      </div>

      {/* Meta: location + salary */}
      <div className={`space-y-1 mb-3 text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
        {(job.locationCity || job.locationState) && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{[job.locationCity, job.locationState].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {salary && (
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 flex-shrink-0" />
            <span>{salary}</span>
          </div>
        )}
        {job.jobType && (
          <div className="flex items-center gap-1">
            <Briefcase className="w-3 h-3 flex-shrink-0" />
            <span className="capitalize">{job.jobType.replace('-', ' ')}</span>
          </div>
        )}
      </div>

      {/* Application count chips */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
          dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
        }`}>
          <Users className="w-3 h-3" />
          {job.totalApplications} applicant{job.totalApplications !== 1 ? 's' : ''}
        </span>
        {job.newApplications > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400 font-medium">
            {job.newApplications} new
          </span>
        )}
      </div>

      {/* Action row */}
      <div className={`flex items-center gap-1 pt-3 border-t ${dark ? 'border-gray-700' : 'border-gray-100'}`}>
        {/* Edit */}
        <button
          onClick={onEdit}
          title="Edit job"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            dark
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
          }`}
        >
          <Edit2 className="w-3 h-3" />
          Edit
        </button>

        {/* Toggle active/closed */}
        <button
          onClick={onToggleActive}
          disabled={isToggling}
          title={job.isActive ? 'Close job' : 'Reactivate job'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            job.isActive
              ? dark
                ? 'bg-gray-700 text-gray-300 hover:bg-yellow-500/20 hover:text-yellow-400'
                : 'bg-gray-100 text-gray-600 hover:bg-yellow-50 hover:text-yellow-700'
              : dark
                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
          } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isToggling ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : job.isActive ? (
            <ToggleRight className="w-3 h-3" />
          ) : (
            <ToggleLeft className="w-3 h-3" />
          )}
          {job.isActive ? 'Close' : 'Reactivate'}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete job"
          className={`p-1.5 rounded-lg transition-colors ${
            dark
              ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          } ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Edit modal form
// ----------------------------------------------------------------

function EditJobModal({
  job,
  sessionUserId,
  theme,
  onClose,
  onSaved,
}: {
  job: JobPosting
  sessionUserId: string
  theme: string
  onClose: () => void
  onSaved: () => void
}) {
  const dark = false
  const [form, setForm] = useState<EditForm>(() => jobToEditForm(job))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof EditForm, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/employer/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description || null,
          targetRole: form.targetRole,
          locationCity: form.locationCity || null,
          locationState: form.locationState || null,
          salaryMin: form.salaryMin || null,
          salaryMax: form.salaryMax || null,
          jobType: form.jobType || null,
          routeType: form.routeType || null,
          experienceRequired: form.experienceRequired || null,
          remoteAllowed: form.remoteAllowed,
          isActive: form.isActive,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to save')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = `w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${
    dark
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`

  const labelClass = `block text-xs font-medium mb-1 ${dark ? 'text-gray-400' : 'text-gray-600'}`

  return (
    <Modal onClose={onClose} maxWidth="max-w-xl" zIndex={2000}>
      <ModalHeader title="Edit Job Posting" onClose={onClose} />
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">

        {/* Title */}
        <div>
          <label className={labelClass}>Job Title *</label>
          <input
            className={inputClass}
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Class A CDL Driver"
          />
        </div>

        {/* Role + Job Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Target Role</label>
            <select className={inputClass} value={form.targetRole} onChange={e => set('targetRole', e.target.value)}>
              {TARGET_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Job Type</label>
            <select className={inputClass} value={form.jobType} onChange={e => set('jobType', e.target.value)}>
              <option value="">Select...</option>
              {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Route type (driver only) */}
        {form.targetRole === 'driver' && (
          <div>
            <label className={labelClass}>Route Type</label>
            <select className={inputClass} value={form.routeType} onChange={e => set('routeType', e.target.value)}>
              <option value="">Select...</option>
              {ROUTE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        )}

        {/* Location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>City</label>
            <input className={inputClass} value={form.locationCity} onChange={e => set('locationCity', e.target.value)} placeholder="Columbus" />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <select className={inputClass} value={form.locationState} onChange={e => set('locationState', e.target.value)}>
              <option value="">Select...</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Salary */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Salary Min ($/yr)</label>
            <input type="number" className={inputClass} value={form.salaryMin} onChange={e => set('salaryMin', e.target.value)} placeholder="50000" />
          </div>
          <div>
            <label className={labelClass}>Salary Max ($/yr)</label>
            <input type="number" className={inputClass} value={form.salaryMax} onChange={e => set('salaryMax', e.target.value)} placeholder="80000" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={4}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Describe the role, responsibilities, and requirements..."
          />
        </div>

        {/* Status toggle */}
        <div className={`flex items-center justify-between p-3 rounded-lg border ${
          dark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
        }`}>
          <div>
            <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>Status</p>
            <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              {form.isActive ? 'Accepting applications' : 'Closed — not accepting applications'}
            </p>
          </div>
          <button
            onClick={() => set('isActive', !form.isActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              form.isActive
                ? 'bg-green-500/20 text-green-500'
                : dark ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {form.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {form.isActive ? 'Active' : 'Closed'}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-end gap-2 px-4 py-3 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
        <button
          onClick={onClose}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            dark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </Modal>
  )
}

// ----------------------------------------------------------------
// Main export
// ----------------------------------------------------------------

export default function JobPostingsSection({
  jobs,
  sessionUserId,
  theme,
  onPostJob,
  onRefresh,
  isCollapsed = false,
  onToggle,
}: JobPostingsSectionProps) {
  const dark = false

  const [editingJob, setEditingJob] = useState<JobPosting | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<JobPosting | null>(null)

  const activeJobs = jobs.filter(j => j.isActive)
  const closedJobs = jobs.filter(j => !j.isActive)

  const handleToggleActive = async (job: JobPosting) => {
    setTogglingId(job.id)
    try {
      const res = await fetch(`/api/employer/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ isActive: !job.isActive }),
      })
      if (!res.ok) throw new Error('Failed to update')
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update job status')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (job: JobPosting) => {
    setDeletingId(job.id)
    try {
      const res = await fetch(`/api/employer/jobs/${job.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      setDeleteTarget(null)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete job')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
    <HubSectionPanel isDark={dark} accent="teal" className="mb-8">
      <BlockCard
        variant="embed"
        paper
        icon={Briefcase}
        title="Job postings"
        description={`${jobs.length} total — active and closed listings.`}
        headerActions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!isCollapsed && (
              <Button type="button" variant="primary" size="sm" onClick={onPostJob}>
                <Plus className="h-4 w-4" />
                Post new job
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggle}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? 'Expand job postings' : 'Collapse job postings'}
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform duration-200', isCollapsed && '-rotate-90')}
              />
            </Button>
          </div>
        }
      >
      {/* Kanban columns — hidden when collapsed */}
      {!isCollapsed && (
        jobs.length === 0 ? (
          <div className={`rounded-xl border-2 border-dashed p-10 text-center ${
            dark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <Briefcase className={`w-10 h-10 mx-auto mb-3 ${dark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`font-medium mb-1 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>No job postings yet</p>
            <p className={`text-sm mb-4 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
              Create your first posting to start attracting candidates
            </p>
            <Button type="button" variant="primary" size="md" onClick={onPostJob}>
              <Plus className="h-4 w-4" />
              Post a job
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KanbanColumn
              title="Active"
              accent="bg-green-500"
              jobs={activeJobs}
              theme={theme}
              onEdit={setEditingJob}
              onToggleActive={handleToggleActive}
              onDelete={setDeleteTarget}
              togglingId={togglingId}
              deletingId={deletingId}
            />
            <KanbanColumn
              title="Closed"
              accent="bg-gray-400"
              jobs={closedJobs}
              theme={theme}
              onEdit={setEditingJob}
              onToggleActive={handleToggleActive}
              onDelete={setDeleteTarget}
              togglingId={togglingId}
              deletingId={deletingId}
            />
          </div>
        )
      )}
      </BlockCard>
    </HubSectionPanel>

      {/* Edit modal */}
      {editingJob && (
        <EditJobModal
          job={editingJob}
          sessionUserId={sessionUserId}
          theme={theme}
          onClose={() => setEditingJob(null)}
          onSaved={() => { setEditingJob(null); onRefresh() }}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} maxWidth="max-w-sm" zIndex={2000}>
          <ModalHeader title="Delete Job Posting" onClose={() => setDeleteTarget(null)} />
          <div className="p-4">
            <p className={`text-sm mb-4 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              Permanently delete <span className="font-semibold">&ldquo;{deleteTarget.title}&rdquo;</span>? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deletingId === deleteTarget.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deletingId === deleteTarget.id && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
