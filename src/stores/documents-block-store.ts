'use client'

import { create } from 'zustand'
import type { DriverDocumentView } from '@/lib/driver-document-lines'

interface DocumentsBlockState {
  documents: DriverDocumentView[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  load: () => Promise<void>
  upload: (file: File) => Promise<boolean>
  setAccepted: (id: string, accepted: boolean) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  openFile: (id: string) => Promise<void>
}

export const useDocumentsBlockStore = create<DocumentsBlockState>((set, get) => ({
  documents: [],
  isLoading: false,
  isSaving: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/driver/documents')
      const body = await res.json()
      if (!res.ok) {
        set({ error: body.error ?? 'Could not load documents', isLoading: false })
        return
      }
      set({ documents: body.documents ?? [], isLoading: false })
    } catch {
      set({ error: 'Could not load documents', isLoading: false })
    }
  },

  upload: async (file) => {
    set({ isSaving: true, error: null })
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/driver/documents', { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) {
        set({ error: body.error ?? 'Could not save that document', isSaving: false })
        return false
      }
      set({ documents: [body.document, ...get().documents], isSaving: false })
      return true
    } catch {
      set({ error: 'Could not save that document', isSaving: false })
      return false
    }
  },

  setAccepted: async (id, accepted) => {
    set({ isSaving: true, error: null })
    try {
      const res = await fetch('/api/driver/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, accepted }),
      })
      const body = await res.json()
      if (!res.ok) {
        set({ error: body.error ?? 'Could not update that document', isSaving: false })
        return false
      }
      set({
        documents: get().documents.map((doc) => (doc.id === id ? body.document : doc)),
        isSaving: false,
      })
      return true
    } catch {
      set({ error: 'Could not update that document', isSaving: false })
      return false
    }
  },

  remove: async (id) => {
    set({ isSaving: true, error: null })
    try {
      const res = await fetch(`/api/driver/documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) {
        set({ error: body.error ?? 'Could not delete that document', isSaving: false })
        return false
      }
      set({ documents: get().documents.filter((doc) => doc.id !== id), isSaving: false })
      return true
    } catch {
      set({ error: 'Could not delete that document', isSaving: false })
      return false
    }
  },

  openFile: async (id) => {
    const res = await fetch(`/api/driver/documents?id=${encodeURIComponent(id)}`)
    const body = await res.json()
    if (!res.ok || typeof body.url !== 'string') {
      set({ error: body.error ?? 'Could not open that file' })
      return
    }
    window.open(body.url, '_blank', 'noopener,noreferrer')
  },
}))
