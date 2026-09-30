import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { domainFromEmail, isPublicEmailDomain } from '@/lib/employer-domain-match'
import { isCandidateSurfaceRole } from '@/lib/employer-account-guard'
import { employerAccessRateLimiter, RATE_LIMITS } from '@/lib/rate-limit'
import { sendNewCompanyNotification } from '@/lib/send-admin-notification'
import { EV_EMPLOYER_TERMS } from '@/lib/ev-consent-documents'
import { getRequestMeta, hashEvDocument } from '@/lib/ev-share'

/**
 * POST /api/employer/access-request
 *
 * Open form on a shared career card.
 *   - Work-email domain → company created as pending, terms recorded, magic
 *     link sent. Admin still approves before talent search unlocks.
 *   - Personal email domain → rejected. Drivers must not browse other drivers.
 *   - shareToken optional: homepage door omits it (signup_source homepage).
 */
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

    if (existingUser && isCandidateSurfaceRole(existingUser.role)) {
      return NextResponse.json(
        {
          error:
            'That email already belongs to a driver account. Use a different work email for your company.',
        },
        { status: 409 },
      )
    }

    if (isPublicEmailDomain(domain)) {
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

    if (existingOwner) {
      return NextResponse.json(
        {
          error: `This email is already tied to ${existingOwner.company_name}. Sign in to continue.`,
          outcome: 'already_exists',
        },
        { status: 409 },
      )
    }

    const { data: company, error: createError } = await supabase
      .from('companies')
      .insert({
        company_name: companyName,
        designated_owner_email: email,
        allowed_email_domains: domain ? [domain] : [],
        status: 'pending',
        onboarding_completed: true,
        signup_source: shareToken ? 'card_funnel' : 'homepage',
        origin_share_token: shareToken,
        email,
      })
      .select('id')
      .single()

    if (createError || !company) {
      console.error('[EMPLOYER ACCESS] Create error:', createError)
      return NextResponse.json({ error: 'Could not start your company account' }, { status: 500 })
    }

    const { error: termsError } = await supabase.from('company_terms_acceptances').insert({
      company_id: company.id,
      accepted_by_user_id: null,
      accepted_email: email,
      document_version: EV_EMPLOYER_TERMS.version,
      document_sha256: hashEvDocument(EV_EMPLOYER_TERMS),
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    })
    if (termsError) {
      console.error('[EMPLOYER ACCESS] Terms insert failed:', termsError)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://provven.com'
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: appUrl },
    })
    if (otpError) {
      console.error('[EMPLOYER ACCESS] Magic link failed:', otpError.message)
    }

    await sendNewCompanyNotification({
      companyName,
      ownerEmail: email,
      ownerWallet: shareToken ? 'card-funnel' : 'homepage',
    })

    return NextResponse.json({
      success: true,
      outcome: 'pending_created',
      message: shareToken
        ? otpError
          ? 'Your company is pending review. Sign in at Provven with this email — you can view the card you came from while we approve full access.'
          : 'Check your email for a sign-in link. Your company is pending review — you can view the card you came from as soon as you sign in.'
        : otpError
          ? 'Your company is pending review. Sign in at Provven with this email once we approve access.'
          : 'Check your email for a sign-in link. Your company is pending a quick review — Find Drivers opens as soon as we approve you.',
    })
  } catch (error) {
    console.error('[EMPLOYER ACCESS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
