import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
// pdf-parse ships as CJS; require keeps the Next.js node route happy
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getDriverDocuments, saveDriverDocuments } from '@/lib/block-data'
import { extractSlotsFromImage, extractSlotsFromText } from '@/lib/driver-document-extract'
import {
  lineFromSlots,
  toDriverDocumentView,
  type DriverDocumentRecord,
} from '@/lib/driver-document-lines'
import { deleteDocument, getSignedDocumentUrl, uploadDocument } from '@/lib/document-storage'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

const MAX_DOCUMENTS = 20
const MAX_BYTES = 10 * 1024 * 1024
const IMAGE_READ_LIMIT = 5 * 1024 * 1024

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type ImageType = (typeof IMAGE_TYPES)[number]

function isImageType(value: string): value is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(value)
}

/**
 * GET /api/driver/documents
 * GET /api/driver/documents?id= — signed URL for the driver's own file
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const documents = await getDriverDocuments(supabase, userId)
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ documents: documents.map(toDriverDocumentView) })
    }

    const doc = documents.find((row) => row.id === id)
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    const url = await getSignedDocumentUrl('driver-documents', doc.storagePath)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('[DRIVER DOCUMENTS] GET', error)
    return NextResponse.json({ error: 'Could not load documents' }, { status: 500 })
  }
}

/**
 * POST /api/driver/documents
 * multipart field `file` — PDF or photo. The file is stored either way.
 * A PDF with no text layer is kept and marked unread.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 })
    }
    if (file.type !== 'application/pdf' && !isImageType(file.type)) {
      return NextResponse.json(
        { error: 'Upload a PDF or a photo (JPEG, PNG, or WebP).' },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'That file is over 10 MB.' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const existing = await getDriverDocuments(supabase, userId)
    if (existing.length >= MAX_DOCUMENTS) {
      return NextResponse.json(
        { error: 'You can keep 20 documents. Delete one to add another.' },
        { status: 400 },
      )
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadDocument(userId, 'driver-documents', bytes, file.name || 'document', file.type)

    const record = await readUploadedFile(bytes, file.type, file.name || 'document', uploaded.storagePath)

    try {
      await saveDriverDocuments(supabase, userId, [record, ...existing])
    } catch (error) {
      await deleteDocument('driver-documents', uploaded.storagePath).catch(() => undefined)
      throw error
    }

    return NextResponse.json({ document: toDriverDocumentView(record) })
  } catch (error) {
    console.error('[DRIVER DOCUMENTS] POST', error)
    return NextResponse.json({ error: 'Could not save that document' }, { status: 500 })
  }
}

/**
 * PATCH /api/driver/documents
 * Body: { id, accepted } — accepted lines are what the resume prints.
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json() as { id?: unknown; accepted?: unknown }
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id || typeof body.accepted !== 'boolean') {
      return NextResponse.json({ error: 'id and accepted are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const documents = await getDriverDocuments(supabase, userId)
    const index = documents.findIndex((row) => row.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    const current = documents[index]
    if (body.accepted && !current.proposedLine) {
      return NextResponse.json({ error: 'This document has no line to put on the resume' }, { status: 400 })
    }

    const next: DriverDocumentRecord = {
      ...current,
      acceptedAt: body.accepted ? new Date().toISOString() : null,
    }
    const updated = documents.slice()
    updated[index] = next
    await saveDriverDocuments(supabase, userId, updated)
    return NextResponse.json({ document: toDriverDocumentView(next) })
  } catch (error) {
    console.error('[DRIVER DOCUMENTS] PATCH', error)
    return NextResponse.json({ error: 'Could not update that document' }, { status: 500 })
  }
}

/** DELETE /api/driver/documents?id= */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const documents = await getDriverDocuments(supabase, userId)
    const current = documents.find((row) => row.id === id)
    if (!current) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    await saveDriverDocuments(supabase, userId, documents.filter((row) => row.id !== id))
    await deleteDocument('driver-documents', current.storagePath).catch((error) => {
      console.error('[DRIVER DOCUMENTS] storage delete', error)
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DRIVER DOCUMENTS] DELETE', error)
    return NextResponse.json({ error: 'Could not delete that document' }, { status: 500 })
  }
}

async function readUploadedFile(
  bytes: Buffer,
  contentType: string,
  filename: string,
  storagePath: string,
): Promise<DriverDocumentRecord> {
  const base: DriverDocumentRecord = {
    id: randomUUID(),
    filename,
    contentType,
    storagePath,
    uploadedAt: new Date().toISOString(),
    readStatus: 'failed',
    unreadReason: "We couldn't read this file. Try a photo of the page.",
    slots: null,
    proposedLine: null,
    acceptedAt: null,
  }

  try {
    if (contentType === 'application/pdf') {
      const parsed = await pdfParse(bytes)
      const text = (parsed.text || '').replace(/\s+/g, ' ').trim()
      if (text.length < 40) {
        return {
          ...base,
          readStatus: 'unread',
          unreadReason: "We couldn't read the text in this PDF. Upload a photo of the page instead.",
        }
      }
      const slots = await extractSlotsFromText(text)
      return {
        ...base,
        readStatus: 'read',
        unreadReason: null,
        slots,
        proposedLine: lineFromSlots(slots),
      }
    }

    if (!isImageType(contentType)) return base
    if (bytes.length > IMAGE_READ_LIMIT) {
      return {
        ...base,
        readStatus: 'unread',
        unreadReason: 'This photo is too large to read. Upload one under 5 MB.',
      }
    }
    const slots = await extractSlotsFromImage(bytes, contentType)
    return {
      ...base,
      readStatus: 'read',
      unreadReason: null,
      slots,
      proposedLine: lineFromSlots(slots),
    }
  } catch (error) {
    console.error('[DRIVER DOCUMENTS] read', error)
    if (error instanceof Error && error.message === 'AI service is not configured.') {
      return { ...base, unreadReason: 'Reading documents is not configured yet.' }
    }
    return base
  }
}
