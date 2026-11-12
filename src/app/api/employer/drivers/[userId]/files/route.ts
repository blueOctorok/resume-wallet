import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { can, capabilityDeniedMessage } from '@/lib/employer-permissions'
import {
  buildCompanyDriverFilePath,
  deleteDocument,
  getSignedDocumentUrl,
} from '@/lib/document-storage'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

const MAX_FILES = 25
const MAX_BYTES = 10 * 1024 * 1024
const KINDS = ['dot_application', 'application', 'other'] as const
type FileKind = (typeof KINDS)[number]

function isKind(value: string): value is FileKind {
  return (KINDS as readonly string[]).includes(value)
}

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

interface FileRow {
  id: string
  kind: FileKind
  filename: string
  note: string | null
  storage_path: string
  created_at: string
}

function toView(row: FileRow) {
  return {
    id: row.id,
    kind: row.kind,
    filename: row.filename,
    note: row.note,
    createdAt: row.created_at,
  }
}

/**
 * GET /api/employer/drivers/[userId]/files
 * GET ?id= returns a signed URL. Company members only. The driver has no access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const actorId = await getStormUserIdFromRequest(request)
    const { userId } = await params
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!userId) {
      return NextResponse.json({ error: 'Driver id is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, actorId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('employer_driver_files')
      .select('id, kind, filename, note, storage_path, created_at')
      .eq('company_id', access.companyId)
      .eq('candidate_user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[EMPLOYER DRIVER FILES] list', error)
      return NextResponse.json({ error: 'Could not load files' }, { status: 500 })
    }

    const rows = (data ?? []) as FileRow[]
    const id = new URL(request.url).searchParams.get('id')
    if (id) {
      const row = rows.find((file) => file.id === id)
      if (!row) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
      const url = await getSignedDocumentUrl('employer-driver-files', row.storage_path)
      return NextResponse.json({ url })
    }

    return NextResponse.json({
      files: rows.map(toView),
      canManage: can(access.companyRole, 'manageCandidates'),
    })
  } catch (error) {
    console.error('[EMPLOYER DRIVER FILES] GET', error)
    return NextResponse.json({ error: 'Could not load files' }, { status: 500 })
  }
}

/** POST multipart: file, kind, note. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const actorId = await getStormUserIdFromRequest(request)
    const { userId } = await params
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!userId) {
      return NextResponse.json({ error: 'Driver id is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, actorId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }
    if (!can(access.companyRole, 'manageCandidates')) {
      return NextResponse.json({ error: capabilityDeniedMessage('manageCandidates') }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    const kindRaw = typeof form.get('kind') === 'string' ? String(form.get('kind')) : 'other'
    const noteRaw = typeof form.get('note') === 'string' ? String(form.get('note')).trim() : ''
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 })
    }
    if (!isKind(kindRaw)) {
      return NextResponse.json({ error: 'Choose a file type' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Upload a PDF or a photo (JPEG, PNG, or WebP).' },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'That file is over 10 MB.' }, { status: 400 })
    }

    const { count, error: countError } = await supabase
      .from('employer_driver_files')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', access.companyId)
      .eq('candidate_user_id', userId)
    if (countError) {
      console.error('[EMPLOYER DRIVER FILES] count', countError)
      return NextResponse.json({ error: 'Could not save that file' }, { status: 500 })
    }
    if ((count ?? 0) >= MAX_FILES) {
      return NextResponse.json(
        { error: 'This driver already has 25 files. Delete one to add another.' },
        { status: 400 },
      )
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const storagePath = buildCompanyDriverFilePath(access.companyId, userId, file.name || 'document')
    const admin = supabase
    const { error: uploadError } = await admin.storage.from('employer-driver-files').upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    })
    if (uploadError) {
      console.error('[EMPLOYER DRIVER FILES] upload', uploadError)
      return NextResponse.json({ error: 'Could not save that file' }, { status: 500 })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('employer_driver_files')
      .insert({
        company_id: access.companyId,
        candidate_user_id: userId,
        uploaded_by: actorId,
        kind: kindRaw,
        filename: file.name || 'document',
        content_type: file.type,
        storage_path: storagePath,
        note: noteRaw.slice(0, 500) || null,
      })
      .select('id, kind, filename, note, storage_path, created_at')
      .single()

    if (insertError || !inserted) {
      await deleteDocument('employer-driver-files', storagePath).catch(() => undefined)
      console.error('[EMPLOYER DRIVER FILES] insert', insertError)
      return NextResponse.json({ error: 'Could not save that file' }, { status: 500 })
    }

    return NextResponse.json({ file: toView(inserted as FileRow) })
  } catch (error) {
    console.error('[EMPLOYER DRIVER FILES] POST', error)
    return NextResponse.json({ error: 'Could not save that file' }, { status: 500 })
  }
}

/** DELETE /api/employer/drivers/[userId]/files?id= */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const actorId = await getStormUserIdFromRequest(request)
    const { userId } = await params
    const id = new URL(request.url).searchParams.get('id')
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!userId || !id) {
      return NextResponse.json({ error: 'Driver id and file id are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, actorId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }
    if (!can(access.companyRole, 'manageCandidates')) {
      return NextResponse.json({ error: capabilityDeniedMessage('manageCandidates') }, { status: 403 })
    }

    const { data: row, error: readError } = await supabase
      .from('employer_driver_files')
      .select('id, storage_path')
      .eq('id', id)
      .eq('company_id', access.companyId)
      .eq('candidate_user_id', userId)
      .maybeSingle()

    if (readError) {
      console.error('[EMPLOYER DRIVER FILES] read', readError)
      return NextResponse.json({ error: 'Could not delete that file' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('employer_driver_files')
      .delete()
      .eq('id', id)
      .eq('company_id', access.companyId)
    if (deleteError) {
      console.error('[EMPLOYER DRIVER FILES] delete', deleteError)
      return NextResponse.json({ error: 'Could not delete that file' }, { status: 500 })
    }

    await deleteDocument('employer-driver-files', row.storage_path as string).catch((error) => {
      console.error('[EMPLOYER DRIVER FILES] storage delete', error)
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[EMPLOYER DRIVER FILES] DELETE', error)
    return NextResponse.json({ error: 'Could not delete that file' }, { status: 500 })
  }
}
