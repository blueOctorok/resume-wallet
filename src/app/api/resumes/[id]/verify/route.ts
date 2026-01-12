// app/api/resumes/[id]/verify/route.ts
// One-click blockchain verification for built resumes
// Flow: Generate PDF → Upload to IPFS → Record on blockchain → Update database

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { jsPDF } from 'jspdf'
import { PinataSDK } from 'pinata-web3'
import { ethers } from 'ethers'

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
    const walletAddress = req.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔐 Verify Resume API: Starting verification for resume:', id)

    const supabase = await getAdminSupabaseClient()

    // 1. Verify user owns this resume
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 2. Get the resume with structured data
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
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

    // Check if this is a built resume with structured data
    if (resume.resume_type !== 'built' || !resume.structured_data) {
      return NextResponse.json({ 
        error: 'Only built resumes with structured data can be verified this way. For uploaded resumes, use the standard upload flow.' 
      }, { status: 400 })
    }

    console.log('📄 Verify Resume API: Generating PDF from structured data...')

    // 3. Generate PDF from structured data
    const pdfBuffer = generatePDFFromStructuredData(resume.structured_data as StructuredResumeData, resume.title)
    
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

/**
 * Generate a PDF from structured resume data
 * Returns a Buffer containing the PDF
 */
function generatePDFFromStructuredData(data: StructuredResumeData, title: string): Buffer {
  const pdf = new jsPDF()
  let y = 20

  // Helper to add text with word wrap
  const addText = (text: string, x: number, maxWidth: number, fontSize: number = 10) => {
    pdf.setFontSize(fontSize)
    const lines = pdf.splitTextToSize(text, maxWidth)
    pdf.text(lines, x, y)
    y += lines.length * (fontSize * 0.4) + 2
  }

  // Header - Name
  const fullName = `${data.personalInfo?.firstName || ''} ${data.personalInfo?.lastName || ''}`.trim() || title
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text(fullName, 105, y, { align: 'center' })
  y += 10

  // Contact info
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  const contactParts = [
    data.personalInfo?.email,
    data.personalInfo?.phone,
    [data.personalInfo?.city, data.personalInfo?.state].filter(Boolean).join(', ')
  ].filter(Boolean)
  if (contactParts.length > 0) {
    pdf.text(contactParts.join(' | '), 105, y, { align: 'center' })
    y += 8
  }

  // Summary
  if (data.personalInfo?.summary) {
    y += 5
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('PROFESSIONAL SUMMARY', 20, y)
    y += 6
    pdf.setFont('helvetica', 'normal')
    addText(data.personalInfo.summary, 20, 170, 10)
  }

  // CDL Info
  if (data.cdlInfo?.cdlClass) {
    y += 5
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('CDL INFORMATION', 20, y)
    y += 6
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    const cdlParts = [
      `Class ${data.cdlInfo.cdlClass}`,
      data.cdlInfo.cdlState,
      data.cdlInfo.cdlExpiration ? `Expires: ${data.cdlInfo.cdlExpiration}` : null,
      data.cdlInfo.endorsements?.length ? `Endorsements: ${data.cdlInfo.endorsements.join(', ')}` : null
    ].filter(Boolean)
    pdf.text(cdlParts.join(' | '), 20, y)
    y += 6
  }

  // Employment
  if (data.employments && data.employments.length > 0) {
    y += 5
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('EMPLOYMENT HISTORY', 20, y)
    y += 6
    
    for (const job of data.employments) {
      if (y > 270) { pdf.addPage(); y = 20 }
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(job.position || 'Position', 20, y)
      y += 5
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const jobLine = [job.company, `${job.startDate || ''} - ${job.current ? 'Present' : job.endDate || ''}`].filter(Boolean).join(' | ')
      pdf.text(jobLine, 20, y)
      y += 5
      if (job.description) {
        addText(job.description, 20, 170, 9)
      }
      y += 3
    }
  }

  // Education
  if (data.educations && data.educations.length > 0) {
    y += 5
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('EDUCATION', 20, y)
    y += 6
    
    for (const edu of data.educations) {
      if (y > 270) { pdf.addPage(); y = 20 }
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const eduLine = [edu.degree, edu.field, edu.school, edu.graduationDate].filter(Boolean).join(' | ')
      pdf.text(eduLine, 20, y)
      y += 5
    }
  }

  // Skills
  if (data.skills && data.skills.length > 0) {
    y += 5
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('SKILLS', 20, y)
    y += 6
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    
    for (const skillGroup of data.skills) {
      if (y > 270) { pdf.addPage(); y = 20 }
      const skillLine = `${skillGroup.category}: ${skillGroup.items?.join(', ') || ''}`
      addText(skillLine, 20, 170, 10)
    }
  }

  // References
  if (data.references && data.references.length > 0) {
    y += 5
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('REFERENCES', 20, y)
    y += 6
    
    for (const ref of data.references) {
      if (y > 270) { pdf.addPage(); y = 20 }
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`${ref.name || 'Reference'} - ${ref.relationship || ''}`, 20, y)
      y += 4
      const refDetails = [ref.company, ref.phone, ref.email].filter(Boolean).join(' | ')
      if (refDetails) {
        pdf.text(refDetails, 20, y)
        y += 5
      }
    }
  }

  // Footer with verification note
  pdf.setFontSize(8)
  pdf.setTextColor(128, 128, 128)
  pdf.text('This resume has been verified and recorded on the Base blockchain via Veree.', 105, 285, { align: 'center' })

  // Return as Buffer
  const pdfOutput = pdf.output('arraybuffer')
  return Buffer.from(pdfOutput)
}
