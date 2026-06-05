import { NextRequest, NextResponse } from 'next/server'
import { createResume, getUserResumes } from '@/lib/supabase-db'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { title, filename, ipfsHash, isPublic } = body
    if (!title || !filename || !ipfsHash) {
      return NextResponse.json(
        { error: 'Missing required fields: title, filename, ipfsHash' },
        { status: 400 },
      )
    }

    const resume = await createResume({
      title,
      filename,
      ipfsHash,
      isPublic: isPublic || false,
      userId: sessionUserId,
    })
    return NextResponse.json(resume, { status: 201 })
  } catch (error) {
    console.error('[RESUMES API] POST error:', error)
    return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const resumes = await getUserResumes(sessionUserId)
    return NextResponse.json(resumes)
  } catch (error) {
    console.error('[RESUMES API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 })
  }
}
