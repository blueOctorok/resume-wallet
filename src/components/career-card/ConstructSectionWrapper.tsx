'use client'

/**
 * Construct mode: block illustration tile + career card section + inline block actions.
 * Heritage chrome — clean hairline tile and champagne-gold eyebrow label, matching
 * the landing page panels (the old chamfered vault tile + accent strip is retired).
 */

import { useState, useCallback } from 'react'
import { Eye, Loader2, Pencil, X } from 'lucide-react'
import ProvvenMark from '@/components/ui/ProvvenMark'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { getBlockDefinition, isCoreBlock } from '@/lib/block-registry'
import { getBlockIllustration } from '@/components/hub/BlockIllustrations'
import type { HubDocument } from '@/lib/hub-document-types'
import { hubScreeningStatusLabel } from '@/lib/hub-document-types'
import type { HubDocumentsHandle } from '@/hooks/use-hub-documents'
import { useAuthStore, useUIStore } from '@/stores'
import { useHubBlocksStore, useInstalledBlocks } from '@/stores/hub-blocks-store'
import type { PageType } from '@/stores/types'
import { hasStoredResumeFile } from '@/lib/document-storage'
import { fetchResumeSignedUrl } from '@/lib/fetch-document-url'
import BlockRemovalConfirmModal from '@/components/ui/BlockRemovalConfirmModal'

const btn =
  'inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors'

export interface ConstructSectionWrapperProps {
  blockType: string
  isDark: boolean
  children: React.ReactNode
  /** Matched hub artifact row for this section, if any */
  doc: HubDocument | null
  hub: HubDocumentsHandle
  onNavigateToBlock: (blockType: string) => void
}

export default function ConstructSectionWrapper({
  blockType,
  isDark,
  children,
  doc,
  hub,
  onNavigateToBlock,
}: ConstructSectionWrapperProps) {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const setEditingResumeId = useUIStore((s) => s.setEditingResumeId)
  const setStormResumeInitialPanel = useUIStore((s) => s.setStormResumeInitialPanel)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const removeBlock = useHubBlocksStore((s) => s.removeBlock)
  const installedBlocks = useInstalledBlocks()
  const [removeModalOpen, setRemoveModalOpen] = useState(false)

  const Illustration = getBlockIllustration(blockType)
  // Champagne gold across every block — heritage chrome doesn't do per-block colors
  const accentClass = isDark ? 'text-[#f15a2b]' : 'text-[#c43d14]'

  const ghostBtn = isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200'
  const tealBtn = isDark ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
  const dangerBtn = isDark ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-red-50 text-red-600 hover:bg-red-100'

  const core = isCoreBlock(blockType)
  const installed = installedBlocks.find((b) => b.blockType === blockType)

  const handleConfirmRemove = useCallback(
    async (_reason: string | null) => {
      if (!installed || !sessionUserId || core) return
      await removeBlock(installed.id, sessionUserId)
    },
    [installed, sessionUserId, core, removeBlock],
  )

  const openResumeEditor = (d: HubDocument) => {
    if (d.id !== 'resume-hub-placeholder') setEditingResumeId(d.id)
    else setEditingResumeId(undefined)
    if (d.editPage === 'storm-resume') {
      const p =
        d.stormResumeInitialPanel ??
        (d.resumeSourceRole === 'driver'
          ? 'driver'
          : d.resumeSourceRole === 'developer'
            ? 'developer'
            : 'general')
      setStormResumeInitialPanel(p)
    }
    if (d.editPage) setCurrentPage(d.editPage as PageType)
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-3 sm:p-4',
        isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-stone-300/60 bg-white/75',
      )}
    >
      <div className='flex gap-3 sm:gap-4'>
        <div
          className={cn(
            'relative mt-0.5 flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-xl border sm:h-[4.75rem] sm:w-[4.75rem]',
            isDark ? 'border-white/[0.1] bg-white/[0.04]' : 'border-stone-300/70 bg-[#fbf8f1]',
          )}
        >
          <div className='flex h-full scale-[0.82] items-center justify-center p-1 sm:scale-[0.88]'>
            <Illustration accentText={accentClass} isDark={isDark} />
          </div>
        </div>

        <div className='min-w-0 flex-1 space-y-2.5'>
          <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              {/* Uniform champagne eyebrow — gold is the only accent, like the landing page */}
              <p
                className={cn(
                  'text-[11px] font-bold uppercase tracking-[0.12em]',
                  isDark ? 'text-[#f15a2b]' : 'text-[#c43d14]',
                )}
              >
                {getBlockDefinition(blockType)?.label ?? blockType}
              </p>
              {doc &&
                (doc.type === 'mvr' || doc.type === 'psp' || doc.type === 'screening_consent') &&
                doc.status !== 'empty' && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      doc.status === 'complete' &&
                        (isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'),
                      doc.status === 'processing' &&
                        (isDark ? 'bg-amber-500/15 text-amber-200' : 'bg-amber-100 text-amber-900'),
                      doc.status === 'in-progress' &&
                        (isDark ? 'bg-slate-600/80 text-slate-200' : 'bg-slate-200 text-slate-800'),
                      doc.status === 'failed' && (isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-100 text-red-800'),
                    )}
                  >
                    {hubScreeningStatusLabel(doc.status)}
                  </span>
                )}
            </div>
            <div className='flex flex-wrap items-center gap-1.5'>
              {!doc && (
                <Button type='button' variant='secondary' size='sm' onClick={() => onNavigateToBlock(blockType)}>
                  Set up
                </Button>
              )}
              {doc?.type === 'portfolio' && doc.portfolioUrl && (
                <a
                  href={doc.portfolioUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={cn(btn, ghostBtn)}
                >
                  <Eye className='w-3 h-3' /> View
                </a>
              )}
              {doc?.type === 'portfolio' && (
                <button type='button' onClick={() => setCurrentPage('portfolio')} className={cn(btn, ghostBtn)}>
                  <Pencil className='w-3 h-3' /> Edit
                </button>
              )}
              {doc?.type === 'github' && doc.githubUsername && (
                <a
                  href={`https://github.com/${doc.githubUsername}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={cn(btn, ghostBtn)}
                >
                  <Eye className='w-3 h-3' /> View
                </a>
              )}
              {doc?.type === 'github' && (
                <button type='button' onClick={() => setCurrentPage('github')} className={cn(btn, ghostBtn)}>
                  <Pencil className='w-3 h-3' /> Edit
                </button>
              )}
              {doc?.type === 'employment_verifications' && doc.editPage && (
                <button type='button' onClick={() => setCurrentPage(doc.editPage)} className={cn(btn, ghostBtn)}>
                  <Pencil className='w-3 h-3' /> Manage
                </button>
              )}
              {doc?.status !== 'processing' &&
                doc?.type === 'resume' &&
                hub.myFilesResumeCanView(doc) && (
                  <button
                    type='button'
                    onClick={async () => {
                      if (!doc) return
                      if (
                        hasStoredResumeFile({
                          storage_path: doc.storagePath,
                          ipfs_hash: doc.ipfsHash,
                        })
                      ) {
                        const url =
                          doc.documentUrl ?? (doc.type === 'resume' ? await fetchResumeSignedUrl(doc.id) : null)
                        if (url) {
                          hub.setResumeFilePreview({
                            title: doc.title,
                            url,
                          })
                        }
                        return
                      }
                      if (doc.resumeSourceRole === 'developer' && doc.structuredData) {
                        hub.setDevResumePreview(doc)
                        return
                      }
                      if (doc.structuredData) {
                        hub.setDriverResumePreview({
                          title: doc.title,
                          structuredData: doc.structuredData as Record<string, unknown>,
                        })
                      }
                    }}
                    className={cn(btn, ghostBtn)}
                  >
                    <Eye className='w-3 h-3' /> View
                  </button>
                )}
              {doc?.status !== 'processing' && doc?.type === 'resume' && doc.editPage && (
                <button type='button' onClick={() => openResumeEditor(doc)} className={cn(btn, ghostBtn)}>
                  <Pencil className='w-3 h-3' /> Edit
                </button>
              )}
              {doc?.status !== 'processing' &&
                doc?.type === 'dotapp' &&
                doc.status === 'complete' &&
                hub.hubUserId && (
                  <button
                    type='button'
                    onClick={() => hub.setDotAppPreviewApplicationId(doc.id)}
                    className={cn(btn, ghostBtn)}
                  >
                    <Eye className='w-3 h-3' /> View
                  </button>
                )}
              {doc?.status !== 'processing' && doc?.type === 'dotapp' && doc.editPage && (
                <button type='button' onClick={() => setCurrentPage(doc.editPage)} className={cn(btn, ghostBtn)}>
                  <Pencil className='w-3 h-3' />{' '}
                  {doc.status === 'complete' ? 'Edit' : doc.status === 'empty' ? 'Start' : 'Continue'}
                </button>
              )}
              {doc?.type === 'mvr' &&
                doc.editPage &&
                doc.status !== 'complete' &&
                !doc.employerPaidScreening && (
                  <Button
                    type='button'
                    variant='primary'
                    size='sm'
                    onClick={() => setCurrentPage((doc.editPage as PageType) ?? 'mvr')}
                  >
                    {doc.pendingEmployerRequest ? 'Continue screening' : doc.status === 'empty' ? 'Order' : 'Open'}
                  </Button>
                )}
              {doc?.type === 'mvr' && doc.status === 'complete' && !doc.employerPaidScreening && (
                <Button type='button' variant='secondary' size='sm' onClick={() => hub.setMvrViewOrderId(doc.id)}>
                  <Eye className='h-3.5 w-3.5' aria-hidden />
                  View
                </Button>
              )}
              {doc?.type === 'psp' &&
                doc.editPage &&
                doc.status !== 'complete' &&
                !doc.employerPaidScreening && (
                  <Button
                    type='button'
                    variant='primary'
                    size='sm'
                    onClick={() => setCurrentPage((doc.editPage as PageType) ?? 'psp')}
                  >
                    {doc.pendingEmployerRequest ? 'Continue screening' : doc.status === 'empty' ? 'Order' : 'Open'}
                  </Button>
                )}
              {doc?.type === 'psp' && doc.status === 'complete' && !doc.employerPaidScreening && (
                <Button type='button' variant='secondary' size='sm' onClick={() => hub.setPspViewOrderId(doc.id)}>
                  <Eye className='h-3.5 w-3.5' aria-hidden />
                  View
                </Button>
              )}
              {doc?.type === 'screening_consent' && doc.editPage && doc.status !== 'complete' && (
                <button type='button' onClick={() => setCurrentPage(doc.editPage)} className={cn(btn, tealBtn)}>
                  {doc.status === 'empty' ? 'Start' : 'Continue'}
                </button>
              )}
              {doc?.type === 'screening_consent' && doc.status === 'complete' && (
                <span className={cn('text-[10px] font-semibold uppercase tracking-wide', isDark ? 'text-emerald-300' : 'text-emerald-800')}>
                  On file
                </span>
              )}
              {doc?.canVerify && (
                <button
                  type='button'
                  onClick={() => hub.handleVerify(doc)}
                  disabled={hub.verifying === doc.id}
                  className={cn(btn, 'bg-teal-500 text-white hover:bg-teal-400 disabled:opacity-50')}
                >
                  {hub.verifying === doc.id ? (
                    <Loader2 className='w-3 h-3 animate-spin' />
                  ) : (
                    <ProvvenMark className='text-sm' />
                  )}
                  Verify
                </button>
              )}
              {!core && installed && (
                <button
                  type='button'
                  onClick={() => setRemoveModalOpen(true)}
                  className={cn(btn, dangerBtn)}
                >
                  <X className='w-3 h-3' /> Remove
                </button>
              )}
            </div>
          </div>

          <div className='min-w-0'>{children}</div>
        </div>
      </div>

      <BlockRemovalConfirmModal
        open={removeModalOpen}
        onClose={() => setRemoveModalOpen(false)}
        blockLabel={getBlockDefinition(blockType)?.label ?? blockType}
        onConfirm={handleConfirmRemove}
      />
    </div>
  )
}
