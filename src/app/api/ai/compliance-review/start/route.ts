import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

type StartRequestBody = {
  applicationSummary?: string
  form1Data?: unknown
  form2Data?: unknown
  form3Data?: unknown
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.T_BACKEND_API_KEY
    const baseUrl = process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing T_BACKEND_API_KEY' }, { status: 500 })
    }

    const body = (await request.json()) as StartRequestBody

    // Construct a single string input (endpoint requires string, not object)
    const inputText = [
      'You are a DOT compliance auditor. Analyze the driver application below for compliance issues. ',
      'Identify missing fields, inconsistencies, and potential regulatory risks. ',
      'Output a concise report with sections: Summary, Missing/Invalid Fields, Potential Issues, Recommendations. ',
      'Use bullet points and reference form field names when possible.\n\n',
      '=== Application Summary ===\n',
      body.applicationSummary ? String(body.applicationSummary) : 'N/A',
      '\n\n=== Form 1 (Personal Info) ===\n',
      codeBlockJson(body.form1Data),
      '\n\n=== Form 2 (Driving & Records) ===\n',
      codeBlockJson(body.form2Data),
      '\n\n=== Form 3 (Employment & Signature) ===\n',
      codeBlockJson(body.form3Data),
    ].join('')

    const resp = await fetch(`${baseUrl}/background/create`, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'o3', input: inputText }),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return NextResponse.json(
        { error: 'Failed to create background task', detail: safeParseJson(text) },
        { status: resp.status }
      )
    }

    const data = await resp.json()
    return NextResponse.json({ success: true, id: data.id, status: data.status ?? 'pending' })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Unexpected error starting compliance review', detail: err?.message ?? String(err) },
      { status: 500 }
    )
  }
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function codeBlockJson(value: unknown): string {
  try {
    if (value === undefined || value === null) return 'null'
    const json = JSON.stringify(value, null, 2)
    return '```json\n' + json + '\n```'
  } catch {
    return String(value)
  }
}


