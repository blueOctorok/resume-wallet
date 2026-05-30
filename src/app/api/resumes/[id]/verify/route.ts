// app/api/resumes/[id]/verify/route.ts
// One-click blockchain verification for built resumes
// Flow: Generate PDF → Upload to IPFS → Record on blockchain → Update database

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { PinataSDK } from 'pinata-web3'
import { ethers } from 'ethers'
import { generateStyledResumePDF } from '@/lib/resume-pdf-generator'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { addResumeOnChain } from '@/lib/resume-registry-onchain'
import { isLiveResumeIpfsHash } from '@/lib/resume-ipfs-guards'
import { generateDeveloperResumePDFBuffer } from '@/lib/developer-resume-pdf'
import type { DeveloperResumeData } from '@/components/DeveloperResumeBuilder'

// Contract ABI for adding resume
const RESUME_REGISTRY_ABI = [
  'function addResume(string memory _ipfsHash, string memory _title, string memory _filename, bool _isPublic) external returns (uint256)',
  'function resumeCount() external view returns (uint256)',
]

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

    console.log('🔐 Verify Resume API: Starting verification for resume:', id)

    const supabase = await getAdminSupabaseClient()

    // 2. Get the resume with structured data
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (resumeError || !resume) {
      return NextResponse.json({ error: 'Resume not found or access denied' }, { status: 404 })
    }

    // Check if already verified
    if (resume.verification_status === 'VERIFIED') {
      return NextResponse.json({ 
        error: 'Resume is already verified on blockchain',
        blockchain_tx_hash: resume.blockchain_tx_hash,
        blockchain_resume_id: resume.blockchain_resume_id
      }, { status: 400 })
    }

    const isDeveloperBuilt = resume.resume_type === 'developer_built'
    const isDriverBuilt = resume.resume_type === 'built'

    // ── Uploaded PDF: IPFS hash already set — register on-chain (same as /api/blockchain/verify-resume)
    if (!isDriverBuilt && !isDeveloperBuilt && isLiveResumeIpfsHash(resume.ipfs_hash)) {
      let chain: Awaited<ReturnType<typeof addResumeOnChain>>
      try {
        chain = await addResumeOnChain({
          ipfsHash: resume.ipfs_hash as string,
          title: String(resume.title || 'Resume'),
          filename: String(resume.filename || 'resume.pdf'),
          isPublic: resume.is_public !== false,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        if (msg === 'RESUME_REGISTRY_NOT_CONFIGURED') {
          return NextResponse.json(
            {
              error: 'Blockchain verification is not configured on this server',
              partial: true,
            },
            { status: 503 },
          )
        }
        console.error('[VERIFY RESUME] uploaded IPFS path:', e)
        return NextResponse.json(
          { error: 'On-chain verification failed', details: msg },
          { status: 500 },
        )
      }

      const { error: upErr } = await supabase
        .from('resumes')
        .update({
          verification_status: 'VERIFIED',
          blockchain_tx_hash: chain.txHash,
          blockchain_resume_id: chain.blockchainResumeId,
          is_public: resume.is_public !== false,
        })
        .eq('id', id)

      if (upErr) {
        console.error('[VERIFY RESUME] DB update failed:', upErr)
      }

      return NextResponse.json({
        success: true,
        resumeId: id,
        transactionHash: chain.txHash,
        txHash: chain.txHash,
        blockchainResumeId: chain.blockchainResumeId,
        blockNumber: String(chain.blockNumber),
        gasUsed: chain.gasUsed,
        explorerUrl: chain.explorerUrl,
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

    console.log('📄 Verify Resume API: Generating PDF from structured data...')

    const structuredData = resume.structured_data as Record<string, unknown>

    let pdfBuffer: Buffer

    if (isDeveloperBuilt) {
      pdfBuffer = generateDeveloperResumePDFBuffer(structuredData as unknown as DeveloperResumeData)
    } else {
      // 3. Generate styled PDF from structured data (driver / general builder)
      // General resume (and future builders) set schema so we PDF-map even with zero jobs.
      const schema = (structuredData as { schema?: string }).schema
      // Detect format: Resume Builder format has `employments` with `companyName`,
      // old format (from uploaded resumes) has `employments` with `company`
      const isResumeBuilderFormat =
        schema === 'stormchain_resume_v1' ||
        (Array.isArray(structuredData.employments) &&
          structuredData.employments.length > 0 &&
          'companyName' in (structuredData.employments[0] as Record<string, unknown>))

      // Detect if skills are in Resume Builder format (array of {name, category})
      // vs old format (array of {category, items[]})
      const hasResumeBuilderSkillsFormat =
        Array.isArray(structuredData.skills) &&
        structuredData.skills.length > 0 &&
        'name' in (structuredData.skills[0] as Record<string, unknown>)

      let resumeData

      if (isResumeBuilderFormat) {
        // Resume Builder format - data is already in the correct shape
        console.log('📄 Detected Resume Builder format')
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
            : [], // Will be converted from old format below
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
        // Old format from uploaded/analyzed resumes - needs mapping
        console.log('📄 Detected old StructuredResumeData format, mapping to Resume Builder format')
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
    
    // 4. Upload to IPFS via Pinata
    console.log('📤 Verify Resume API: Uploading to IPFS...')
    
    const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT
    const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY

    if (!pinataJwt || !pinataGateway) {
      return NextResponse.json({ error: 'IPFS configuration missing' }, { status: 500 })
    }

    const pinata = new PinataSDK({
      pinataJwt,
      pinataGateway,
    })

    // Convert buffer to File for Pinata upload
    const fileName = `${resume.title.replace(/[^a-z0-9]/gi, '_')}_Resume.pdf`
    const pdfFile = new File([pdfBuffer], fileName, { type: 'application/pdf' })
    
    const uploadResult = await pinata.upload.file(pdfFile)
    const ipfsHash = uploadResult.IpfsHash
    const ipfsUrl = `${pinataGateway}/ipfs/${ipfsHash}`

    console.log('✅ Verify Resume API: Uploaded to IPFS:', ipfsHash)

    // 5. Add to blockchain
    console.log('⛓️ Verify Resume API: Recording on blockchain...')

    const contractAddress = process.env.NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS
    const rpcUrl = process.env.ALCHEMY_BASE_SEPOLIA_URL
    const privateKey = process.env.PRIVATE_KEY

    if (!contractAddress || !rpcUrl || !privateKey) {
      // If blockchain config is missing, still save IPFS data but mark as pending blockchain
      console.warn('⚠️ Blockchain configuration missing, saving IPFS only')
      
      await supabase
        .from('resumes')
        .update({
          ipfs_hash: ipfsHash,
          ipfs_url: ipfsUrl,
          filename: fileName,
          file_size: pdfBuffer.length,
          mime_type: 'application/pdf',
          verification_status: 'PENDING', // Still pending blockchain
        })
        .eq('id', id)

      return NextResponse.json({
        success: true,
        partial: true,
        message: 'Resume uploaded to IPFS but blockchain recording is not configured',
        ipfsHash,
        ipfsUrl,
      })
    }

    // Create provider and signer
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const signer = new ethers.Wallet(privateKey, provider)
    const contract = new ethers.Contract(contractAddress, RESUME_REGISTRY_ABI, signer)

    // Get current resume count for new ID
    const currentCount = await contract.resumeCount()
    const newResumeId = currentCount + BigInt(1)

    // Add to blockchain
    const tx = await contract.addResume(
      ipfsHash,
      resume.title,
      fileName,
      true // isPublic
    )

    console.log('⏳ Verify Resume API: Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('✅ Verify Resume API: Transaction confirmed!')

    // 6. Update database with all verification data
    const { error: updateError } = await supabase
      .from('resumes')
      .update({
        ipfs_hash: ipfsHash,
        ipfs_url: ipfsUrl,
        filename: fileName,
        file_size: pdfBuffer.length,
        mime_type: 'application/pdf',
        verification_status: 'VERIFIED',
        blockchain_tx_hash: tx.hash,
        blockchain_resume_id: newResumeId.toString(),
        is_public: true,
      })
      .eq('id', id)

    if (updateError) {
      console.error('⚠️ Verify Resume API: Failed to update database:', updateError)
      // Don't fail - blockchain tx is permanent
    }

    console.log('✅ Verify Resume API: Complete!')

    return NextResponse.json({
      success: true,
      resumeId: id,
      ipfsHash,
      ipfsUrl,
      transactionHash: tx.hash,
      txHash: tx.hash,
      blockchainResumeId: newResumeId.toString(),
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: `https://sepolia.basescan.org/tx/${tx.hash}`,
    })

  } catch (error) {
    console.error('❌ Verify Resume API: Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to verify resume', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// Note: PDF generation is now handled by the shared utility in @/lib/resume-pdf-generator
// This ensures consistent styling between ResumeBuilder export and verification upload
