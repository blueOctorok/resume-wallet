'use client'

import { useEffect, useState } from 'react'
import { Loader2, User } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import type { DqFileSnapshot } from '@/lib/dq-file-status'
import DqFileSection from './DqFileSection'
import { DqOverallStatusBadge } from './DqStatusBadge'

interface CandidateIdentity {
  userId: string
  name: string
  avatarUrl: string | null
  email: string | null
  phone: string | null
  headline: string | null
}

interface EmployerCandidateDetailProps {
  userId: string
  onClose: () => void
  /** Optional name for optimistic header while loading. */
  initialName?: string
}

export default function EmployerCandidateDetail({
  userId,
  onClose,
  initialName,
}: EmployerCandidateDetailProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [candidate, setCandidate] = useState<CandidateIdentity | null>(null)
  const [dqFile, setDqFile] = useState<DqFileSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const res = await fetch(`/api/employer/dq-monitor/${userId}`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load driver DQ file')
        }
        if (cancelled) return
        setCandidate(data.candidate)
        setDqFile(data.dqFile)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  const title = candidate?.name || initialName || 'Driver'

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl" panelShape="block" zIndex={1100}>
      <ModalHeader
        variant="block"
        title={title}
        subtitle="DQ file and compliance status for your company"
        onClose={onClose}
      />

      <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500 dark:text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading DQ file…</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && candidate && dqFile && (
          <>
            <HubSectionPanel isDark={isDark} accent="teal">
              <BlockCard
                variant="embed"
                icon={User}
                title={candidate.name}
                description={candidate.headline || 'Driver in your hiring pipeline'}
                headerActions={
                  <DqOverallStatusBadge
                    status={dqFile.overall}
                    completedCount={dqFile.completedCount}
                    totalLiveCount={dqFile.totalLiveCount}
                  />
                }
              >
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-gray-400">
                  {candidate.email && <span>{candidate.email}</span>}
                  {candidate.phone && <span>{candidate.phone}</span>}
                </div>
              </BlockCard>
            </HubSectionPanel>

            <DqFileSection dqFile={dqFile} />
          </>
        )}
      </div>
    </Modal>
  )
}
