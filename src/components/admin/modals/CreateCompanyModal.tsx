'use client'

import React, { useState } from 'react'
import { Building2, X, UserPlus, Loader2 } from 'lucide-react'

interface CreateCompanyModalProps {
  theme: 'light' | 'dark'
  walletAddress: string
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CreateCompanyModal({
  theme,
  walletAddress,
  open,
  onClose,
  onCreated,
}: CreateCompanyModalProps) {
  const [form, setForm] = useState({
    companyName: '',
    dotNumber: '',
    ownerEmail: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleClose = () => {
    setForm({ companyName: '', dotNumber: '', ownerEmail: '' })
    setError(null)
    onClose()
  }

  const handleCreate = async () => {
    if (!form.companyName.trim() || !form.ownerEmail.trim()) {
      setError('Company name and owner email are required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          dotNumber: form.dotNumber.trim() || undefined,
          designatedOwnerEmail: form.ownerEmail.trim(),
          status: 'active',
        }),
      })
      const data = await res.json()

      if (data.success) {
        setForm({ companyName: '', dotNumber: '', ownerEmail: '' })
        onCreated()
        onClose()
      } else {
        setError(data.error || 'Failed to create company')
      }
    } catch {
      setError('Failed to create company')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    form.companyName.trim() && form.ownerEmail.trim() && !loading

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'>
      <div
        className={`rounded-xl border ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        } p-6 max-w-md w-full`}
      >
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-3'>
            <div
              className={`p-2 rounded-full ${
                theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100'
              }`}
            >
              <Building2 className='w-6 h-6 text-indigo-500' />
            </div>
            <h3
              className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Pre-Create Company
            </h3>
          </div>
          <button
            onClick={handleClose}
            className={`p-1 rounded-lg ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <p
          className={`mb-4 text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Pre-create a company for a client. When the designated owner logs in
          with their email, they will automatically be linked as the owner.
        </p>

        <div className='space-y-4'>
          <div>
            <label
              className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Company Name <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={form.companyName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, companyName: e.target.value }))
              }
              className={`w-full px-3 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              placeholder='e.g. PACE Drivers LLC'
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              DOT Number{' '}
              <span
                className={
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }
              >
                (optional)
              </span>
            </label>
            <input
              type='text'
              value={form.dotNumber}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dotNumber: e.target.value }))
              }
              className={`w-full px-3 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              placeholder='e.g. 1234567'
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Designated Owner Email <span className='text-red-500'>*</span>
            </label>
            <input
              type='email'
              value={form.ownerEmail}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, ownerEmail: e.target.value }))
              }
              className={`w-full px-3 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              placeholder='owner@company.com'
            />
            <p
              className={`mt-1 text-xs ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              This email address will become the owner when they sign up.
            </p>
          </div>

          {error && (
            <div className='p-3 rounded-lg bg-red-500/20 text-red-400 text-sm'>
              {error}
            </div>
          )}
        </div>

        <div className='flex gap-3 mt-6'>
          <button
            onClick={handleClose}
            className={`flex-1 px-4 py-2 rounded-lg font-medium ${
              theme === 'dark'
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className='flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <>
                <UserPlus className='w-4 h-4' />
                Create Company
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
