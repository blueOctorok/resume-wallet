import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getDriverDocuments } from '@/lib/block-data'
import { getSignedDocumentUrl } from '@/lib/document-storage'
import { getEmployerCompanyAccess, hasEmployerCandidateRelationship } from '@/lib/employer-company-access'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/employer/drivers/[userId]/documents?id=
 *
 * Signed link for one file the driver uploaded. Only after this company
 * already has the driver (application, used invite, or accepted request).
 * A talent-search stranger does not get the file.
 */
export async function GET(
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
      return NextResponse.json({ error: 'Driver and document are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, actorId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const related = await hasEmployerCandidateRelationship(supabase, access.companyId, userId)
    if (!related) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const documents = await getDriverDocuments(supabase, userId)
    const doc = documents.find((row) => row.id === id)
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const url = await getSignedDocumentUrl('driver-documents', doc.storagePath)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('[EMPLOYER DRIVER DOCUMENTS] GET', error)
    return NextResponse.json({ error: 'Could not open that document' }, { status: 500 })
  }
}
