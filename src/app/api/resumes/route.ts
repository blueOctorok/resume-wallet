import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, filename, ipfsHash, isPublic } = body

    // Validate required fields
    if (!title || !filename || !ipfsHash) {
      return NextResponse.json(
        { error: 'Missing required fields: title, filename, ipfsHash' },
        { status: 400 }
      )
    }

    // TODO: Get actual user ID from wallet authentication
    // For now, create a placeholder user or use a default
    const userId = 'temp-user-id'

    // Create resume record in database
    const resume = await prisma.resume.create({
      data: {
        title,
        filename,
        ipfsHash,
        isPublic: isPublic || false,
        userId,
      },
    })

    return NextResponse.json(resume, { status: 201 })
  } catch (error) {
    console.error('Error creating resume:', error)
    return NextResponse.json(
      { error: 'Failed to create resume' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // TODO: Get actual user ID from wallet authentication
    const userId = 'temp-user-id'

    const resumes = await prisma.resume.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(resumes)
  } catch (error) {
    console.error('Error fetching resumes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch resumes' },
      { status: 500 }
    )
  }
}
