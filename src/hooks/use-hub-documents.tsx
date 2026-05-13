'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * Hub document fetch + verify/delete + preview modals (extracted from CandidateHub My Files).
 * Used by Construct mode inline block actions on the career card.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import { useInstalledBlocks } from '@/stores/hub-blocks-store'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { isLiveResumeIpfsHash } from '@/lib/resume-ipfs-guards'
import type { PageType } from '@/stores/types'
import type { HubDocument } from '@/lib/hub-document-types'
import { hubDocStatusFromScreeningOrder } from '@/lib/hub-document-types'
import type { PickedPendingEmployerScreening } from '@/lib/pending-employer-screening'
import MvrViewModal from '@/components/MvrViewModal'
import PspViewModal from '@/components/PspViewModal'
import DotAppPreviewModal from '@/components/career-card/DotAppPreviewModal'
import ResumeFilePreviewModal from '@/components/hub/ResumeFilePreviewModal'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import DeveloperResumePreviewModal from '@/components/DeveloperResumePreviewModal'
import type { DeveloperResumeData } from '@/components/DeveloperResumeBuilder'

export function useHubDocuments(refreshKey: number): {
  documents: HubDocument[]
  loading: boolean
  hubUserId: string | null
  refetch: () => void
  renderModals: () => ReactNode
  verifying: string | null
  deleting: string | null
  confirmDelete: string | null
  setConfirmDelete: (id: string | null) => void
  setMvrViewOrderId: (id: string | null) => void
  setPspViewOrderId: (id: string | null) => void
  setDotAppPreviewApplicationId: (id: string | null) => void
  setResumeFilePreview: (v: { title: string; url: string } | null) => void
  setDriverResumePreview: (v: { title: string; structuredData: Record<string, unknown> } | null) => void
  setDevResumePreview: (v: HubDocument | null) => void
  handleVerify: (doc: HubDocument) => void
  handleDelete: (doc: HubDocument) => void
  myFilesResumeCanView: (doc: HubDocument) => boolean
} {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const setEditingResumeId = useUIStore((s) => s.setEditingResumeId)
  const setStormResumeInitialPanel = useUIStore((s) => s.setStormResumeInitialPanel)
  const installedBlocks = useInstalledBlocks()

  const [documents, setDocuments] = useState<HubDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [mvrViewOrderId, setMvrViewOrderId] = useState<string | null>(null)
  const [pspViewOrderId, setPspViewOrderId] = useState<string | null>(null)
  const [hubUserId, setHubUserId] = useState<string | null>(null)
  const [dotAppPreviewApplicationId, setDotAppPreviewApplicationId] = useState<string | null>(null)
  const [driverResumePreview, setDriverResumePreview] = useState<{
    title: string
    structuredData: Record<string, unknown>
  } | null>(null)
  const [devResumePreview, setDevResumePreview] = useState<HubDocument | null>(null)
  const [resumeFilePreview, setResumeFilePreview] = useState<{ title: string; url: string } | null>(null)

  const hasResumeBlock = installedBlocks.some(
    (b) =>
      b.blockType === 'storm-resume' ||
      b.blockType === 'driver-resume' ||
      b.blockType === 'developer-resume' ||
      b.blockType === 'general-resume',
  )
  const hasDotAppBlock = installedBlocks.some((b) => b.blockType === 'driver-dot-application')
  const hasMvrBlock = installedBlocks.some((b) => b.blockType === 'driver-mvr')
  const hasPspBlock = installedBlocks.some((b) => b.blockType === 'driver-psp')
  const hasPortfolioBlock = installedBlocks.some((b) => b.blockType === 'developer-portfolio')
  const hasGithubBlock = installedBlocks.some((b) => b.blockType === 'developer-github')
  const hasEmploymentVerificationBlock = installedBlocks.some(
    (b) => b.blockType === 'general-employment-verification',
  )
  const needsHubData =
    hasResumeBlock || hasDotAppBlock || hasMvrBlock || hasPspBlock || hasPortfolioBlock || hasGithubBlock
  const hasAnyFileSectionBlock = needsHubData || hasEmploymentVerificationBlock

  const fetchDocuments = useCallback(async () => {
    if (!walletAddress || !hasAnyFileSectionBlock) {
      setLoading(false)
      return
    }

    try {
      const docs: HubDocument[] = []

      if (needsHubData) {
        const response = await fetch('/api/driver/hub', {
          headers: { 'x-wallet-address': walletAddress },
        })
        if (!response.ok) {
          setLoading(false)
          return
        }

        const data = await response.json()
        if (typeof data.userId === 'string') setHubUserId(data.userId)

        const pendingPick = data.pendingEmployerScreening as PickedPendingEmployerScreening | null | undefined

        const hasStormResumeBlock = installedBlocks.some((b) => b.blockType === 'storm-resume')
        const hasDriverResumeBlock = installedBlocks.some((b) => b.blockType === 'driver-resume')
        const hasDeveloperResumeBlock = installedBlocks.some((b) => b.blockType === 'developer-resume')
        const hasGeneralResumeBlock = installedBlocks.some((b) => b.blockType === 'general-resume')
        const allowDriverResume = hasDriverResumeBlock || hasStormResumeBlock
        const allowDeveloperResume = hasDeveloperResumeBlock || hasStormResumeBlock
        const allowGeneralResume = hasGeneralResumeBlock || hasStormResumeBlock

        if (hasResumeBlock && data.resumes) {
          for (const resume of data.resumes) {
            const role = resume.sourceRole as 'driver' | 'developer' | 'general' | undefined
            if (role === 'driver' && !allowDriverResume) continue
            if (role === 'developer' && !allowDeveloperResume) continue
            if (role === 'general' && !allowGeneralResume) continue
            if (role !== 'driver' && role !== 'developer' && role !== 'general') continue
            const isBuilt = resume.resumeType === 'built' || resume.resumeType === 'developer_built'
            const uploadedCanVerify =
              !isBuilt && !resume.blockchainTxHash && isLiveResumeIpfsHash(resume.ipfsHash ?? null)
            docs.push({
              id: resume.id,
              type: 'resume',
              title: resume.title || 'Resume',
              status: 'complete',
              createdAt: resume.createdAt,
              verified: !!resume.blockchainTxHash,
              txHash: resume.blockchainTxHash,
              canVerify: Boolean(
                !resume.blockchainTxHash && ((isBuilt && resume.structuredData) || uploadedCanVerify),
              ),
              canDelete: true,
              editPage: hasStormResumeBlock
                ? 'storm-resume'
                : role === 'developer'
                  ? 'developer-resume'
                  : role === 'general'
                    ? 'general-resume'
                    : 'resume',
              ipfsHash: resume.ipfsHash ?? null,
              structuredData: resume.structuredData ?? null,
              resumeSourceRole: role,
            })
          }
        }

        const resumeRows = docs.filter((d) => d.type === 'resume').length
        if (hasResumeBlock && resumeRows === 0) {
          const editPage: PageType = hasStormResumeBlock
            ? 'storm-resume'
            : hasDriverResumeBlock
              ? 'resume'
              : hasGeneralResumeBlock
                ? 'general-resume'
                : 'developer-resume'
          const resumeSourceRole: 'driver' | 'developer' | 'general' = hasStormResumeBlock
            ? 'general'
            : hasDriverResumeBlock
              ? 'driver'
              : hasGeneralResumeBlock
                ? 'general'
                : 'developer'
          docs.push({
            id: 'resume-hub-placeholder',
            type: 'resume',
            title: 'Resume',
            status: 'empty',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            editPage,
            ipfsHash: null,
            structuredData: null,
            resumeSourceRole,
            stormResumeInitialPanel: hasStormResumeBlock ? 'upload' : undefined,
          })
        }

        if (hasDotAppBlock && data.dotApplications) {
          for (const app of data.dotApplications) {
            const complete = !!app.isComplete
            docs.push({
              id: app.id,
              type: 'dotapp',
              title: 'DOT Application',
              status: complete ? 'complete' : 'in-progress',
              verified: !!app.blockchainTxHash,
              txHash: app.blockchainTxHash,
              canVerify: !!complete && !app.blockchainTxHash,
              canDelete: !app.blockchainTxHash,
              editPage: 'dotapp',
            })
          }
        }

        if (hasDotAppBlock && (!data.dotApplications || data.dotApplications.length === 0)) {
          docs.push({
            id: 'dotapp-hub-placeholder',
            type: 'dotapp',
            title: 'DOT Application',
            status: 'empty',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            editPage: 'dotapp',
          })
        }

        if (hasMvrBlock && data.mvrRecords) {
          for (const mvr of data.mvrRecords) {
            const isComplete = mvr.orderStatus === 'completed' || mvr.orderStatus === 'needs_review'
            docs.push({
              id: mvr.id,
              type: 'mvr',
              title: 'Motor Vehicle Record',
              subtitle: mvr.licenseState,
              createdAt: mvr.orderedAt || mvr.createdAt,
              status: isComplete ? 'complete' : hubDocStatusFromScreeningOrder(mvr.orderStatus),
              verified: false,
              txHash: null,
              canVerify: false,
              canDelete: false,
              editPage: isComplete ? null : 'mvr',
              employerPaidScreening: Boolean(mvr.employerPaidScreening),
            })
          }
        }

        if (hasMvrBlock && (!data.mvrRecords || data.mvrRecords.length === 0)) {
          const mvrPending =
            pendingPick?.mode === 'psp_mvr_bundle'
              ? {
                  requestId: pendingPick.requestId,
                  companyName: pendingPick.companyName,
                  bundledWithBlockType: 'driver-psp' as const,
                }
              : pendingPick?.mode === 'mvr_standalone'
                ? { requestId: pendingPick.requestId, companyName: pendingPick.companyName }
                : undefined
          docs.push({
            id: 'mvr-hub-placeholder',
            type: 'mvr',
            title: 'Motor Vehicle Record',
            subtitle: 'Not ordered yet',
            status: 'empty',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            editPage: 'mvr',
            pendingEmployerRequest: mvrPending,
          })
        }

        if (hasPspBlock && data.pspRecords) {
          for (const psp of data.pspRecords) {
            const isComplete = psp.orderStatus === 'completed' || psp.orderStatus === 'needs_review'
            docs.push({
              id: psp.id,
              type: 'psp',
              title: 'PSP Report',
              subtitle: psp.licenseState,
              createdAt: psp.orderedAt || psp.createdAt,
              status: isComplete ? 'complete' : hubDocStatusFromScreeningOrder(psp.orderStatus),
              verified: false,
              txHash: null,
              canVerify: false,
              canDelete: false,
              editPage: isComplete ? null : 'psp',
              employerPaidScreening: Boolean(psp.employerPaidScreening),
            })
          }
        }

        if (hasPspBlock && (!data.pspRecords || data.pspRecords.length === 0)) {
          const pspPending =
            pendingPick?.mode === 'psp_mvr_bundle'
              ? { requestId: pendingPick.requestId, companyName: pendingPick.companyName }
              : undefined
          docs.push({
            id: 'psp-hub-placeholder',
            type: 'psp',
            title: 'PSP Report',
            subtitle: 'Not ordered yet',
            status: 'empty',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            editPage: 'psp',
            pendingEmployerRequest: pspPending,
          })
        }

        if (hasPortfolioBlock) {
          const portfolioUrl = data.portfolio?.portfolioUrl ?? null
          docs.push({
            id: 'portfolio',
            type: 'portfolio',
            title: 'Portfolio',
            status: portfolioUrl ? 'complete' : 'in-progress',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            editPage: 'portfolio',
            portfolioUrl,
          })
        }

        if (hasGithubBlock) {
          const username = data.github?.username ?? null
          docs.push({
            id: 'github',
            type: 'github',
            title: 'GitHub Activity',
            status: username ? 'complete' : 'in-progress',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            editPage: 'github',
            githubUsername: username,
          })
        }
      }

      if (hasEmploymentVerificationBlock && walletAddress) {
        const vr = await fetch('/api/candidate/verification/status?initiatedBy=applicant', {
          headers: { 'x-wallet-address': walletAddress },
        })
        if (vr.ok) {
          const j = (await vr.json()) as { requests?: Array<{ status: string }> }
          const reqs = j.requests ?? []
          const verified = reqs.filter(
            (r) => r.status === 'VERIFIED' || r.status === 'PARTIALLY_VERIFIED',
          ).length
          const pending = reqs.filter((r) =>
            ['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'].includes(r.status),
          ).length
          docs.push({
            id: 'employment-verifications',
            type: 'employment_verifications',
            title: 'Employment verifications',
            subtitle: `${verified} verified · ${pending} pending`,
            status: pending > 0 ? 'in-progress' : 'complete',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            editPage: 'employment-verification',
          })
        }
      }

      setDocuments(docs)
    } catch (err) {
      console.error('[useHubDocuments] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [
    walletAddress,
    hasResumeBlock,
    hasDotAppBlock,
    hasMvrBlock,
    hasPspBlock,
    hasPortfolioBlock,
    hasGithubBlock,
    hasEmploymentVerificationBlock,
    needsHubData,
    hasAnyFileSectionBlock,
    installedBlocks,
  ])

  useEffect(() => {
    void fetchDocuments()
  }, [fetchDocuments, refreshKey])

  const handleVerify = async (doc: HubDocument) => {
    if (!walletAddress || !doc.canVerify) return
    setVerifying(doc.id)
    try {
      const endpoint =
        doc.type === 'resume' ? `/api/resumes/${doc.id}/verify` : `/api/driver-applications/${doc.id}/verify`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
      })
      const data = await response.json()
      if (!response.ok && response.status !== 409) {
        throw new Error(data.error || 'Verification failed')
      }
      const txHash = data.txHash || data.transactionHash
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id ? { ...d, verified: true, canVerify: false, txHash: txHash || d.txHash } : d,
        ),
      )
      void syncDriverHubFromApi(walletAddress)
    } catch (err) {
      console.error('[useHubDocuments] verify:', err)
    } finally {
      setVerifying(null)
    }
  }

  const handleDelete = async (doc: HubDocument) => {
    if (!walletAddress || doc.type === 'employment_verifications') return
    setDeleting(doc.id)
    setConfirmDelete(null)
    try {
      const endpoint = doc.type === 'resume' ? `/api/resumes/${doc.id}` : `/api/driver-applications/${doc.id}`
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'x-wallet-address': walletAddress },
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete')
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      void syncDriverHubFromApi(walletAddress)
    } catch (err) {
      console.error('[useHubDocuments] delete:', err)
    } finally {
      setDeleting(null)
    }
  }

  const myFilesResumeCanView = (doc: HubDocument) => {
    if (doc.type !== 'resume') return false
    const ipfs = isLiveResumeIpfsHash(doc.ipfsHash ?? undefined)
    const sd = doc.structuredData
    const built = sd != null && typeof sd === 'object' && Object.keys(sd as object).length > 0
    return ipfs || built
  }

  const renderModals = () => (
    <>
      <MvrViewModal
        isOpen={mvrViewOrderId !== null}
        onClose={() => setMvrViewOrderId(null)}
        walletAddress={walletAddress ?? ''}
        orderId={mvrViewOrderId}
      />
      <PspViewModal
        isOpen={pspViewOrderId !== null}
        onClose={() => setPspViewOrderId(null)}
        walletAddress={walletAddress ?? ''}
        orderId={pspViewOrderId}
      />
      <DotAppPreviewModal
        isOpen={dotAppPreviewApplicationId !== null}
        onClose={() => setDotAppPreviewApplicationId(null)}
        userId={hubUserId}
        walletAddress={walletAddress ?? ''}
        isDark={isDark}
        applicationId={dotAppPreviewApplicationId}
      />
      {resumeFilePreview && (
        <ResumeFilePreviewModal
          isOpen
          onClose={() => setResumeFilePreview(null)}
          title={resumeFilePreview.title}
          ipfsUrl={resumeFilePreview.url}
          isDark={isDark}
        />
      )}
      {driverResumePreview && (
        <ResumePreviewModal
          title={driverResumePreview.title}
          structuredData={
            driverResumePreview.structuredData as Parameters<typeof ResumePreviewModal>[0]['structuredData']
          }
          onClose={() => setDriverResumePreview(null)}
          theme={isDark ? 'dark' : 'light'}
          zIndex={10100}
        />
      )}
      {devResumePreview && walletAddress && (
        <DeveloperResumePreviewModal
          viewOnly
          resume={{
            id: devResumePreview.id,
            title: devResumePreview.title,
            structured_data: devResumePreview.structuredData as DeveloperResumeData,
            verification_status: devResumePreview.verified ? 'VERIFIED' : 'PENDING',
            blockchain_tx_hash: devResumePreview.txHash ?? undefined,
            ipfs_hash: devResumePreview.ipfsHash ?? undefined,
            created_at: devResumePreview.createdAt ?? new Date().toISOString(),
          }}
          onClose={() => setDevResumePreview(null)}
          onEdit={() => {}}
          onVerify={() => {}}
          onDelete={() => {}}
          userAddress={walletAddress}
        />
      )}
    </>
  )

  return {
    documents,
    loading,
    hubUserId,
    refetch: fetchDocuments,
    renderModals,
    verifying,
    deleting,
    confirmDelete,
    setConfirmDelete,
    setMvrViewOrderId,
    setPspViewOrderId,
    setDotAppPreviewApplicationId,
    setResumeFilePreview,
    setDriverResumePreview,
    setDevResumePreview,
    handleVerify,
    handleDelete,
    myFilesResumeCanView,
  }
}

export type HubDocumentsHandle = ReturnType<typeof useHubDocuments>
