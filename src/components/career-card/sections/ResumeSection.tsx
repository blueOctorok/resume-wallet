'use client'

import { useState } from 'react'
import { FileText, CheckCircle, Maximize2, Briefcase, ExternalLink, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import ResumeFilePreviewModal from '@/components/hub/ResumeFilePreviewModal'
import DeveloperResumePreviewModal from '@/components/DeveloperResumePreviewModal'
import Button from '@/components/ui/Button'
import type { DeveloperResumeData } from '@/components/DeveloperResumeBuilder'
import type { ResumeData } from '@/types/career-card'
import type { CareerCardMode } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import { isLiveResumeIpfsHash } from '@/lib/resume-ipfs-guards'
import { isDeveloperResumeStructured } from '@/lib/career-card-resume-shape'

interface ResumeSectionProps {
  data: ResumeData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
  walletAddress?: string
}

function formatTeaserMonthYear(s?: string) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function DriverGeneralResumeSnapshot({
  sd,
  isDark,
}: {
  sd: Record<string, unknown>
  isDark: boolean
}) {
  const pi = (sd.personalInfo as Record<string, string | undefined>) || {}
  const name = [pi.firstName, pi.lastName].filter(Boolean).join(' ').trim()
  const loc = [pi.city, pi.state].filter(Boolean).join(', ')
  const summary = (pi.professionalSummary || '').trim()
  const cdl = sd.cdlInfo as Record<string, string | undefined> | undefined
  const cdlLine =
    cdl?.cdlClass || cdl?.cdlState
      ? [cdl.cdlClass && `Class ${cdl.cdlClass}`, cdl.cdlState].filter(Boolean).join(' · ')
      : ''
  const skills = ((sd.skills as Array<{ name?: string }>) || [])
    .map((x) => x.name)
    .filter(Boolean)
    .slice(0, 10) as string[]
  const jobs = ((sd.employments as Array<{
    companyName?: string
    position?: string
    startDate?: string
    endDate?: string
    isCurrent?: boolean
  }>) || []).slice(0, 2)

  const hasAny = Boolean(name || loc || cdlLine || summary || skills.length || jobs.length)
  if (!hasAny) {
    return (
      <p className={cn('mt-3 text-sm', isDark ? 'text-gray-500' : 'text-gray-600')}>
        Resume details on file — use <strong className={isDark ? 'text-gray-300' : 'text-gray-800'}>Full resume</strong>{' '}
        for the complete view.
      </p>
    )
  }

  const muted = isDark ? 'text-gray-400' : 'text-gray-600'
  const sub = isDark ? 'text-gray-500' : 'text-gray-500'
  const chip = isDark
    ? 'bg-teal-500/15 text-teal-200 border border-teal-500/25'
    : 'bg-teal-50 text-teal-800 border border-teal-200/80'

  return (
    <div
      className={cn(
        'mt-3 rounded-xl border p-4 space-y-3',
        'bg-gradient-to-br from-teal-500/[0.07] via-transparent to-violet-500/[0.04]',
        isDark
          ? 'border-teal-500/20 from-teal-400/[0.08] to-violet-500/[0.06]'
          : 'border-teal-200/60 from-teal-500/[0.06]',
      )}
    >
      {(name || loc || cdlLine) && (
        <div>
          {name ? (
            <p className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{name}</p>
          ) : null}
          {loc ? <p className={cn('text-sm', muted)}>{loc}</p> : null}
          {cdlLine ? <p className={cn('text-xs font-medium', isDark ? 'text-teal-300' : 'text-teal-700')}>{cdlLine}</p> : null}
        </div>
      )}
      {summary ? (
        <p className={cn('text-sm leading-relaxed line-clamp-4', muted)}>{summary}</p>
      ) : null}
      {skills.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {skills.map((s) => (
            <span key={s} className={cn('text-[11px] px-2 py-0.5 rounded-md font-medium', chip)}>
              {s}
            </span>
          ))}
        </div>
      )}
      {jobs.length > 0 && (
        <div className='space-y-2 pt-1 border-t border-gray-200/50 dark:border-gray-600/50'>
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider', sub)}>Recent roles</p>
          {jobs.map((j, i) => (
            <div key={i} className='flex gap-2 items-start'>
              <Briefcase className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', isDark ? 'text-teal-400' : 'text-teal-600')} />
              <div className='min-w-0'>
                <p className={cn('text-sm font-medium truncate', isDark ? 'text-gray-100' : 'text-gray-900')}>
                  {j.position || 'Role'}
                </p>
                <p className={cn('text-xs truncate', sub)}>
                  {j.companyName || 'Company'}
                  {(j.startDate || j.endDate || j.isCurrent) && (
                    <span>
                      {' · '}
                      {formatTeaserMonthYear(j.startDate)} — {j.isCurrent ? 'Present' : formatTeaserMonthYear(j.endDate) || '—'}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DeveloperResumeSnapshot({
  sd,
  isDark,
}: {
  sd: Record<string, unknown>
  isDark: boolean
}) {
  const pi = (sd.personalInfo as Record<string, string | undefined>) || {}
  const name = [pi.firstName, pi.lastName].filter(Boolean).join(' ').trim()
  const loc = (pi.location || '').trim()
  const headline = (pi.headline || '').trim()
  const summary = (pi.summary || '').trim()
  const skills = ((sd.skills as Array<{ name?: string }>) || [])
    .map((x) => x.name)
    .filter(Boolean)
    .slice(0, 10) as string[]
  const ex = ((sd.experience as Array<{
    company?: string
    title?: string
    startDate?: string
    endDate?: string
    isCurrent?: boolean
  }>) || []).slice(0, 2)

  const hasAny = Boolean(name || headline || loc || summary || skills.length || ex.length)
  if (!hasAny) {
    return (
      <p className={cn('mt-3 text-sm', isDark ? 'text-gray-500' : 'text-gray-600')}>
        Resume details on file — use <strong className={isDark ? 'text-gray-300' : 'text-gray-800'}>Full resume</strong>{' '}
        for the complete view.
      </p>
    )
  }

  const muted = isDark ? 'text-gray-400' : 'text-gray-600'
  const sub = isDark ? 'text-gray-500' : 'text-gray-500'
  const chip = isDark
    ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/25'
    : 'bg-cyan-50 text-cyan-900 border border-cyan-200/80'

  return (
    <div
      className={cn(
        'mt-3 rounded-xl border p-4 space-y-3',
        'bg-gradient-to-br from-cyan-500/[0.07] via-transparent to-violet-500/[0.05]',
        isDark
          ? 'border-cyan-500/20 from-cyan-400/[0.08] to-violet-500/[0.06]'
          : 'border-cyan-200/60 from-cyan-500/[0.06]',
      )}
    >
      {(name || headline) && (
        <div>
          {name ? (
            <p className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{name}</p>
          ) : null}
          {headline ? (
            <p className={cn('text-sm font-medium mt-0.5', isDark ? 'text-cyan-300' : 'text-cyan-800')}>{headline}</p>
          ) : null}
          {loc ? <p className={cn('text-xs mt-1', muted)}>{loc}</p> : null}
        </div>
      )}
      {summary ? <p className={cn('text-sm leading-relaxed line-clamp-3', muted)}>{summary}</p> : null}
      {skills.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {skills.map((s) => (
            <span key={s} className={cn('text-[11px] px-2 py-0.5 rounded-md font-medium', chip)}>
              {s}
            </span>
          ))}
        </div>
      )}
      {ex.length > 0 && (
        <div className='space-y-2 pt-1 border-t border-gray-200/50 dark:border-gray-600/50'>
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider', sub)}>Experience</p>
          {ex.map((j, i) => (
            <div key={i} className='flex gap-2 items-start'>
              <Briefcase className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', isDark ? 'text-cyan-400' : 'text-cyan-600')} />
              <div className='min-w-0'>
                <p className={cn('text-sm font-medium truncate', isDark ? 'text-gray-100' : 'text-gray-900')}>
                  {j.title || 'Role'}
                </p>
                <p className={cn('text-xs truncate', sub)}>
                  {j.company || 'Company'}
                  {(j.startDate || j.endDate || j.isCurrent) && (
                    <span>
                      {' · '}
                      {formatTeaserMonthYear(j.startDate)} — {j.isCurrent ? 'Present' : formatTeaserMonthYear(j.endDate) || '—'}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ResumeSection({
  data,
  mode,
  isDark,
  onAction,
  walletAddress = '',
}: ResumeSectionProps) {
  const isVerified = String(data.verificationStatus || '').toLowerCase() === 'verified'
  const [showDriverPreview, setShowDriverPreview] = useState(false)
  const [showDevPreview, setShowDevPreview] = useState(false)
  const [showIpfsPreview, setShowIpfsPreview] = useState(false)

  const isPlaceholderResume =
    data.id === '__storm_resume_placeholder__' ||
    (String(data.verificationStatus || '').toUpperCase() === 'EMPTY' &&
      !data.title?.trim() &&
      !data.filename?.trim())

  if (isPlaceholderResume) {
    return (
      <div
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center',
          isDark ? 'border-teal-400/25 bg-teal-500/[0.06]' : 'border-teal-300/60 bg-teal-50/50',
        )}
      >
        <FileText className={cn('mx-auto mb-2 h-8 w-8', isDark ? 'text-teal-300' : 'text-teal-600')} />
        <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Add your resume</p>
        <p className={cn('mt-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
          Upload a PDF or build in STORM Resume — it&apos;s the first thing employers scan.
        </p>
        {isCareerCardOwnerMode(mode) && onAction ? (
          <Button type='button' variant='primary' size='sm' className='mt-4' onClick={onAction}>
            Upload or build
          </Button>
        ) : null}
      </div>
    )
  }

  const isIpfsResume = isLiveResumeIpfsHash(data.ipfsHash)
  const rawSd = data.structuredData
  const structuredRecord =
    rawSd != null && typeof rawSd === 'object' ? (rawSd as Record<string, unknown>) : null
  const isBuiltResume = structuredRecord !== null && Object.keys(structuredRecord).length > 0
  const isDevShape = isBuiltResume && isDeveloperResumeStructured(structuredRecord)
  const stormMeta =
    structuredRecord && typeof structuredRecord._stormMeta === 'object' && structuredRecord._stormMeta !== null
      ? (structuredRecord._stormMeta as { source?: string })
      : null
  const isAiExtracted = stormMeta?.source === 'ai-extracted'

  const canOpenFull = isIpfsResume || isBuiltResume

  return (
    <>
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border p-4',
          isDark
            ? 'border-gray-600/55 bg-gray-800/45 ring-1 ring-white/[0.04]'
            : 'border-gray-200/90 bg-white/85 ring-1 ring-gray-900/[0.04]',
          'shadow-sm',
        )}
      >
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent dark:via-teal-400/20'
        />
        <div className='flex flex-wrap items-start justify-between gap-2 mb-1'>
          <div className='flex items-center gap-2 min-w-0'>
            <FileText className={cn('w-4 h-4 flex-shrink-0', isDark ? 'text-teal-400' : 'text-teal-600')} />
            <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Resume</h3>
            {isVerified && (
              <span className='flex items-center gap-1 text-xs text-green-500 dark:text-green-400 flex-shrink-0'>
                <CheckCircle className='w-3 h-3' /> Verified
              </span>
            )}
            {isAiExtracted && (
              <span
                className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-md border flex-shrink-0',
                  isDark ? 'bg-gray-600/40 text-gray-300 border-gray-500/40' : 'bg-gray-100 text-gray-600 border-gray-200',
                )}
              >
                Parsed from resume
              </span>
            )}
            {isVerified && data.blockchainTxHash && (
              <span className='flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400 flex-shrink-0'>
                <Shield className='w-3 h-3' /> On-chain
              </span>
            )}
          </div>
          {canOpenFull && (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='flex-shrink-0'
              onClick={() => {
                if (isIpfsResume) setShowIpfsPreview(true)
                else if (isDevShape) setShowDevPreview(true)
                else setShowDriverPreview(true)
              }}
            >
              <Maximize2 className='w-3 h-3' />
              Full resume
            </Button>
          )}
        </div>

        <div className='flex items-center gap-3 mb-1'>
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
              isDark ? 'bg-gray-700' : 'bg-gray-200/60',
            )}
          >
            <FileText className={cn('w-5 h-5', isDark ? 'text-gray-400' : 'text-gray-500')} />
          </div>
          <div className='min-w-0 flex-1'>
            <p className={cn('text-sm font-medium truncate', isDark ? 'text-gray-200' : 'text-gray-800')}>
              {data.title || data.filename}
            </p>
            <p className={cn('text-xs flex flex-wrap items-center gap-x-1 gap-y-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
              <span>
                {isVerified ? 'Blockchain verified' : 'On file'} · {new Date(data.createdAt).toLocaleDateString()}
              </span>
              {isVerified && data.blockchainTxHash ? (
                <>
                  <span aria-hidden>·</span>
                  <a
                    href={`https://sepolia.basescan.org/tx/${data.blockchainTxHash}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn(
                      'inline-flex items-center gap-0.5 font-medium',
                      isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-700 hover:text-teal-800',
                    )}
                  >
                    View on Base <ExternalLink className='w-3 h-3' />
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>

        {isBuiltResume && structuredRecord && isDevShape && (
          <DeveloperResumeSnapshot sd={structuredRecord} isDark={isDark} />
        )}
        {isBuiltResume && structuredRecord && !isDevShape && (
          <DriverGeneralResumeSnapshot sd={structuredRecord} isDark={isDark} />
        )}
        {isIpfsResume && !isBuiltResume && (
          <div
            className={cn(
              'mt-3 rounded-xl border px-4 py-3 text-sm',
              isDark ? 'border-gray-600 bg-gray-900/40 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-600',
            )}
          >
            PDF resume on IPFS — open <strong className={isDark ? 'text-gray-300' : 'text-gray-800'}>Full resume</strong>{' '}
            for the complete document.
          </div>
        )}
      </div>

      {showIpfsPreview && data.ipfsHash && (
        <ResumeFilePreviewModal
          isOpen={showIpfsPreview}
          onClose={() => setShowIpfsPreview(false)}
          title={data.title || data.filename || 'Resume'}
          ipfsUrl={`https://gateway.pinata.cloud/ipfs/${data.ipfsHash}`}
          isDark={isDark}
        />
      )}

      {showDriverPreview && isBuiltResume && structuredRecord && !isDevShape && (
        <ResumePreviewModal
          title={data.title || 'Resume'}
          structuredData={data.structuredData as Parameters<typeof ResumePreviewModal>[0]['structuredData']}
          onClose={() => setShowDriverPreview(false)}
          theme={isDark ? 'dark' : 'light'}
          zIndex={10100}
        />
      )}

      {showDevPreview && isBuiltResume && structuredRecord && isDevShape && (
        <DeveloperResumePreviewModal
          viewOnly={!isCareerCardOwnerMode(mode)}
          resume={{
            id: data.id,
            title: data.title || data.filename,
            structured_data: structuredRecord as unknown as DeveloperResumeData,
            verification_status: isVerified ? 'VERIFIED' : 'PENDING',
            created_at: data.createdAt,
            ipfs_hash: data.ipfsHash ?? undefined,
          }}
          onClose={() => setShowDevPreview(false)}
          onEdit={() => {
            setShowDevPreview(false)
            onAction?.()
          }}
          onVerify={() => setShowDevPreview(false)}
          onDelete={() => setShowDevPreview(false)}
          userAddress={walletAddress}
        />
      )}
    </>
  )
}
