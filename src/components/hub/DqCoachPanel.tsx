'use client'

import { useEffect, useState } from 'react'
import ProvvenMark from '@/components/ui/ProvvenMark'
import ResumePaperCard from '@/components/hub/ResumePaperCard'
import { DqBriefMessage } from '@/components/hub/DqBriefModal'
import { useAuthStore } from '@/stores'
import { useDqCoachStore } from '@/stores/dq-coach-store'
import { useDriverOrientationStore } from '@/stores/driver-orientation-store'

const THINKING_LINES = [
  'Seeing where you are…',
  'Lining up your next step…',
  'Almost ready…',
]

function ThinkingBlock() {
  const [line, setLine] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setLine((n) => (n + 1) % THINKING_LINES.length)
    }, 2200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className='py-2 text-center' role='status' aria-live='polite' aria-busy='true'>
      <p className='text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500'>
        Thinking
      </p>
      <p className='mt-1 text-sm font-semibold text-[#173150]'>Putting your guide together</p>
      <p className='mt-1 text-xs leading-relaxed text-stone-500'>{THINKING_LINES[line]}</p>
      <div className='mt-3 flex items-center justify-center gap-1.5' aria-hidden>
        <span className='size-2 rounded-full bg-[#f15a2b] motion-safe:animate-pulse' />
        <span
          className='size-2 rounded-full bg-[#f15a2b] motion-safe:animate-pulse'
          style={{ animationDelay: '160ms' }}
        />
        <span
          className='size-2 rounded-full bg-[#f15a2b] motion-safe:animate-pulse'
          style={{ animationDelay: '320ms' }}
        />
      </div>
    </div>
  )
}

/**
 * Career path is the coach's message for this driver.
 * On arrival that message is a popup. Once they close it, it lives here,
 * on the same paper as the resume.
 */
export default function DqCoachPanel({
  onViewResume,
  resumeLoading,
  resumeError,
}: {
  onViewResume: () => void
  resumeLoading: boolean
  resumeError: string | null
}) {
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const brief = useDqCoachStore((s) => s.brief)
  const isLoading = useDqCoachStore((s) => s.isLoading)
  const error = useDqCoachStore((s) => s.error)
  const scan = useDqCoachStore((s) => s.scan)
  const briefOpen = useDriverOrientationStore((s) => s.briefOpen)
  const popupDecided = useDriverOrientationStore((s) => s.popupDecided)

  useEffect(() => {
    if (sessionUserId) void scan()
  }, [sessionUserId, scan])

  // Hold the message back until the popup has had its turn. Closing the popup
  // is what releases it into this section.
  const showMessage = Boolean(brief) && popupDecided && !briefOpen && !isLoading

  return (
    <ResumePaperCard>
      <header className='mb-5 text-center'>
        <ProvvenMark className='mx-auto block text-2xl' />
        <p className='mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#f15a2b]'>
          Career path
        </p>
      </header>

      {isLoading ? <ThinkingBlock /> : null}

      {error && !brief && !isLoading ? (
        <p className='text-center text-sm text-red-700'>{error}</p>
      ) : null}

      {showMessage && brief ? (
        <DqBriefMessage
          brief={brief}
          onViewResume={onViewResume}
          resumeLoading={resumeLoading}
          resumeError={resumeError}
        />
      ) : null}
    </ResumePaperCard>
  )
}
