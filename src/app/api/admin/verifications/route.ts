import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import {
  anyFieldMatchesSearch,
  paginateInMemory,
  resolveUserIdsMatchingSearch,
} from '@/lib/admin-search'
import { summarizeEvrOutreach } from '@/lib/evr-metrics'

const LIST_COLUMNS =
  'id, driver_id, employment_id, initiated_by, applicant_type, previous_employer_name, previous_employer_email, previous_employer_phone, claimed_position, claimed_start_date, claimed_end_date, status, attempt_count, created_at, contact_research_status, outreach_exhausted_at, last_attempt_at, next_attempt_at'

const VIEWS = new Set(['needs_contact', 'exhausted', 'in_cadence'])
const OPEN = ['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS']

interface ListRow {
  id: string
  driver_id: string
  employment_id: string
  initiated_by: string
  applicant_type: string
  previous_employer_name: string
  previous_employer_email: string | null
  previous_employer_phone: string | null
  claimed_position: string
  claimed_start_date: string | null
  claimed_end_date: string | null
  status: string
  attempt_count: number | null
  created_at: string
  contact_research_status: string | null
  outreach_exhausted_at: string | null
  last_attempt_at: string | null
  next_attempt_at: string | null
}

interface AttemptRow {
  verification_request_id: string
  attempt_number: number
  method: string
  delivery_status: string | null
  sent_at: string
  contact_email: string | null
  triggered_by: string | null
}

/**
 * GET /api/admin/verifications?view=needs_contact|exhausted|in_cadence
 *
 * List plus a global outreach summary (not limited to the current page) so
 * central admin — and a bot signed in as an admin — can see whether the
 * cadence is earning replies.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const viewParam = searchParams.get('view') ?? ''
  const view = VIEWS.has(viewParam) ? viewParam : ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const hasSearch = search.length > 0

  try {
    const supabase = await getAdminSupabaseClient()

    let rowsQuery = supabase
      .from('employment_verification_requests')
      .select(LIST_COLUMNS, { count: hasSearch ? undefined : 'exact' })
      .order('created_at', { ascending: false })

    if (view === 'exhausted') rowsQuery = rowsQuery.eq('status', 'ATTEMPTS_EXHAUSTED')
    if (view === 'in_cadence') {
      rowsQuery = rowsQuery
        .in('status', OPEN)
        .not('previous_employer_email', 'is', null)
        .neq('contact_research_status', 'pending')
    }
    if (view === 'needs_contact') {
      rowsQuery = rowsQuery.or(
        'contact_research_status.in.(pending,not_found),and(previous_employer_email.is.null,status.in.(VERIFICATION_REQUESTED,VERIFICATION_IN_PROGRESS))',
      )
    }
    if (!hasSearch) rowsQuery = rowsQuery.range(offset, offset + limit - 1)

    const [{ data: rows, error, count }, { data: metricRequests }, { data: metricAttempts }] =
      await Promise.all([
        rowsQuery,
        supabase.from('employment_verification_requests').select('status, attempt_count'),
        supabase.from('verification_attempts').select('delivery_status'),
      ])

    if (error) {
      console.error('[ADMIN VERIFICATIONS] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch verifications' }, { status: 500 })
    }

    const pageRows = (rows ?? []) as ListRow[]
    const driverIds = [...new Set(pageRows.map((r) => r.driver_id))]
    const requestIds = pageRows.map((r) => r.id)

    const [{ data: users }, { data: attemptRows }] = await Promise.all([
      driverIds.length > 0
        ? supabase.from('users').select('id, wallet_address').in('id', driverIds)
        : Promise.resolve({ data: [] as { id: string; wallet_address: string }[] }),
      requestIds.length > 0
        ? supabase
            .from('verification_attempts')
            .select('verification_request_id, attempt_number, method, delivery_status, sent_at, contact_email, triggered_by')
            .in('verification_request_id', requestIds)
            .order('attempt_number', { ascending: true })
        : Promise.resolve({ data: [] as AttemptRow[] }),
    ])

    const walletByUserId = new Map(
      (users || []).map((u: { id: string; wallet_address: string }) => [u.id, u.wallet_address]),
    )
    const attemptsByRequest = new Map<string, AttemptRow[]>()
    for (const attempt of (attemptRows ?? []) as AttemptRow[]) {
      const list = attemptsByRequest.get(attempt.verification_request_id) ?? []
      list.push(attempt)
      attemptsByRequest.set(attempt.verification_request_id, list)
    }

    const matchingUserIds = hasSearch
      ? new Set(await resolveUserIdsMatchingSearch(supabase, search))
      : null

    const verifications = pageRows.map((r) => {
      const attempts = attemptsByRequest.get(r.id) ?? []
      const last = attempts.at(-1)
      return {
        id: r.id,
        driverId: r.driver_id,
        applicantWallet: walletByUserId.get(r.driver_id) ?? null,
        employmentId: r.employment_id,
        initiatedBy: r.initiated_by,
        applicantType: r.applicant_type,
        previousEmployerName: r.previous_employer_name,
        previousEmployerEmail: r.previous_employer_email,
        previousEmployerPhone: r.previous_employer_phone,
        claimedPosition: r.claimed_position,
        claimedStartDate: r.claimed_start_date,
        claimedEndDate: r.claimed_end_date,
        status: r.status,
        attemptCount: r.attempt_count ?? 0,
        createdAt: r.created_at,
        contactResearchStatus: r.contact_research_status,
        outreachExhaustedAt: r.outreach_exhausted_at,
        lastAttemptAt: r.last_attempt_at,
        nextAttemptAt: r.next_attempt_at,
        lastDeliveryStatus: last?.delivery_status ?? null,
        attempts: attempts.map((a) => ({
          attemptNumber: a.attempt_number,
          method: a.method,
          deliveryStatus: a.delivery_status,
          sentAt: a.sent_at,
          contactEmail: a.contact_email,
          triggeredBy: a.triggered_by,
        })),
      }
    })

    // SQL already applied `view` and, when there is no search, the page range.
    // Search has to happen in memory because it also matches the applicant wallet.
    const searched = hasSearch
      ? verifications.filter(
          (row) =>
            matchingUserIds?.has(row.driverId) ||
            anyFieldMatchesSearch(
              search,
              row.applicantWallet,
              row.previousEmployerName,
              row.previousEmployerEmail,
              row.claimedPosition,
              row.status,
            ),
        )
      : verifications
    const listed = hasSearch ? paginateInMemory(searched, offset, limit) : searched

    const summary = summarizeEvrOutreach(
      (metricRequests ?? []).map((r) => ({
        status: String(r.status),
        attemptCount: Number(r.attempt_count ?? 0),
      })),
      (metricAttempts ?? []).map((a) => ({ deliveryStatus: a.delivery_status as string | null })),
    )

    return NextResponse.json({
      success: true,
      verifications: listed,
      total: hasSearch ? searched.length : (count ?? listed.length),
      summary,
    })
  } catch (err) {
    console.error('[ADMIN VERIFICATIONS] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
