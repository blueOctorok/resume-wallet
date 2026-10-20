'use client'

import { create } from 'zustand'
import type { LicenseScanFields } from '@/lib/aamva-license'
import type { LicenseScanView } from '@/lib/license-scan-types'

interface LicenseBlockState {
  scan: LicenseScanView | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  /** Labels of fields the last confirm wrote into empty spots. */
  filled: string[]
  load: () => Promise<void>
  submitBarcode: (raw: string) => Promise<void>
  confirm: (fields: LicenseScanFields) => Promise<boolean>
  clearError: () => void
}

export const useLicenseBlockStore = create<LicenseBlockState>((set) => ({
  scan: null,
  isLoading: false,
  isSaving: false,
  error: null,
  filled: [],

  clearError: () => set({ error: null }),

  load: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/driver/license')
      const body = await res.json()
      if (!res.ok) {
        set({ error: body.error ?? 'Could not load the license', isLoading: false })
        return
      }
      set({ scan: body.scan ?? null, isLoading: false })
    } catch {
      set({ error: 'Could not load the license', isLoading: false })
    }
  },

  submitBarcode: async (raw) => {
    set({ isSaving: true, error: null, filled: [] })
    try {
      const res = await fetch('/api/driver/license/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      })
      const body = await res.json()
      if (!res.ok) {
        set({ error: body.error ?? 'Could not save that barcode read', isSaving: false })
        return
      }
      set({ scan: body.scan ?? null, isSaving: false })
    } catch {
      set({ error: 'Could not save that barcode read', isSaving: false })
    }
  },

  confirm: async (fields) => {
    set({ isSaving: true, error: null })
    try {
      const res = await fetch('/api/driver/license/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const body = await res.json()
      if (!res.ok) {
        set({ error: body.error ?? 'Could not save the license on file', isSaving: false })
        return false
      }
      set({
        scan: body.scan ?? null,
        filled: Array.isArray(body.filled) ? body.filled : [],
        isSaving: false,
      })
      return true
    } catch {
      set({ error: 'Could not save the license on file', isSaving: false })
      return false
    }
  },
}))
