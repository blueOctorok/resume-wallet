// app/api/resumes/[id]/verify/route.ts
// One-click verification for built resumes
// Flow: Generate PDF → Upload to IPFS → Mark verified in database (Phase 2 attestation replaces chain anchor)

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { generateStyledResumePDF } from '@/lib/resume-pdf-generator'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { hasStoredResumeFile, uploadDocument, getSignedDocumentUrl } from '@/lib/document-storage'
import { generateDeveloperResumePDFBuffer } from '@/lib/developer-resume-pdf'
import type { DeveloperResumeData } from '@/components/DeveloperResumeBuilder'

// Type for structured resume data
interface StructuredResumeData {
  personalInfo?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    summary?: string
  }
  cdlInfo?: {
    cdlClass?: string
    cdlState?: string
    cdlExpiration?: string
    endorsements?: string[]
  }
  employments?: Array<{
    company?: string
    position?: string
    startDate?: string
    endDate?: string
    current?: boolean
    description?: string
  }>
  educations?: Array<{
    school?: string
    degree?: string
    field?: string
    graduationDate?: string
  }>
  skills?: Array<{
    category?: string
    items?: string[]
  }>
  references?: Array<{
    name?: string
    relationship?: string
    company?: string
    phone?: string
    email?: string
  }>
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = await getStormUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.log('[VERIFY RESUME] Starting verification for resume:', id)

    const supabase = await getAdminSupabaseClient()

    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (resumeError || !resume) {
      return NextResponse.json({ error: 'Resume not found or access denied' }, { status: 404 })
    }

    if (resume.verification_status === 'VERIFIED') {
      return NextResponse.json(
        {
          error: 'Resume is already verified',
          blockchain_tx_hash: resume.blockchain_tx_hash,
          blockchain_resume_id: resume.blockchain_resume_id,
        },
        { status: 400 },
      )
    }

    const isDeveloperBuilt = resume.resume_type === 'developer_built'
    const isDriverBuilt = resume.resume_type === 'built'

    // Uploaded PDF already in storage — mark verified in DB
    if (!isDriverBuilt && !isDeveloperBuilt && hasStoredResumeFile(resume)) {
      const { error: upErr } = await supabase
        .from('resumes')
        .update({
          verification_status: 'VERIFIED',
          is_public: resume.is_public !== false,
        })
        .eq('id', id)

      if (upErr) {
        console.error('[VERIFY RESUME] DB update failed:', upErr)
        return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        resumeId: id,
        verified: true,
      })
    }

    if (!isDriverBuilt && !isDeveloperBuilt) {
      return NextResponse.json(
        {
          error:
            'This resume has no PDF on IPFS yet. Upload a PDF first, or build a resume in the builder to generate one for verification.',
        },
        { status: 400 },
      )
    }

    if (!resume.structured_data) {
      return NextResponse.json(
        {
          error:
            'Built and developer resumes need structured data before verification. Finish editing, then try again.',
        },
        { status: 400 },
      )
    }

    console.log('[VERIFY RESUME] Generating PDF from structured data...')

    const structuredData = resume.structured_data as Record<string, unknown>

    let pdfBuffer: Buffer

    if (isDeveloperBuilt) {
      pdfBuffer = generateDeveloperResumePDFBuffer(structuredData as unknown as DeveloperResumeData)
    } else {
      const schema = (structuredData as { schema?: string }).schema
      const isResumeBuilderFormat =
        schema === 'stormchain_resume_v1' ||
        (Array.isArray(structuredData.employments) &&
          structuredData.employments.length > 0 &&
          'companyName' in (structuredData.employments[0] as Record<string, unknown>))

      const hasResumeBuilderSkillsFormat =
        Array.isArray(structuredData.skills) &&
        structuredData.skills.length > 0 &&
        'name' in (structuredData.skills[0] as Record<string, unknown>)

      let resumeData

      if (isResumeBuilderFormat) {
        const pi = structuredData.personalInfo as Record<string, unknown> | undefined
        resumeData = {
          personalInfo: {
            firstName: pi?.firstName as string | undefined,
            lastName: pi?.lastName as string | undefined,
            headline: pi?.headline as string | undefined,
            email: pi?.email as string | undefined,
            phone: pi?.phone as string | undefined,
            address: pi?.address as string | undefined,
            city: pi?.city as string | undefined,
            state: pi?.state as string | undefined,
            zipCode: pi?.zipCode as string | undefined,
            professionalSummary: pi?.professionalSummary as string | undefined,
          },
          cdlInfo: {
            cdlClass: (structuredData.cdlInfo as Record<string, unknown>)?.cdlClass as string | undefined,
            cdlState: (structuredData.cdlInfo as Record<string, unknown>)?.cdlState as string | undefined,
            cdlExpiration: (structuredData.cdlInfo as Record<string, unknown>)?.expirationDate as string | undefined,
            endorsements: ((structuredData.cdlInfo as Record<string, unknown>)?.endorsements as string[]) || [],
          },
          employments: (structuredData.employments as Array<Record<string, unknown>> || []).map((emp) => ({
            companyName: emp.companyName as string | undefined,
            position: emp.position as string | undefined,
            location: emp.location as string | undefined,
            startDate: emp.startDate as string | undefined,
            endDate: emp.endDate as string | undefined,
            isCurrent: emp.isCurrent as boolean | undefined,
            responsibilities: (emp.responsibilities as string[]) || [],
          })),
          educations: (structuredData.educations as Array<Record<string, unknown>> || []).map((edu) => ({
            school: edu.school as string | undefined,
            degree: edu.degree as string | undefined,
            field: edu.field as string | undefined,
            year: edu.year as string | undefined,
            certifications: (edu.certifications as string[]) || [],
          })),
          skills: hasResumeBuilderSkillsFormat
            ? (structuredData.skills as Array<Record<string, unknown>> || []).map((skill) => ({
                name: skill.name as string | undefined,
                category: (skill.category || 'other') as
                  | 'equipment'
                  | 'route'
                  | 'technology'
                  | 'safety'
                  | 'other',
              }))
            : [],
          professionalCertifications: (
            (structuredData.professionalCertifications as Array<Record<string, unknown>>) || []
          ).map((c) => ({
            name: c.name as string | undefined,
            issuer: c.issuer as string | undefined,
            date: (c.issuedDate ?? c.date) as string | undefined,
            expiresDate: c.expiresDate as string | undefined,
          })),
          references: (structuredData.references as Array<Record<string, unknown>> || []).map((ref) => ({
            name: ref.name as string | undefined,
            title: ref.title as string | undefined,
            company: ref.company as string | undefined,
            phone: ref.phone as string | undefined,
            email: ref.email as string | undefined,
          })),
        }
      } else {
        const oldData = structuredData as StructuredResumeData
        resumeData = {
          personalInfo: {
            firstName: oldData.personalInfo?.firstName,
            lastName: oldData.personalInfo?.lastName,
            email: oldData.personalInfo?.email,
            phone: oldData.personalInfo?.phone,
            address: oldData.personalInfo?.address,
            city: oldData.personalInfo?.city,
            state: oldData.personalInfo?.state,
            zipCode: oldData.personalInfo?.zipCode,
            professionalSummary: oldData.personalInfo?.summary,
          },
          cdlInfo: {
            cdlClass: oldData.cdlInfo?.cdlClass,
            cdlState: oldData.cdlInfo?.cdlState,
            cdlExpiration: oldData.cdlInfo?.cdlExpiration,
            endorsements: oldData.cdlInfo?.endorsements || [],
          },
          employments: (oldData.employments || []).map((emp) => ({
            companyName: emp.company,
            position: emp.position,
            location: undefined,
            startDate: emp.startDate,
            endDate: emp.endDate,
            isCurrent: emp.current,
            responsibilities: emp.description ? [emp.description] : [],
          })),
          educations: (oldData.educations || []).map((edu) => ({
            school: edu.school,
            degree: edu.degree,
            field: edu.field,
            year: edu.graduationDate,
            certifications: [],
          })),
          skills: (oldData.skills || []).flatMap((skillGroup) =>
            (skillGroup.items || []).map((item) => ({
              name: item,
              category: (skillGroup.category || 'other') as
                | 'equipment'
                | 'route'
                | 'technology'
                | 'safety'
                | 'other',
            })),
          ),
          references: (oldData.references || []).map((ref) => ({
            name: ref.name,
            title: ref.relationship,
            company: ref.company,
            phone: ref.phone,
            email: ref.email,
          })),
        }
      }

      pdfBuffer = generateStyledResumePDF(resumeData)
    }

    console.log('[VERIFY RESUME] Uploading PDF to Supabase Storage...')

    const fileName = `${resume.title.replace(/[^a-z0-9]/gi, '_')}_Resume.pdf`
    const { storagePath } = await uploadDocument(
      userId,
      'resumes',
      pdfBuffer,
      fileName,
      'application/pdf',
    )
    const documentUrl = await getSignedDocumentUrl('resumes', storagePath)

    console.log('[VERIFY RESUME] Stored at:', storagePath)

    const { error: updateError } = await supabase
      .from('resumes')
      .update({
        storage_path: storagePath,
        ipfs_hash: null,
        ipfs_url: null,
        filename: fileName,
        file_size: pdfBuffer.length,
        mime_type: 'application/pdf',
        verification_status: 'VERIFIED',
        is_public: true,
      })
      .eq('id', id)

    if (updateError) {
      console.error('[VERIFY RESUME] Failed to update database:', updateError)
      return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 })
    }

    console.log('[VERIFY RESUME] Complete (DB verified, no on-chain registry)')

    return NextResponse.json({
      success: true,
      resumeId: id,
      storagePath,
      documentUrl,
      verified: true,
    })
  } catch (error) {
    console.error('[VERIFY RESUME] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to verify resume',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
