import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getSignedDocumentUrl, type DocumentBucket } from '@/lib/document-storage'

async function resolveEmployerCompanyId(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  userId: string,
): Promise<string | null> {
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (membership?.company_id) return membership.company_id

  const { data: legacy } = await supabase
    .from('companies')
    .select('id')
    .eq('employer_user_id', userId)
    .maybeSingle()
  return legacy?.id ?? null
}

/**
 * POST /api/documents/signed-url
 * Body: { resumeId: string } | { bucket: DocumentBucket, storagePath: string }
 * Returns a short-lived signed URL for a private storage object.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const resumeId = typeof body.resumeId === 'string' ? body.resumeId.trim() : ''
    const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : ''
    const bucket = body.bucket as DocumentBucket | undefined

    const supabase = await getAdminSupabaseClient()

    if (resumeId) {
      const { data: resume, error } = await supabase
        .from('resumes')
        .select('id, user_id, storage_path')
        .eq('id', resumeId)
        .maybeSingle()

      if (error || !resume?.storage_path) {
        return NextResponse.json({ error: 'Resume file not found' }, { status: 404 })
      }

      let allowed = resume.user_id === userId

      if (!allowed) {
        const companyId = await resolveEmployerCompanyId(supabase, userId)
        if (companyId) {
          const { data: application } = await supabase
            .from('applications')
            .select('id')
            .eq('company_id', companyId)
            .eq('user_id', resume.user_id)
            .limit(1)
            .maybeSingle()
          allowed = Boolean(application)
        }
      }

      if (!allowed) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      const url = await getSignedDocumentUrl('resumes', resume.storage_path)
      return NextResponse.json({ url, expiresIn: 3600 })
    }

    if (storagePath && bucket) {
      // Direct path access — only the owner prefix is allowed
      const ownerPrefix = storagePath.split('/')[0]
      if (ownerPrefix !== userId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
      const url = await getSignedDocumentUrl(bucket, storagePath)
      return NextResponse.json({ url, expiresIn: 3600 })
    }

    return NextResponse.json({ error: 'resumeId or storagePath required' }, { status: 400 })
  } catch (error) {
    console.error('[DOCUMENTS SIGNED URL]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create signed URL' },
      { status: 500 },
    )
  }
}
