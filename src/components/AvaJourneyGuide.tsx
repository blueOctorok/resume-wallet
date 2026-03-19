'use client'

import { useEffect, useRef } from 'react'
import {
  X,
  Check,
  Circle,
  ArrowRight,
  Bot,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJourneyStore, useJourneyProgress, useUIStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import type { JourneyStep, NextAction } from '@/lib/journey-progress'
import type { PageType } from '@/stores/types'

// ===== Main component =====

export default function AvaJourneyGuide() {
  const { isGuideOpen, closeGuide, toggleGuide } = useJourneyStore()

  // Cmd+/ (Ctrl+/) toggles AvA
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        toggleGuide()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleGuide])

  const progress = useJourneyProgress()
  const { setCurrentPage } = useUIStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const openPicker = useHubBlocksStore((s) => s.openPicker)

  const handleNavigate = (target: PageType) => {
    if (target === ('block-store' as PageType)) {
      closeGuide()
      openPicker()
      return
    }
    const normalized: PageType = target === 'hub' || target === 'signin' ? null : target
    setCurrentPage(normalized)
    closeGuide()
  }

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isGuideOpen) closeGuide()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isGuideOpen, closeGuide])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeGuide()
      }
    }
    if (isGuideOpen) {
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isGuideOpen, closeGuide])

  if (!isGuideOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40',
          'bg-black/20 dark:bg-black/40',
          'backdrop-blur-sm',
          'transition-opacity duration-300'
        )}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50',
          'w-full max-w-md',
          'bg-white dark:bg-gray-900',
          'border-l border-gray-200 dark:border-gray-700',
          'shadow-2xl',
          'flex flex-col',
          'transform transition-transform duration-300 ease-out',
          isGuideOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="AvA Journey Guide"
      >
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-mint/10 to-transparent">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-full',
                'bg-gradient-to-br from-brand-mint to-brand-mint/70',
                'flex items-center justify-center',
                'shadow-lg shadow-brand-mint/25'
              )}>
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Your Journey
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Track your progress
                </p>
              </div>
            </div>
            <button
              onClick={closeGuide}
              className={cn(
                'p-2 rounded-lg',
                'text-gray-400 hover:text-gray-600',
                'dark:text-gray-500 dark:hover:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'transition-colors'
              )}
              aria-label="Close guide"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Greeting */}
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            {progress.greeting}
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <ProgressOverview progress={progress} />
          <StepsChecklist steps={progress.steps} onNavigate={handleNavigate} />
          {progress.nextActions.length > 0 && (
            <NextActionsSection actions={progress.nextActions} onNavigate={handleNavigate} />
          )}
        </div>
      </div>
    </>
  )
}

// ===== Progress sub-components =====

interface ProgressOverviewProps {
  progress: {
    overallProgress: number
    completedSteps: number
    totalSteps: number
  }
}

function ProgressOverview({ progress }: ProgressOverviewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Your Journey
        </span>
        <span className="text-sm font-bold text-brand-mint">
          {progress.completedSteps}/{progress.totalSteps} steps
        </span>
      </div>

      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            'bg-gradient-to-r from-brand-mint to-brand-mint/80'
          )}
          style={{ width: `${progress.overallProgress}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Getting started</span>
        <span className="font-semibold text-brand-mint">{progress.overallProgress}% complete</span>
        <span>Ready to go!</span>
      </div>
    </div>
  )
}

interface StepsChecklistProps {
  steps: JourneyStep[]
  onNavigate: (target: PageType) => void
}

function StepsChecklist({ steps, onNavigate }: StepsChecklistProps) {
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const { closeGuide } = useJourneyStore()

  if (steps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-gray-700 dark:text-gray-300">Add blocks to get started</p>
        <p className="text-sm mt-1">
          Install blocks to your hub and AvA will guide you through each one.
        </p>
        <button
          onClick={() => { closeGuide(); openPicker() }}
          className={cn(
            'mt-4 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            'bg-brand-mint text-white hover:bg-brand-mint/90'
          )}
        >
          Browse Blocks
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Your Progress
      </h3>
      <div className="space-y-1">
        {steps.map((step, index) => (
          <StepItem key={step.id} step={step} index={index} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  )
}

interface StepItemProps {
  step: JourneyStep
  index: number
  onNavigate: (target: PageType) => void
}

function StepItem({ step, onNavigate }: StepItemProps) {
  const isClickable = step.status !== 'complete' && step.action

  const handleClick = () => {
    if (isClickable && step.action?.target) {
      onNavigate(step.action.target)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={!isClickable}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
        step.status === 'complete' && 'bg-green-50 dark:bg-green-900/20',
        step.status === 'in_progress' && 'bg-brand-mint/10 dark:bg-brand-mint/20 ring-2 ring-brand-mint/30',
        step.status === 'pending' && 'bg-gray-50 dark:bg-gray-800/50',
        isClickable && 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer',
        !isClickable && 'cursor-default'
      )}
    >
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        step.status === 'complete' && 'bg-green-500 text-white',
        step.status === 'in_progress' && 'bg-brand-mint text-white',
        step.status === 'pending' && 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
      )}>
        {step.status === 'complete' && <Check className="w-4 h-4" />}
        {step.status === 'in_progress' && <Loader2 className="w-4 h-4 animate-spin" />}
        {step.status === 'pending' && <Circle className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium',
            step.status === 'complete' && 'text-green-700 dark:text-green-400',
            step.status === 'in_progress' && 'text-brand-mint dark:text-brand-mint',
            step.status === 'pending' && 'text-gray-600 dark:text-gray-400'
          )}>
            {step.label}
          </span>
          {step.isOptional && (
            <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
              optional
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {step.description}
        </p>
        {step.progress !== undefined && step.status !== 'complete' && (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-mint rounded-full transition-all"
                style={{ width: `${step.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{step.progress}%</span>
          </div>
        )}
      </div>

      {isClickable && (
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      )}
    </button>
  )
}

interface NextActionsSectionProps {
  actions: NextAction[]
  onNavigate: (target: PageType) => void
}

function NextActionsSection({ actions, onNavigate }: NextActionsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-brand-mint" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Suggested Next Steps
        </h3>
      </div>

      <div className="space-y-2">
        {actions.map((action, index) => (
          <button
            key={action.target || index}
            onClick={() => action.target && onNavigate(action.target)}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all',
              'bg-gradient-to-r',
              action.priority === 'high' && 'from-brand-mint/20 to-brand-mint/5 hover:from-brand-mint/30 hover:to-brand-mint/10',
              action.priority === 'medium' && 'from-blue-500/10 to-blue-500/5 hover:from-blue-500/20 hover:to-blue-500/10',
              action.priority === 'low' && 'from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/50 hover:from-gray-200 hover:to-gray-100 dark:hover:from-gray-700 dark:hover:to-gray-800',
              'border',
              action.priority === 'high' && 'border-brand-mint/30',
              action.priority === 'medium' && 'border-blue-500/20',
              action.priority === 'low' && 'border-gray-200 dark:border-gray-700'
            )}
          >
            <div className="flex-1">
              <span className={cn(
                'font-semibold block',
                action.priority === 'high' && 'text-brand-mint',
                action.priority === 'medium' && 'text-blue-600 dark:text-blue-400',
                action.priority === 'low' && 'text-gray-700 dark:text-gray-300'
              )}>
                {action.label}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {action.description}
              </span>
            </div>
            <ArrowRight className={cn(
              'w-5 h-5 flex-shrink-0',
              action.priority === 'high' && 'text-brand-mint',
              action.priority === 'medium' && 'text-blue-500',
              action.priority === 'low' && 'text-gray-400'
            )} />
          </button>
        ))}
      </div>
    </div>
  )
}
