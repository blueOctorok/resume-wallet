'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import Image from 'next/image'
import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import type { WalkthroughStep } from '@/lib/walkthrough-config'
import { WALKTHROUGH_AI_LOADING_STEP } from '@/lib/walkthrough-ai'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'

export interface StormiWalkthroughProps {
  steps: WalkthroughStep[]
  /** Fires when user finishes the tour (last step) or closes via X / backdrop */
  onComplete: () => void
  /** Fires when user checks "Don't show these again" — parent persists opt-out (e.g. PATCH `walkthrough_dismissed`) */
  onDisableAll: () => void
  /** Last-step primary: open block picker then complete */
  onBrowseBlocks: () => void
}

/**
 * Multi-step Stormi walkthrough — same chrome as hub sections: `Modal panelShape="block"` +
 * `HubSectionPanel` + `BlockCard variant="embed"` (vault rim + block header), not a hand-rolled card.
 */
export default function StormiWalkthrough({
  steps,
  onComplete,
  onDisableAll,
  onBrowseBlocks,
}: StormiWalkthroughProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const [index, setIndex] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const last = index === steps.length - 1
  const step = steps[index]
  const isAiLoadingPlaceholder = step?.id === WALKTHROUGH_AI_LOADING_STEP.id

  const finish = useCallback(() => {
    if (dontShowAgain) onDisableAll()
    onComplete()
  }, [dontShowAgain, onDisableAll, onComplete])

  const handleClose = useCallback(() => {
    finish()
  }, [finish])

  const handleNext = useCallback(() => {
    if (last) return
    setIndex((i) => Math.min(i + 1, steps.length - 1))
  }, [last, steps.length])

  const handleBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const handleBrowseBlocks = useCallback(() => {
    onBrowseBlocks()
    if (dontShowAgain) onDisableAll()
    onComplete()
  }, [dontShowAgain, onBrowseBlocks, onDisableAll, onComplete])

  const handleExploreSolo = useCallback(() => {
    finish()
  }, [finish])

  if (!step) return null

  const paragraphs = step.body.split(/\n\n+/).filter(Boolean)

  const stormiIcon = (
    <Image
      src="/ava-robot.png"
      alt=""
      width={44}
      height={44}
      className={cn('h-full w-full object-contain p-1', !isDark && 'invert')}
    />
  )

  return (
    <Modal onClose={handleClose} maxWidth="max-w-lg" zIndex={1050} panelShape="block" panelClassName="!p-0">
      <HubSectionPanel isDark={isDark} accent="violet" contentClassName="p-3 sm:p-4">
        <BlockCard
          variant="embed"
          headerIconSlot={stormiIcon}
          title={isAiLoadingPlaceholder ? 'Stormi is writing your welcome…' : step.title}
          description={`Stormi · Step ${index + 1} of ${steps.length}`}
          headerActions={
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className={cn(
                'rounded-md p-1.5 transition-colors',
                isDark
                  ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          }
        >
          <div className="space-y-5">
            <div className="space-y-3">
              {isAiLoadingPlaceholder ? (
                <div className="space-y-2" aria-busy aria-live="polite">
                  <div
                    className={cn(
                      'h-3.5 w-full max-w-md rounded-md motion-safe:animate-pulse',
                      isDark ? 'bg-gray-700/90' : 'bg-slate-200',
                    )}
                  />
                  <div
                    className={cn(
                      'h-3.5 w-full max-w-sm rounded-md motion-safe:animate-pulse',
                      isDark ? 'bg-gray-700/70' : 'bg-slate-200/90',
                    )}
                  />
                  <div
                    className={cn(
                      'h-3.5 w-[82%] max-w-lg rounded-md motion-safe:animate-pulse',
                      isDark ? 'bg-gray-700/60' : 'bg-slate-200/80',
                    )}
                  />
                </div>
              ) : (
                paragraphs.map((p, pi) => (
                  <p key={pi} className={cn('text-sm leading-relaxed', isDark ? 'text-gray-300' : 'text-slate-600')}>
                    {p}
                  </p>
                ))
              )}
            </div>

            <div className="flex justify-center gap-2 pt-1" role="tablist" aria-label="Tour progress">
              {steps.map((s, i) => (
                <span
                  key={s.id}
                  role="tab"
                  aria-selected={i === index}
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    i === index
                      ? isDark
                        ? 'bg-teal-400'
                        : 'bg-teal-600'
                      : isDark
                        ? 'bg-gray-600'
                        : 'bg-gray-300',
                  )}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex gap-2">
                {index > 0 ? (
                  <Button type="button" variant="secondary" size="sm" onClick={handleBack}>
                    Back
                  </Button>
                ) : (
                  <span className="min-w-[4rem]" aria-hidden />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
                {!last ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleNext}
                    disabled={isAiLoadingPlaceholder}
                    className="sm:min-w-[7rem]"
                  >
                    Next
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="primary" size="sm" onClick={handleBrowseBlocks} className="sm:min-w-[9rem]">
                      Browse blocks
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={handleExploreSolo}>
                      I&apos;ll explore on my own
                    </Button>
                  </>
                )}
              </div>
            </div>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm',
                isDark ? 'border-gray-600/80 bg-gray-900/50' : 'border-slate-200 bg-slate-50/90',
              )}
            >
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-400 text-teal-600 focus:ring-teal-500"
              />
              <span className={isDark ? 'text-gray-300' : 'text-slate-700'}>
                Don&apos;t show Stormi tips and walkthroughs again (turn back on under{' '}
                <span className="font-medium">My Hub → Journey Tips</span>)
              </span>
            </label>
          </div>
        </BlockCard>
      </HubSectionPanel>
    </Modal>
  )
}
