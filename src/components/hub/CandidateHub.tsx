'use client'

import Image from 'next/image'
import { useEffect, useCallback, useState, useRef, type ReactNode } from 'react'
import {
  Plus,
  Loader2,
  AlertCircle,
  Eye,
  Pencil,
  Check,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  ClipboardCheck,
  Car,
  Trash2,
  Globe,
  Github,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore, usePreferencesStore } from '@/stores'
import type { PageType } from '@/stores/types'
import {
  useHubBlocksStore,
  useInstalledBlocks,
  useNeedsOnboarding,
  useStormiAutoWelcomeCandidateDone,
} from '@/stores/hub-blocks-store'
import { getBlockDefinition } from '@/lib/block-registry'
import Button from '@/components/ui/Button'
import BlockCard from '@/components/ui/BlockCard'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import HubOnboardingForm from './HubOnboardingForm'
import BlockPickerModal from './BlockPickerModal'
import StormiContextModal from './StormiContextModal'
import MvrViewModal from '@/components/MvrViewModal'
import DotAppPreviewModal from '@/components/career-card/DotAppPreviewModal'
import ResumeFilePreviewModal from '@/components/hub/ResumeFilePreviewModal'
import { downloadDriverResumePdfFromStructured } from '@/lib/driver-resume-pdf-download'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { useHubContext } from '@/lib/ava-chat'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import StormiChatPanel from '@/components/stormi/StormiChatPanel'
import StormiNudgeBanner from '@/components/stormi/StormiNudgeBanner'
import DeveloperResumePreviewModal from '@/components/DeveloperResumePreviewModal'
import type { DeveloperResumeData } from '@/components/DeveloperResumeBuilder'
import { isLiveResumeIpfsHash } from '@/lib/resume-ipfs-guards'
import HubWorkspaceCareerCard from '@/components/hub/HubWorkspaceCareerCard'
import HubInboxSection from '@/components/hub/HubInboxSection'
import HubAccountSection from '@/components/hub/HubAccountSection'

/** Icon-only expand/collapse for hub BlockCard headers (preference lives in `usePreferencesStore`). */
function HubSectionCollapseToggle({
  expanded,
  onToggle,
  sectionLabel,
  isDark,
}: {
  expanded: boolean
  onToggle: () => void
  sectionLabel: string
  isDark: boolean
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className={cn(
        'shrink-0 px-2',
        isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-800',
      )}
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${sectionLabel}` : `Expand ${sectionLabel}`}
      onClick={onToggle}
    >
      {expanded ? <ChevronUp className='h-4 w-4' aria-hidden /> : <ChevronDown className='h-4 w-4' aria-hidden />}
    </Button>
  )
}

// ── Block Files ───────────────────────────────────────────────────────────────
// Started or completed files: View (read-only), Edit, Verify (until on-chain), Delete.

function myFilesResumeCanView(doc: {
  type: string
  ipfsHash?: string | null
  structuredData?: unknown | null
}) {
  if (doc.type !== 'resume') return false
  const h = doc.ipfsHash
  const ipfs = isLiveResumeIpfsHash(h ?? undefined)
  const sd = doc.structuredData
  const built = sd != null && typeof sd === 'object' && Object.keys(sd as object).length > 0
  return ipfs || built
}

interface HubDocument {
  id: string
  type: 'resume' | 'dotapp' | 'mvr' | 'portfolio' | 'github' | 'employment_verifications'
  title: string
  subtitle?: string
  createdAt?: string
  /** `empty` = block installed but no artifact yet (show in My Files immediately) */
  status: 'complete' | 'in-progress' | 'processing' | 'empty'
  verified: boolean
  txHash: string | null
  canVerify: boolean
  canDelete: boolean
  editPage: PageType | null
  ipfsHash?: string | null
  structuredData?: unknown | null
  resumeSourceRole?: 'driver' | 'developer' | 'general'
  /** Set when type === 'portfolio' — opens in new tab for View */
  portfolioUrl?: string | null
  /** Set when type === 'github' — link to profile */
  githubUsername?: string | null
  /** When opening STORM Resume from My Files — default tab */
  stormResumeInitialPanel?: 'upload' | 'general' | 'driver' | 'developer'
}

function MyFilesSection({ refreshKey }: { refreshKey: number }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const setEditingResumeId = useUIStore((s) => s.setEditingResumeId)
  const setStormResumeInitialPanel = useUIStore((s) => s.setStormResumeInitialPanel)
  const installedBlocks = useInstalledBlocks()
  const hubBlockFilesExpanded = usePreferencesStore((s) => s.hubBlockFilesExpanded ?? true)
  const setHubBlockFilesExpanded = usePreferencesStore((s) => s.setHubBlockFilesExpanded)

  const [documents, setDocuments] = useState<HubDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  /** Completed MVR: open viewer modal instead of the order form. */
  const [mvrViewOrderId, setMvrViewOrderId] = useState<string | null>(null)
  /** Completed DOT app: preview modal (hub returns userId for dot-app API). */
  const [hubUserId, setHubUserId] = useState<string | null>(null)
  /** Specific DOT application row for My Files preview (multi-app safe) */
  const [dotAppPreviewApplicationId, setDotAppPreviewApplicationId] = useState<string | null>(null)
  const [driverResumePreview, setDriverResumePreview] = useState<{
    title: string
    structuredData: Record<string, unknown>
  } | null>(null)
  const [devResumePreview, setDevResumePreview] = useState<HubDocument | null>(null)
  const [resumeFilePreview, setResumeFilePreview] = useState<{ title: string; url: string } | null>(null)
  const [resumePdfLoading, setResumePdfLoading] = useState(false)

  const hasResumeBlock = installedBlocks.some((b) =>
    b.blockType === 'storm-resume' ||
    b.blockType === 'driver-resume' ||
    b.blockType === 'developer-resume' ||
    b.blockType === 'general-resume'
  )
  const hasDotAppBlock = installedBlocks.some((b) => b.blockType === 'driver-dot-application')
  const hasMvrBlock = installedBlocks.some((b) => b.blockType === 'driver-mvr')
  const hasPortfolioBlock = installedBlocks.some((b) => b.blockType === 'developer-portfolio')
  const hasGithubBlock = installedBlocks.some((b) => b.blockType === 'developer-github')
  const hasEmploymentVerificationBlock = installedBlocks.some(
    (b) => b.blockType === 'general-employment-verification',
  )
  const needsHubData =
    hasResumeBlock || hasDotAppBlock || hasMvrBlock || hasPortfolioBlock || hasGithubBlock
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
      if (!response.ok) { setLoading(false); return }

      const data = await response.json()
      if (typeof data.userId === 'string') setHubUserId(data.userId)

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
          const isBuilt =
            resume.resumeType === 'built' || resume.resumeType === 'developer_built'
          const uploadedCanVerify =
            !isBuilt &&
            !resume.blockchainTxHash &&
            isLiveResumeIpfsHash(resume.ipfsHash ?? null)
          docs.push({
            id: resume.id,
            type: 'resume',
            title: resume.title || 'Resume',
            status: 'complete',
            createdAt: resume.createdAt,
            verified: !!resume.blockchainTxHash,
            txHash: resume.blockchainTxHash,
            canVerify: Boolean(
              !resume.blockchainTxHash &&
                ((isBuilt && resume.structuredData) || uploadedCanVerify),
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

      // Resume block installed but no resume row yet — same pattern as portfolio/GitHub placeholders
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
            // View = preview modal; Edit = form (same page for completed + in-progress)
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

      // MVR orders — processing until completed
      if (hasMvrBlock && data.mvrRecords) {
        for (const mvr of data.mvrRecords) {
          const isComplete = mvr.orderStatus === 'completed' || mvr.orderStatus === 'needs_review'
          docs.push({
            id: mvr.id,
            type: 'mvr',
            title: 'Motor Vehicle Record',
            subtitle: mvr.licenseState,
            status: isComplete ? 'complete' : 'processing',
            verified: false,
            txHash: null,
            canVerify: false,
            canDelete: false,
            // Completed MVRs open MvrViewModal from My Files; form page is for new orders only
            editPage: isComplete ? null : 'mvr',
          })
        }
      }

      if (hasMvrBlock && (!data.mvrRecords || data.mvrRecords.length === 0)) {
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
        })
      }

      // Portfolio block — one row when user has the block (URL set = complete, else in-progress)
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

      // GitHub block — one row when user has the block (connected = complete, else in-progress)
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

      if (hasEmploymentVerificationBlock) {
        const vr = await fetch('/api/candidate/verification/status?initiatedBy=applicant', {
          headers: { 'x-wallet-address': walletAddress },
        })
        if (vr.ok) {
          const j = (await vr.json()) as {
            requests?: Array<{ status: string }>
          }
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
      console.error('MyFilesSection fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [
    walletAddress,
    hasResumeBlock,
    hasDotAppBlock,
    hasMvrBlock,
    hasPortfolioBlock,
    hasGithubBlock,
    hasEmploymentVerificationBlock,
    needsHubData,
    hasAnyFileSectionBlock,
    installedBlocks,
  ])

  // `refreshKey` is incremented externally to trigger a manual re-fetch
  useEffect(() => { fetchDocuments() }, [fetchDocuments, refreshKey])

  const handleVerify = async (doc: HubDocument) => {
    if (!walletAddress || !doc.canVerify) return
    setVerifying(doc.id)
    setMessage({ type: 'success', text: 'Submitting to blockchain...' })

    try {
      const endpoint = doc.type === 'resume'
        ? `/api/resumes/${doc.id}/verify`
        : `/api/driver-applications/${doc.id}/verify`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
      })
      const data = await response.json()

      if (!response.ok && response.status !== 409) {
        throw new Error(data.error || 'Verification failed')
      }

      const txHash = data.txHash || data.transactionHash
      setMessage({ type: 'success', text: txHash ? `Verified! Tx: ${txHash.slice(0, 10)}...` : 'Already verified on blockchain' })
      setDocuments((prev) => prev.map((d) =>
        d.id === doc.id ? { ...d, verified: true, canVerify: false, txHash: txHash || d.txHash } : d
      ))
      setTimeout(() => setMessage(null), 5000)
      void syncDriverHubFromApi(walletAddress)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Verification failed' })
    } finally {
      setVerifying(null)
    }
  }

  const handleDelete = async (doc: HubDocument) => {
    if (!walletAddress || doc.type === 'employment_verifications') return
    setDeleting(doc.id)
    setConfirmDelete(null)

    try {
      const endpoint = doc.type === 'resume'
        ? `/api/resumes/${doc.id}`
        : `/api/driver-applications/${doc.id}`

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
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' })
    } finally {
      setDeleting(null)
    }
  }

  const inProgressCount = documents.filter(
    (d) =>
      d.status === 'in-progress' ||
      d.status === 'processing' ||
      d.status === 'empty',
  ).length
  const filesSummary =
    !hasAnyFileSectionBlock
      ? 'Add resume, DOT, MVR, or verification blocks below'
      : loading
        ? 'Loading your artifacts…'
        : `${documents.length} ${documents.length === 1 ? 'file' : 'files'}${
            inProgressCount > 0 ? ` · ${inProgressCount} in progress` : ''
          }`

  // Keep onboarding copy visible until user installs file-capable blocks; then respect collapse pref.
  const showFilesPanel = !hasAnyFileSectionBlock || hubBlockFilesExpanded

  return (
    <>
    {/* Same chrome as Block Hive — `HubSectionPanel` + `BlockCard variant='embed'` */}
    <HubSectionPanel isDark={isDark}>
      <BlockCard
        variant='embed'
        icon={FileText}
        title='Block files'
        description='Resume · DOT · MVR · portfolio · GitHub · verifications'
        headerActions={
          <>
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                isDark ? 'text-gray-400' : 'text-slate-500',
              )}
            >
              {filesSummary}
            </span>
            {hasAnyFileSectionBlock && (
              <HubSectionCollapseToggle
                expanded={hubBlockFilesExpanded}
                onToggle={() => setHubBlockFilesExpanded(!hubBlockFilesExpanded)}
                sectionLabel='Block files'
                isDark={isDark}
              />
            )}
          </>
        }
      >
      {showFilesPanel && (
      <>
      {/* Empty state: no file-related blocks installed */}
      {!hasAnyFileSectionBlock && (
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
          Install a Resume, DOT Application, MVR, or Employment Verification block from the Block Hive below to manage your files here.
        </p>
      )}

      {/* Loading: has blocks but still fetching */}
      {hasAnyFileSectionBlock && loading && (
        <div className='flex items-center justify-center py-8'>
          <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
        </div>
      )}

      {/* Empty state: has blocks but no documents yet */}
      {hasAnyFileSectionBlock && !loading && documents.length === 0 && (
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
          Nothing to list yet — try refreshing. Installed blocks normally show a row here right away (Not started until you open the block).
        </p>
      )}

      {/* Status message and document list — only when we have docs to show */}
      {hasAnyFileSectionBlock && !loading && documents.length > 0 && (
        <>
      {message && (
        <div className={cn(
          'mb-3 px-3 py-2 rounded-lg text-xs',
          message.type === 'success'
            ? isDark
              ? 'bg-green-500/15 text-green-400'
              : 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-800/20'
            : isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-700',
        )}>
          {message.text}
        </div>
      )}

      <div className={cn('divide-y', isDark ? 'divide-gray-700/70' : 'divide-slate-200/90')}>
        {documents.map((doc) => (
          <div key={doc.id}>
            <div className='flex flex-col gap-3 py-5 first:pt-2 last:pb-2 sm:flex-row sm:items-center sm:gap-5 sm:py-6'>
              {/* Icon + info — full width row on mobile; actions stack below so they never overlap title text */}
              <div className='flex min-w-0 flex-1 gap-4'>
              <div className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset sm:h-12 sm:w-12',
                doc.verified
                  ? isDark ? 'bg-green-500/20 ring-transparent' : 'bg-emerald-100 ring-emerald-800/25'
                  : doc.status === 'complete' ? (isDark ? 'bg-teal-500/20 ring-transparent' : 'bg-teal-100 ring-teal-700/20')
                  : doc.status === 'processing' ? (isDark ? 'bg-blue-500/20 ring-transparent' : 'bg-blue-100 ring-blue-800/15')
                  : isDark ? 'bg-gray-700 ring-transparent' : 'bg-slate-200 ring-slate-400/35',
              )}>
                {doc.type === 'resume' ? (
                  <FileText className={cn(
                    'w-4 h-4',
                    doc.verified ? (isDark ? 'text-green-400' : 'text-emerald-800') : isDark ? 'text-gray-400' : 'text-slate-600',
                  )} />
                ) : doc.type === 'mvr' ? (
                  <Car className={cn(
                    'w-4 h-4',
                    doc.status === 'complete' ? (isDark ? 'text-teal-400' : 'text-teal-600')
                      : doc.status === 'processing' ? (isDark ? 'text-blue-400' : 'text-blue-600')
                      : isDark ? 'text-gray-400' : 'text-slate-600'
                  )} />
                ) : doc.type === 'portfolio' ? (
                  <Globe className={cn('w-4 h-4', doc.status === 'complete' ? (isDark ? 'text-teal-400' : 'text-teal-600') : isDark ? 'text-gray-400' : 'text-slate-600')} />
                ) : doc.type === 'github' ? (
                  <Github className={cn('w-4 h-4', doc.status === 'complete' ? (isDark ? 'text-teal-400' : 'text-teal-600') : isDark ? 'text-gray-400' : 'text-slate-600')} />
                ) : doc.type === 'employment_verifications' ? (
                  <ShieldCheck className={cn('w-4 h-4', doc.status === 'in-progress' ? (isDark ? 'text-yellow-400' : 'text-yellow-600') : isDark ? 'text-violet-400' : 'text-violet-600')} />
                ) : (
                  <ClipboardCheck className={cn(
                    'w-4 h-4',
                    doc.verified ? (isDark ? 'text-green-400' : 'text-emerald-800') : isDark ? 'text-gray-400' : 'text-slate-600',
                  )} />
                )}
              </div>

              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2 sm:gap-2.5'>
                  <p className={cn('text-base font-medium leading-snug break-words', isDark ? 'text-white' : 'text-slate-800')}>
                    {doc.title}
                    {doc.subtitle && <span className={cn('ml-1 font-normal', isDark ? 'text-gray-500' : 'text-gray-400')}>({doc.subtitle})</span>}
                  </p>
                  {doc.status === 'empty' && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                        isDark ? 'bg-gray-600/35 text-gray-300' : 'bg-slate-200 text-slate-700',
                      )}
                    >
                      Not started
                    </span>
                  )}
                  {doc.status === 'in-progress' && (
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700')}>
                      In Progress
                    </span>
                  )}
                  {doc.status === 'processing' && (
                    <span className={cn('flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700')}>
                      <Loader2 className='w-2.5 h-2.5 animate-spin' /> Processing
                    </span>
                  )}
                  {doc.status === 'complete' && !doc.verified && (
                    <span className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-700')}>
                      <Check className='w-2.5 h-2.5' /> Completed
                    </span>
                  )}
                  {doc.verified && (
                    <span className={cn(
                      'flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium',
                      isDark ? 'bg-green-500/15 text-green-500' : 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-800/25',
                    )}>
                      <Check className='w-2.5 h-2.5' /> On-Chain
                    </span>
                  )}
                </div>
                {doc.verified && doc.txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${doc.txHash}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn('text-[11px] hover:underline', isDark ? 'text-teal-400' : 'text-teal-600')}
                  >
                    View transaction →
                  </a>
                )}
                {doc.type === 'mvr' && doc.status === 'complete' && (
                  <p className={cn('text-[10px] mt-1.5 leading-snug', isDark ? 'text-gray-500' : 'text-gray-500')}>
                    MVR is provider-certified. On-chain options (e.g. hash attestation) are possible later; we avoid
                    putting full MVR payloads on a public chain for privacy/FCRA reasons.
                  </p>
                )}
                {doc.type === 'portfolio' && doc.portfolioUrl && (
                  <p className={cn('text-[11px] mt-0.5 break-all sm:truncate', isDark ? 'text-gray-400' : 'text-slate-600')}>
                    {doc.portfolioUrl}
                  </p>
                )}
                {doc.type === 'github' && doc.githubUsername && (
                  <p className={cn('text-[11px] mt-0.5 break-all sm:truncate', isDark ? 'text-gray-400' : 'text-slate-600')}>
                    @{doc.githubUsername}
                  </p>
                )}
              </div>
              </div>

              {/* Actions: View | Edit | Verify (until on-chain) | Delete */}
              <div className='flex w-full max-w-none flex-shrink-0 flex-wrap items-stretch gap-2 sm:w-auto sm:justify-end'>
                {doc.type === 'portfolio' && doc.portfolioUrl && (
                  <a
                    href={doc.portfolioUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </a>
                )}
                {doc.type === 'portfolio' && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage('portfolio')}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Pencil className='w-3 h-3' /> Edit
                  </button>
                )}
                {doc.type === 'github' && doc.githubUsername && (
                  <a
                    href={`https://github.com/${doc.githubUsername}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </a>
                )}
                {doc.type === 'github' && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage('github')}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Pencil className='w-3 h-3' /> Edit
                  </button>
                )}
                {doc.type === 'employment_verifications' && doc.editPage && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage(doc.editPage)}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Pencil className='w-3 h-3' /> Manage
                  </button>
                )}
                {doc.status !== 'processing' && doc.type === 'resume' && myFilesResumeCanView(doc) && (
                  <button
                    type='button'
                    onClick={() => {
                      if (isLiveResumeIpfsHash(doc.ipfsHash)) {
                        setResumeFilePreview({
                          title: doc.title,
                          url: `https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`,
                        })
                        return
                      }
                      if (doc.resumeSourceRole === 'developer' && doc.structuredData) {
                        setDevResumePreview(doc)
                        return
                      }
                      if (doc.structuredData) {
                        setDriverResumePreview({
                          title: doc.title,
                          structuredData: doc.structuredData as Record<string, unknown>,
                        })
                      }
                    }}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'resume' && doc.editPage && (
                  <button
                    type='button'
                    onClick={() => {
                      if (doc.id !== 'resume-hub-placeholder') setEditingResumeId(doc.id)
                      else setEditingResumeId(undefined)
                      if (doc.editPage === 'storm-resume') {
                        const p =
                          doc.stormResumeInitialPanel ??
                          (doc.resumeSourceRole === 'driver'
                            ? 'driver'
                            : doc.resumeSourceRole === 'developer'
                              ? 'developer'
                              : 'general')
                        setStormResumeInitialPanel(p)
                      }
                      setCurrentPage(doc.editPage)
                    }}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Pencil className='w-3 h-3' /> Edit
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'dotapp' && doc.status === 'complete' && hubUserId && (
                  <button
                    type='button'
                    onClick={() => setDotAppPreviewApplicationId(doc.id)}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'dotapp' && doc.editPage && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage(doc.editPage)}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Pencil className='w-3 h-3' />{' '}
                    {doc.status === 'complete' ? 'Edit' : doc.status === 'empty' ? 'Start' : 'Continue'}
                  </button>
                )}

                {doc.type === 'mvr' && doc.editPage && doc.status !== 'complete' && (
                  <button
                    type='button'
                    onClick={() => setCurrentPage('mvr')}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100',
                    )}
                  >
                    {doc.status === 'empty' ? 'Order MVR' : 'Open'}
                  </button>
                )}

                {doc.status !== 'processing' && doc.type === 'mvr' && doc.status === 'complete' && (
                  <button
                    type='button'
                    onClick={() => setMvrViewOrderId(doc.id)}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <Eye className='w-3 h-3' /> View
                  </button>
                )}

                {doc.canVerify && (
                  <button
                    type='button'
                    onClick={() => handleVerify(doc)}
                    disabled={verifying === doc.id}
                    className='inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-teal-500 text-white hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {verifying === doc.id ? <Loader2 className='w-3 h-3 animate-spin' /> : <ShieldCheck className='w-3 h-3' />}
                    Verify
                  </button>
                )}

                {doc.canDelete ? (
                  <button
                    type='button'
                    onClick={() => setConfirmDelete(doc.id)}
                    disabled={deleting === doc.id}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors',
                      isDark ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-red-50 text-red-600 hover:bg-red-100',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {deleting === doc.id ? <Loader2 className='w-3 h-3 animate-spin' /> : <Trash2 className='w-3 h-3' />}
                    Delete
                  </button>
                ) : doc.type === 'dotapp' ? (
                  <button
                    type='button'
                    disabled
                    title='This DOT application is verified on-chain. It cannot be deleted (audit / FMCSA trail).'
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold cursor-not-allowed opacity-45',
                      isDark ? 'text-gray-500' : 'text-gray-400',
                    )}
                  >
                    <Trash2 className='w-3 h-3' /> Delete
                  </button>
                ) : null}
              </div>
            </div>

            {/* Inline delete confirmation */}
            {confirmDelete === doc.id && (
              <div className={cn(
                'flex items-center justify-between px-3 py-2 rounded-xl mt-1 text-xs',
                isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200',
              )}>
                <span className={isDark ? 'text-red-400' : 'text-red-600'}>
                  Delete this file? This cannot be undone.
                </span>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className={cn('px-2 py-1 rounded', isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    className='px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600'
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
        </>
      )}
      </>
      )}
      </BlockCard>
    </HubSectionPanel>
    <MvrViewModal
               isOpen={mvrViewOrderId !== null}
               onClose={() => setMvrViewOrderId(null)}
               walletAddress={walletAddress}
               orderId={mvrViewOrderId}
             />
    <DotAppPreviewModal
      isOpen={dotAppPreviewApplicationId !== null}
      onClose={() => setDotAppPreviewApplicationId(null)}
      userId={hubUserId}
      walletAddress={walletAddress}
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
          driverResumePreview.structuredData as Parameters<
            typeof ResumePreviewModal
          >[0]['structuredData']
        }
        onClose={() => setDriverResumePreview(null)}
        onDownload={async () => {
          setResumePdfLoading(true)
          try {
            await downloadDriverResumePdfFromStructured(
              driverResumePreview.structuredData,
              driverResumePreview.title || 'Resume',
            )
          } catch (e) {
            console.error(e)
          } finally {
            setResumePdfLoading(false)
          }
        }}
        isDownloading={resumePdfLoading}
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
}

// ── CandidateHub ─────────────────────────────────────────────────────────────

export default function CandidateHub() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const hubRefreshNonce = useUIStore((s) => s.hubRefreshNonce)

  const [refreshKey, setRefreshKey] = useState(0)
  const lastHubRefreshNonce = useRef<number | null>(null)

  const isLoading = useHubBlocksStore((s) => s.isLoading)
  const fetchError = useHubBlocksStore((s) => s.fetchError)
  const fetchHubData = useHubBlocksStore((s) => s.fetchHubData)
  const setStormiAutoWelcomeCandidateDone = useHubBlocksStore((s) => s.setStormiAutoWelcomeCandidateDone)

  const installedBlocks = useInstalledBlocks()
  const hubContext = useHubContext()
  const stormiAutoWelcomeCandidateDone = useStormiAutoWelcomeCandidateDone()
  const needsOnboarding = useNeedsOnboarding()
  const isStormiContextModalOpen = useHubBlocksStore((s) => s.isStormiContextModalOpen)

  useEffect(() => {
    if (walletAddress) fetchHubData(walletAddress)
  }, [walletAddress, fetchHubData])

  useEffect(() => {
    if (walletAddress) void syncDriverHubFromApi(walletAddress)
  }, [walletAddress])

  const refreshHub = useCallback(() => {
    if (walletAddress) fetchHubData(walletAddress)
    setRefreshKey((k) => k + 1)
  }, [walletAddress, fetchHubData])

  useEffect(() => {
    if (lastHubRefreshNonce.current === null) {
      lastHubRefreshNonce.current = hubRefreshNonce
      return
    }
    if (hubRefreshNonce === lastHubRefreshNonce.current) return
    lastHubRefreshNonce.current = hubRefreshNonce
    if (!walletAddress) return
    refreshHub()
  }, [hubRefreshNonce, walletAddress, refreshHub])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-gray-400' : 'text-slate-600')} />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div
        className={cn(
          'mx-auto max-w-md rounded-xl border p-6 text-center',
          isDark ? 'border-gray-700 bg-gray-800/60' : 'border-slate-300 bg-slate-100/95',
        )}
      >
        <AlertCircle className='mx-auto mb-3 h-8 w-8 text-red-500' />
        <p className={cn('mb-1 text-sm font-medium', isDark ? 'text-white' : 'text-slate-800')}>Failed to load your hub</p>
        <p className={cn('mb-4 text-xs', isDark ? 'text-gray-400' : 'text-slate-600')}>{fetchError}</p>
        <Button variant='secondary' size='sm' onClick={() => walletAddress && fetchHubData(walletAddress)}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <>
      {needsOnboarding && <HubOnboardingForm />}
      <BlockPickerModal />
      {isStormiContextModalOpen && <StormiContextModal />}

      <div className='w-full'>
        <div className='flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-x-8'>
          <div className='min-w-0 space-y-6 lg:col-start-1 lg:row-start-1'>
            {walletAddress ? (
              <StormiNudgeBanner isDark={isDark} walletAddress={walletAddress} />
            ) : null}

            <HubWorkspaceCareerCard refreshNonce={refreshKey} />

            <MyFilesSection refreshKey={refreshKey} />

            <HubInboxSection
              walletAddress={walletAddress}
              onNavigateToResume={(targetBlockType) => {
                const route = targetBlockType ? getBlockDefinition(targetBlockType)?.pageRoute : null
                if (route) setCurrentPage(route as PageType)
                else setCurrentPage('storm-resume')
              }}
              onNavigateToDotApp={() => setCurrentPage('dotapp')}
            />

            {walletAddress ? (
              <HubAccountSection
                walletAddress={walletAddress}
                onReadWhitepaper={() => setCurrentPage('stormchain')}
              />
            ) : null}
          </div>

          <aside className='min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:self-start'>
            <div id='stormi-hub-panel' className='scroll-mt-24'>
              <HubSectionPanel isDark={isDark} accent='violet'>
                <BlockCard
                  variant='embed'
                  headerIconSlot={
                    <Image
                      src='/ava-robot.png'
                      alt=''
                      width={36}
                      height={36}
                      className={cn('object-contain', !isDark && 'invert')}
                    />
                  }
                  title='Ask Stormi'
                  description='Ranked jobs, interview practice, and talking points from your Career Card — you choose every apply.'
                >
                  <StormiChatPanel
                    mode='candidate'
                    walletAddress={walletAddress}
                    hubContext={hubContext}
                    candidateEmptyHub={installedBlocks.length === 0}
                    stormiAutoWelcomeCandidateDone={stormiAutoWelcomeCandidateDone}
                    onStormiAutoWelcomeSynced={() => {
                      setStormiAutoWelcomeCandidateDone(true)
                      if (walletAddress) void fetchHubData(walletAddress)
                    }}
                    hubEmbedSurface
                  />
                </BlockCard>
              </HubSectionPanel>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
