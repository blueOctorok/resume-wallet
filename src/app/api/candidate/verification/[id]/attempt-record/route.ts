import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { buildAttemptRecord } from '@/lib/evr-attempt-record'
import { EvrAttemptRecordPdf } from '@/lib/pdf/EvrAttemptRecordPdf'
import {
  rowToVerificationAttempt,
  rowToVerificationRequest,
  type VerificationAttemptRow,
  type VerificationRequestRow,
} from '@/types/employment-verification'

// @react-pdf/renderer needs Node APIs; no Edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/candidate/verification/[id]/attempt-record[?format=json]
 *
 * Good-faith attempt record for the driver's own packet. PDF by default;
 * `?format=json` returns the canonical record + its SHA-256 so the hash on
 * the PDF can be independently reproduced.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { id } = await params
    const supabase = await getAdminSupabaseClient()

    const [{ data: reqRow }, { data: attemptRows }, { data: profile }] = await Promise.all([
      supabase
        .from('employment_verification_requests')
        .select('*')
        .eq('id', id)
        .eq('driver_id', userId)
        .maybeSingle(),
      supabase
        .from('verification_attempts')
        .select('*')
        .eq('verification_request_id', id)
        .order('attempt_number', { ascending: true }),
      supabase.from('user_profiles').select('first_name, last_name').eq('user_id', userId).maybeSingle(),
    ])
    if (!reqRow) {
      return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
    }

    const verificationRequest = rowToVerificationRequest(reqRow as VerificationRequestRow, 'Self-Initiated')
    const attempts = ((attemptRows ?? []) as VerificationAttemptRow[]).map(rowToVerificationAttempt)
    if (attempts.length === 0) {
      return NextResponse.json({ error: 'No outreach attempts recorded yet.' }, { status: 409 })
    }

    const driverName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Applicant'
    const { record, hash } = buildAttemptRecord(verificationRequest, attempts, driverName)

    if (request.nextUrl.searchParams.get('format') === 'json') {
      return NextResponse.json({ success: true, record, hash })
    }

    const element = React.createElement(EvrAttemptRecordPdf, { record, hash }) as unknown as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)
    const safeName = verificationRequest.previousEmployerName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="provven-ev-attempts-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[EVR ATTEMPT RECORD]', error)
    return NextResponse.json({ error: 'Failed to build attempt record' }, { status: 500 })
  }
}
