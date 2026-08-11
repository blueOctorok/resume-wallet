'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState } from 'react'
import { ShieldCheck, UserPlus, AlertTriangle } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import {
  domainFromEmail,
  isPublicEmailDomain,
  parseAllowedDomainsInput,
} from '@/lib/employer-domain-match'

interface CreateCompanyModalProps {
  theme: 'light' | 'dark'
  sessionUserId: string
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const EMPTY_FORM = {
  companyName: '',
  dotNumber: '',
  ownerEmail: '',
  allowedDomains: '',
  domainless: false,
  confirmName: '',
}

/**
 * The only way an employer account comes into existence.
 *
 * Self-serve signup and the AI-reviewed access-request queue were both removed,
 * so this form inherits the scrutiny that used to go into reviewing a request:
 * the domain policy is a required decision, and creation is type-to-confirm.
 */
export default function CreateCompanyModal({
  theme,
  sessionUserId,
  open,
  onClose,
  onCreated,
}: CreateCompanyModalProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  // Tracked so auto-filling the domain from the owner's email stops the moment
  // the admin types their own value.
  const [domainsTouched, setDomainsTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDark = isDarkTheme(theme)

  if (!open) return null

  const handleClose = () => {
    setForm(EMPTY_FORM)
    setDomainsTouched(false)
    setError(null)
    onClose()
  }

  const handleOwnerEmailChange = (value: string) => {
    setForm((prev) => {
      const derived = domainFromEmail(value)
      const shouldAutofill = !domainsTouched && !prev.domainless && derived && !isPublicEmailDomain(derived)
      return {
        ...prev,
        ownerEmail: value,
        allowedDomains: shouldAutofill ? derived : prev.allowedDomains,
      }
    })
  }

  const parsedDomains = form.domainless ? [] : parseAllowedDomainsInput(form.allowedDomains)
  const publicDomainEntry = parsedDomains.find(isPublicEmailDomain)
  const ownerDomain = domainFromEmail(form.ownerEmail)
  const ownerDomainMissing =
    !form.domainless && parsedDomains.length > 0 && !!ownerDomain && !parsedDomains.includes(ownerDomain)

  const nameConfirmed =
    form.confirmName.trim().toLowerCase() === form.companyName.trim().toLowerCase() &&
    form.companyName.trim().length > 0

  const canSubmit =
    !!form.companyName.trim() &&
    !!form.ownerEmail.trim() &&
    (form.domainless || parsedDomains.length > 0) &&
    !publicDomainEntry &&
    !ownerDomainMissing &&
    nameConfirmed &&
    !loading

  const handleCreate = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': sessionUserId,
        },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          dotNumber: form.dotNumber.trim() || undefined,
          designatedOwnerEmail: form.ownerEmail.trim(),
          allowedEmailDomains: parsedDomains,
          status: 'active',
        }),
      })
      const data = await res.json()

      if (data.success) {
        handleClose()
        onCreated()
      } else {
        setError(data.details ? `${data.error} — ${data.details}` : data.error || 'Failed to create company')
      }
    } catch {
      setError('Failed to create company')
    } finally {
      setLoading(false)
    }
  }

  const labelClass = `block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`
  const inputClass = `w-full px-3 py-2 rounded-lg border ${
    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
  } focus:outline-none focus:ring-2 focus:ring-indigo-500`
  const hintClass = `mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`

  return (
    <Modal onClose={handleClose} maxWidth='max-w-md'>
      <ModalHeader
        title='Create employer account'
        subtitle='The only way an employer account can exist'
        onClose={handleClose}
      />

      <div className='p-6'>
        <div
          className={`mb-5 flex items-start gap-3 rounded-xl border p-3 text-sm ${
            isDark
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}
        >
          <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0' />
          <p>
            The designated owner becomes an employer automatically the first time they sign in with
            this exact address. Nothing else grants employer access.
          </p>
        </div>

        <div className='space-y-4'>
          <div>
            <label className={labelClass}>
              Company Name <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={form.companyName}
              onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
              className={inputClass}
              placeholder='e.g. PACE Drivers LLC'
            />
          </div>

          <div>
            <label className={labelClass}>
              DOT Number{' '}
              <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>(optional)</span>
            </label>
            <input
              type='text'
              value={form.dotNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, dotNumber: e.target.value }))}
              className={inputClass}
              placeholder='e.g. 1234567'
            />
          </div>

          <div>
            <label className={labelClass}>
              Designated Owner Email <span className='text-red-500'>*</span>
            </label>
            <input
              type='email'
              value={form.ownerEmail}
              onChange={(e) => handleOwnerEmailChange(e.target.value)}
              className={inputClass}
              placeholder='owner@company.com'
            />
            <p className={hintClass}>They get an email as soon as you create the company.</p>
          </div>

          <div>
            <label className={labelClass}>
              Allowed Team Email Domains <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={form.allowedDomains}
              disabled={form.domainless}
              onChange={(e) => {
                setDomainsTouched(true)
                setForm((prev) => ({ ...prev, allowedDomains: e.target.value }))
              }}
              className={`${inputClass} disabled:opacity-40`}
              placeholder='pacedrivers.com'
            />
            <p className={hintClass}>
              Every team member the owner invites must use one of these. Separate multiple domains
              with commas.
            </p>

            <label
              className={`mt-3 flex items-start gap-2 text-sm ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              <input
                type='checkbox'
                checked={form.domainless}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, domainless: e.target.checked }))
                }
                className='mt-0.5 h-4 w-4 accent-indigo-500'
              />
              <span>
                This company has no corporate domain
                <span className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Their staff use personal inboxes. The owner vouches for each member — only tick
                  this if you have verified the company another way.
                </span>
              </span>
            </label>
          </div>

          {publicDomainEntry && (
            <div className='flex items-start gap-2 rounded-lg bg-amber-500/15 p-3 text-sm text-amber-700 dark:text-amber-300'>
              <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
              <span>
                <strong>@{publicDomainEntry}</strong> is a personal email provider. Tick
                &ldquo;no corporate domain&rdquo; instead if that is intentional.
              </span>
            </div>
          )}

          {ownerDomainMissing && (
            <div className='flex items-start gap-2 rounded-lg bg-amber-500/15 p-3 text-sm text-amber-700 dark:text-amber-300'>
              <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
              <span>
                The owner is on <strong>@{ownerDomain}</strong>, which is not in the allowed list.
                They would not be able to invite their own team.
              </span>
            </div>
          )}

          <div>
            <label className={labelClass}>
              Type <strong>{form.companyName.trim() || 'the company name'}</strong> to confirm
            </label>
            <input
              type='text'
              value={form.confirmName}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmName: e.target.value }))}
              className={inputClass}
              placeholder='Company name'
            />
          </div>

          {error && (
            <div className='rounded-lg bg-red-500/20 p-3 text-sm text-red-500 dark:text-red-400'>
              {error}
            </div>
          )}
        </div>

        <div className='mt-6 flex gap-3'>
          <Button variant='secondary' onClick={handleClose} className='flex-1'>
            Cancel
          </Button>
          <Button
            variant='primary'
            onClick={handleCreate}
            disabled={!canSubmit}
            isLoading={loading}
            className='flex-1'
          >
            <UserPlus className='h-4 w-4' />
            Create Company
          </Button>
        </div>
      </div>
    </Modal>
  )
}
