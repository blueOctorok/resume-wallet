import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { domainFromEmail, isPublicEmailDomain } from '@/lib/employer-domain-match'
import { isCandidateSurfaceRole } from '@/lib/employer-account-guard'
import { employerAccessRateLimiter, RATE_LIMITS } from '@/lib/rate-limit'
import {
  sendCompanyJoinRequestNotification,
  sendNewCompanyNotification,
} from '@/lib/send-admin-notification'
import { TEAM_ADMIN_ROLES } from '@/lib/employer-permissions'
import { EV_EMPLOYER_TERMS } from '@/lib/ev-consent-documents'
import { getRequestMeta, hashEvDocument } from '@/lib/ev-share'
import { isTestCarrierInbox, isTestSuperuserEmail, testCarrierAlias } from '@/lib/test-superuser'
import { sendSignInCode } from '@/lib/send-signin-code'

/**
 * POST /api/employer/access-request
 *
 * Open form on a shared career card.
 *   - Work-email domain → company created as pending, terms recorded, magic
 *     link sent. Admin still approves before talent search unlocks.
 *   - Personal email domain → rejected. Drivers must not browse other drivers.
 *   - Domain already on a company's allowlist → rejected (409), team admins
 *     emailed. One company per work domain.
 *   - shareToken optional: homepage door omits it (signup_source homepage).
 */
/** Code-only email, then the modal collects the digits. No second trip to Log in. */
async function sendCode(admin: SupabaseClient, email: string, companyName: string) {
  const sent = await sendSignInCode(admin, email)
  if (sent.ok === false) {
    return NextResponse.json({ error: sent.error }, { status: 502 })
  }
  return NextResponse.json({
    success: true,
    outcome: 'code_sent',
    email,
    companyName,
  })
}

interface DomainOwningCompany {
  id: string
  company_name: string
  designated_owner_email: string | null
}

/** Oldest non-rejected company whose allowlist contains this domain. */
async function findCompanyOwningDomain(
  admin: SupabaseClient,
  domain: string,
): Promise<DomainOwningCompany | null> {
  const { data } = await admin
    .from('companies')
    .select('id, company_name, designated_owner_email')
    .contains('allowed_email_domains', [domain])
    .neq('status', 'rejected')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** Email the owner/admins so they can add the colleague via Team → Invite. */
async function notifyTeamAdminsOfJoinRequest(
  admin: SupabaseClient,
  company: DomainOwningCompany,
  requesterName: string,
  requesterEmail: string,
) {
  const { data: members } = await admin
    .from('company_members')
    .select('user_id')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .in('role', [...TEAM_ADMIN_ROLES])
  const userIds = (members ?? []).map((m) => m.user_id as string)

  const { data: users } = userIds.length
    ? await admin.from('users').select('email').in('id', userIds)
    : { data: [] }
  const emails = new Set((users ?? []).map((u) => String(u.email ?? '').toLowerCase()).filter(Boolean))
  // Pending companies have no members yet; the designated owner is the only contact.
  if (company.designated_owner_email) emails.add(company.designated_owner_email.toLowerCase())

  const sent = await sendCompanyJoinRequestNotification({
    companyName: company.company_name,
    teamAdminEmails: [...emails],
    requesterName,
    requesterEmail,
  })
  if (!sent.ok) console.warn('[EMPLOYER ACCESS] Join-request email not sent:', sent.error)
}

export async function POST(request: NextRequest) {
  try {
    const meta = getRequestMeta(request)
    const limitKey = `employer-access:${meta.ipAddress || 'unknown'}`
    if (
      !employerAccessRateLimiter.check(
        limitKey,
        RATE_LIMITS.EMPLOYER_ACCESS.maxRequests,
        RATE_LIMITS.EMPLOYER_ACCESS.windowMs,
      )
    ) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a little while.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const name = String(body.name ?? '').trim()
    const companyName = String(body.companyName ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const shareToken = String(body.shareToken ?? '').trim() || null
    const termsAccepted = body.termsAccepted === true

    if (!name || !companyName || !email || !email.includes('@')) {
      return NextResponse.json({ error: 'Name, company, and email are required' }, { status: 400 })
    }
    if (!termsAccepted) {
      return NextResponse.json({ error: 'Employer terms must be accepted' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const domain = domainFromEmail(email)

    if (shareToken) {
      const { data: card } = await supabase
        .from('users')
        .select('id')
        .eq('share_token', shareToken)
        .maybeSingle()
      if (!card) {
        return NextResponse.json({ error: 'That career card link is no longer valid' }, { status: 404 })
      }
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role')
      .ilike('email', email)
      .maybeSingle()

    // Test inbox is already a candidate. The company is owned by a plus-alias
    // below, so this login stays a driver and the code still lands in Gmail.
    const useTestInbox = isTestCarrierInbox(email)

    if (!useTestInbox && existingUser && isCandidateSurfaceRole(existingUser.role)) {
      return NextResponse.json(
        {
          error:
            'That email already belongs to a driver account. Use a different work email for your company.',
        },
        { status: 409 },
      )
    }

    if (!useTestInbox && isPublicEmailDomain(domain)) {
      return NextResponse.json(
        {
          error:
            'Use your company email address — personal addresses (Gmail, Yahoo, Outlook.com…) can’t open a carrier account.',
        },
        { status: 400 },
      )
    }

    const { data: existingOwner } = await supabase
      .from('companies')
      .select('id, company_name')
      .ilike('designated_owner_email', email)
      .maybeSingle()

    // Same inbox, different login. See test-superuser.ts.
    const ownerEmail =
      useTestInbox || (existingOwner && isTestSuperuserEmail(email))
        ? testCarrierAlias(email)
        : email

    // Company already exists for this address. Don't make them leave for Log in —
    // send a fresh code and let the same form finish sign-in.
    if (existingOwner && ownerEmail === email) {
      return sendCode(supabase, ownerEmail, existingOwner.company_name)
    }

    // A company already owns this work domain. Never mint a second one — that
    // is how a colleague of an existing carrier ends up alone in a duplicate
    // company. Tell them to get invited, and tell the admins they asked.
    if (!useTestInbox && domain) {
      const domainOwner = await findCompanyOwningDomain(supabase, domain)
      if (domainOwner) {
        void notifyTeamAdminsOfJoinRequest(supabase, domainOwner, name, email)
        return NextResponse.json(
          {
            error: `@${domain} is already registered to ${domainOwner.company_name} on Provven. Ask your team's account owner to invite you — we've let them know you asked.`,
          },
          { status: 409 },
        )
      }
    }

    const { data: company, error: createError } = await supabase
      .from('companies')
      .insert({
        company_name: companyName,
        designated_owner_email: ownerEmail,
        // Don't write gmail.com onto the allowlist. Empty means this test
        // company has no domain rule; a real carrier still gets its work domain.
        allowed_email_domains: useTestInbox ? [] : domain ? [domain] : [],
        status: 'pending',
        onboarding_completed: true,
        signup_source: shareToken ? 'card_funnel' : 'homepage',
        origin_share_token: shareToken,
        email: ownerEmail,
      })
      .select('id')
      .single()

    if (createError || !company) {
      console.error('[EMPLOYER ACCESS] Create error:', createError)
      // Pending companies have no user yet, and they store an email-domain
      // allowlist. Both require migration 113 (nullable owner + the column).
      const detail = createError?.message ?? ''
      const needsSchema =
        /employer_user_id|allowed_email_domains|not-null|schema cache/i.test(detail)
      return NextResponse.json(
        {
          error: needsSchema
            ? 'Could not start your company account. Apply migration 113 in Supabase, then try again.'
            : 'Could not start your company account',
        },
        { status: 500 },
      )
    }

    const { error: termsError } = await supabase.from('company_terms_acceptances').insert({
      company_id: company.id,
      accepted_by_user_id: null,
      accepted_email: ownerEmail,
      document_version: EV_EMPLOYER_TERMS.version,
      document_sha256: hashEvDocument(EV_EMPLOYER_TERMS),
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    })
    if (termsError) {
      console.error('[EMPLOYER ACCESS] Terms insert failed:', termsError)
    }

    await sendNewCompanyNotification({
      companyName,
      ownerEmail,
      ownerWallet: shareToken ? 'card-funnel' : 'homepage',
    })

    return sendCode(supabase, ownerEmail, companyName)
  } catch (error) {
    console.error('[EMPLOYER ACCESS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
