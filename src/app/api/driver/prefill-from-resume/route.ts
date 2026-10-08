import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { normalizeWalletAddress } from '@/lib/user-by-wallet'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  getOrCreateUsage,
  checkResumeParseUsage,
  incrementResumeParseDaily,
  consumeCredit,
  STORMI_UNLIMITED_WALLETS,
} from '@/lib/ava-usage'
import { extractResumeWithAi } from '@/lib/resume-parse-ai'
import { extractionToDotPrefill } from '@/lib/resume-to-dot-prefill'

export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024
const MIN_TEXT = 40

/**
 * POST /api/driver/prefill-from-resume
 * Multipart body: file (PDF or plain text).
 *
 * The file is read in this request and then dropped. Nothing is written to
 * Storage or the resumes table — the DOT application is the thing we keep,
 * and the career-card resume is generated from that application plus the MVR.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.AVA_BRAIN) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 503 })
    }

    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a resume file.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be under 5MB.' }, { status: 400 })
    }

    const text = (await readResumeText(file)).trim()
    if (text.length < MIN_TEXT) {
      return NextResponse.json(
        { error: 'Could not read enough text. Use a text-based PDF, not a scan.' },
        { status: 422 },
      )
    }

    const sessionUserId = request.headers.get('x-wallet-address')
    const isUnlimited = sessionUserId
      ? STORMI_UNLIMITED_WALLETS.has(normalizeWalletAddress(sessionUserId))
      : false

    const supabase = await getAdminSupabaseClient()
    const usage = await getOrCreateUsage(supabase, userId)
    const check = checkResumeParseUsage(usage, isUnlimited)
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: 'out_of_credits',
          message:
            'You have used your free resume read for today. Purchase AI credits to read another, or try again tomorrow.',
        },
        { status: 402 },
      )
    }

    const extraction = await extractResumeWithAi({ resumeText: text, model: check.model })
    const prefill = extractionToDotPrefill(extraction)
    if (!prefill.form1Data && !prefill.form2Data && !prefill.form3Data) {
      return NextResponse.json(
        { error: 'No application fields were found in that file.' },
        { status: 422 },
      )
    }

    if (!isUnlimited) {
      if (check.usingCredits) await consumeCredit(supabase, userId)
      else await incrementResumeParseDaily(supabase, userId)
    }

    return NextResponse.json({ success: true, ...prefill })
  } catch (error) {
    console.error('[DOT PREFILL]', error)
    const message = error instanceof Error ? error.message : 'Failed to read resume'
    const status = message.includes('PDF or a .txt') ? 415 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

async function readResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf')
  const isText = file.type.startsWith('text/') || name.endsWith('.txt')

  if (isText) return file.text()
  if (!isPdf) {
    throw new Error('Use a PDF or a .txt file. We read it once and do not keep it.')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const parser = new PDFParse({ data: bytes })
  try {
    const result = await parser.getText()
    return result.text ?? ''
  } finally {
    await parser.destroy()
  }
}
