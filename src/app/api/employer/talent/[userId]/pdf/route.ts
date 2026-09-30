import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { buildProjectedCareerCard } from '@/lib/projected-career-card'
import { buildCareerCardPdfBuffer } from '@/lib/career-card-pdf'
import { hasEmployerCandidateRelationship } from '@/lib/employer-company-access'

/**
 * GET /api/employer/talent/[userId]/pdf
 *
 * Employer projection of the career card, only after a relationship exists
 * (application, used invite, or request). The QR points at the live public card.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const employerUserId = await getStormUserIdFromRequest(request)
    const { userId } = await params
    if (!employerUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employerUserId)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id ?? null
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employerUserId)
        .maybeSingle()
      companyId = legacyCompany?.id ?? null
    }
    if (!companyId) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const related = await hasEmployerCandidateRelationship(supabase, companyId, userId)
    if (!related) {
      return NextResponse.json(
        { error: 'Download opens after the driver accepts an invite or applies.' },
        { status: 403 },
      )
    }

    const { data: candidate } = await supabase
      .from('users')
      .select('id, created_at, share_token, share_settings')
      .eq('id', userId)
      .maybeSingle()
    if (!candidate?.share_token) {
      return NextResponse.json({ error: 'This driver has no share link yet' }, { status: 404 })
    }

    const rawSettings = candidate.share_settings as { showContact?: boolean; allowConnect?: boolean } | null
    const shareSettings = {
      showContact: rawSettings?.showContact === true,
      allowConnect: rawSettings?.allowConnect !== false,
    }

    const card = await buildProjectedCareerCard(supabase, userId, {
      memberSince: candidate.created_at ?? new Date().toISOString(),
      shareToken: candidate.share_token,
      shareSettings,
      contactMode: 'employer',
    })

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      request.headers.get('origin') ||
      'https://provven.com'
    const buffer = await buildCareerCardPdfBuffer(card, `${base}/card/${candidate.share_token}`)

    await supabase.from('career_card_views').insert({
      candidate_user_id: userId,
      viewer_user_id: employerUserId,
      source: 'pdf_export',
    })

    const safeName = card.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'career-card'
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="provven-career-card-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[EMPLOYER TALENT PDF]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
