import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  saveEducation,
  saveSkills,
  saveReferences,
  getEducation,
  getSkills,
  getReferences,
} from '@/lib/block-data'
import type { UnifiedEducation, UnifiedSkill, UnifiedReference } from '@/types/driver-profile'
import { GENERAL_RESUME_SCHEMA } from '@/lib/general-resume-schema'

interface GeneralStructuredData {
  schema?: typeof GENERAL_RESUME_SCHEMA
  personalInfo?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    headline?: string
    professionalSummary?: string
  }
  cdlInfo?: Record<string, unknown>
  employments?: Array<{
    id: string
    companyName: string
    position: string
    startDate: string
    endDate: string
    isCurrent: boolean
    location: string
    responsibilities: string[]
  }>
  educations?: Array<{
    id: string
    school: string
    degree: string
    field: string
    year: string
    certifications: string[]
  }>
  skills?: Array<{
    id: string
    name: string
    category: string
  }>
  professionalCertifications?: Array<{
    id: string
    name: string
    issuer: string
    issuedDate: string
    expiresDate: string
  }>
  references?: Array<{
    id: string
    name: string
    title: string
    company: string
    phone: string
    email: string
    relationship: string
  }>
  createdAt?: string
  updatedAt?: string
}

const SKILL_CATS = new Set(['equipment', 'route', 'technology', 'safety', 'other'])

function mapSkillCategory(cat: string | undefined): UnifiedSkill['category'] {
  if (cat && SKILL_CATS.has(cat)) return cat as UnifiedSkill['category']
  return 'other'
}

async function syncGeneralResumeToBlocks(
  supabase: SupabaseClient,
  userId: string,
  structuredData: GeneralStructuredData,
) {
  const educations: UnifiedEducation[] = (structuredData.educations ?? []).map((e) => ({
    id: e.id,
    school: e.school ?? '',
    degree: e.degree ?? '',
    field: e.field ?? '',
    year: e.year ?? '',
    certifications: e.certifications ?? [],
  }))

  const skills: UnifiedSkill[] = (structuredData.skills ?? []).map((s) => ({
    id: s.id,
    name: s.name ?? '',
    category: mapSkillCategory(s.category),
  }))

  const references: UnifiedReference[] = (structuredData.references ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? '',
    phone: r.phone ?? '',
    email: r.email ?? '',
    relationship: r.relationship || r.title || '',
    title: r.title,
    company: r.company,
  }))

  try {
    await saveEducation(supabase, userId, educations)
    await saveSkills(supabase, userId, skills)
    await saveReferences(supabase, userId, references)
  } catch (err) {
    console.warn('[GENERAL RESUME] Block sync failed:', err)
  }
}

/**
 * POST /api/general/resume — create general (role-agnostic) built resume
 * PUT /api/general/resume — update
 * GET /api/general/resume — list + hub prefill from user_profiles + block_* tables
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const body = await request.json()
    const { structuredData, title } = body as { structuredData?: GeneralStructuredData; title?: string }

    if (!structuredData) {
      return NextResponse.json({ error: 'Structured data is required' }, { status: 400 })
    }

    const dataWithSchema: GeneralStructuredData = {
      ...structuredData,
      schema: GENERAL_RESUME_SCHEMA,
      cdlInfo: structuredData.cdlInfo ?? {},
    }

    const supabase = await getAdminSupabaseClient()
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const pi = dataWithSchema.personalInfo
    const fileStub = `${pi?.firstName || 'Resume'}_${pi?.lastName || 'General'}`.replace(/[^a-z0-9_]/gi, '_')

    const { data: resume, error: createError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        title: title || `${pi?.firstName ?? ''} ${pi?.lastName ?? ''}`.trim() || 'Professional Resume',
        filename: `${fileStub}.pdf`,
        resume_type: 'built',
        source_role: 'general',
        structured_data: dataWithSchema,
        ipfs_hash: `built_${Date.now()}`,
        verification_status: 'PENDING',
      })
      .select('id')
      .single()

    if (createError) {
      console.error('[GENERAL RESUME] Create error:', createError)
      return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 })
    }

    await syncGeneralResumeToBlocks(supabase, user.id, dataWithSchema)

    return NextResponse.json({
      success: true,
      resumeId: resume.id,
      message: 'Resume created successfully',
    })
  } catch (error) {
    console.error('[GENERAL RESUME] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const body = await request.json()
    const { resumeId, structuredData, title } = body as {
      resumeId?: string
      structuredData?: GeneralStructuredData
      title?: string
    }

    if (!resumeId || !structuredData) {
      return NextResponse.json(
        { error: 'Resume ID and structured data are required' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: existing, error: checkError } = await supabase
      .from('resumes')
      .select('id, user_id, source_role')
      .eq('id', resumeId)
      .single()

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (existing.source_role !== 'general') {
      return NextResponse.json({ error: 'Not a general resume' }, { status: 400 })
    }

    const dataWithSchema: GeneralStructuredData = {
      ...structuredData,
      schema: GENERAL_RESUME_SCHEMA,
      cdlInfo: structuredData.cdlInfo ?? {},
    }

    const pi = dataWithSchema.personalInfo
    const updateData: Record<string, unknown> = {
      structured_data: dataWithSchema,
      filename: `${(pi?.firstName || 'Resume')}_${(pi?.lastName || 'General')}`.replace(/[^a-z0-9_]/gi, '_') + '.pdf',
    }
    if (title) updateData.title = title

    const { error: updateError } = await supabase.from('resumes').update(updateData).eq('id', resumeId)

    if (updateError) {
      console.error('[GENERAL RESUME] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update resume' }, { status: 500 })
    }

    await syncGeneralResumeToBlocks(supabase, user.id, dataWithSchema)

    return NextResponse.json({ success: true, resumeId, message: 'Resume updated successfully' })
  } catch (error) {
    console.error('[GENERAL RESUME] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [{ data: resumes, error: resumesError }, profile, education, skills, refs] = await Promise.all([
      supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .eq('source_role', 'general')
        .order('created_at', { ascending: false }),
      supabase
        .from('user_profiles')
        .select(
          'first_name, last_name, email, phone, city, state, zip_code, professional_summary, headline',
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      getEducation(supabase, user.id),
      getSkills(supabase, user.id),
      getReferences(supabase, user.id),
    ])

    if (resumesError) {
      console.error('[GENERAL RESUME] Fetch error:', resumesError)
      return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      resumes: resumes || [],
      prefill: {
        profile,
        education,
        skills,
        references: refs,
      },
    })
  } catch (error) {
    console.error('[GENERAL RESUME] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
