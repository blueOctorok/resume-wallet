import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.T_BACKEND_API_KEY
    const baseUrl = process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing T_BACKEND_API_KEY' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
    }

    const resp = await fetch(`${baseUrl}/background/${encodeURIComponent(id)}`, {
      headers: { 'api-key': apiKey },
      cache: 'no-store',
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return NextResponse.json(
        { error: 'Failed to fetch background status', detail: safeParseJson(text) },
        { status: resp.status }
      )
    }

    const data = await resp.json()
    return NextResponse.json({ success: true, ...data })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Unexpected error fetching status', detail: err?.message ?? String(err) },
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


