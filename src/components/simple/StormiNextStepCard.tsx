'use client'

/**
 * StormiNextStepCard — Stormi's proactive "do this next" card.
 *
 * Simple Mode uses Stormi as a coach, not a chat toy. This card reads the
 * live `fit` result and picks ONE concrete action for the user. Once they
 * take it, the parent re-renders and the card proposes the next step.
 *
 * Copy branches on:
 *   - No job selected
 *   - Empty hub (zero blocks) + job selected
 *   - `toneBand === 'redirect'` → offer alternate jobs (opens chat preset)
 *   - Missing block + fit < apply threshold → install the biggest gap
 *   - Fit ≥ apply threshold → apply now (+ optional polish)
 *
 * The card itself is presentational — the parent wires side effects (open
 * picker, open apply modal, expand chat with preset).
 */

import { useMemo } from 'react'
import { ArrowRight, CheckCircle2, Compass, ExternalLink, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Button from '@/components/ui/Button'
import type { JobFitResult } from '@/lib/job-fit'
import type { SelectedJobSnapshot } from '@/stores/simple-mode-store'

/** Match the threshold used in `SimpleJobDetailPanel` so the card and the apply button agree. */
const APPLY_COVERAGE_THRESHOLD = 50

export interface StormiNextStepCardProps {
  snap: SelectedJobSnapshot | null
  fit: JobFitResult | null
  installedCount: number
  /** Open the block picker modal (hub store). */
  onAddBlock: (blockId?: string) => void
  /** Fire the apply flow. StormChain opens the modal; Adzuna opens the redirect URL. */
  onApply: () => void
  /**
   * Expand the chat drawer with a preset message. `null` = open without presetting
   * so the user types their own. A preset string asks Stormi to act directly.
   */
  onAskStormi: (presetMessage: string | null) => void
}

interface NextStep {
  /** Icon rendered in the rail-style accent tile. */
  icon: typeof Plus
  eyebrow: string
  title: string
  body: string
  primary: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }
  secondary?: { label: string; onClick: () => void }
}

export default function StormiNextStepCard({
  snap,
  fit,
  installedCount,
  onAddBlock,
  onApply,
  onAskStormi,
}: StormiNextStepCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const step: NextStep = useMemo(() => {
    // No job picked — the rail is the action. Card nudges to that.
    if (!snap || !fit) {
      return {
        icon: Compass,
        eyebrow: 'Start here',
        title: 'Pick a job and I\u2019ll build your card around it',
        body: 'Choose something you actually want. I\u2019ll map the exact blocks and credentials that role asks for.',
        primary: { label: 'Ask me for ideas', onClick: () => onAskStormi('What kinds of jobs fit what I have today?'), variant: 'secondary' },
      }
    }

    // Fresh hub — the universal first step is a resume.
    if (installedCount === 0) {
      return {
        icon: Plus,
        eyebrow: 'Do this next',
        title: 'Start with a STORM resume',
        body: `Almost every role wants one \u2014 adding it is your first ~30% of coverage for "${snap.title}" and unlocks Career Card sharing.`,
        primary: { label: 'Add STORM Resume', onClick: () => onAddBlock('storm-resume') },
      }
    }

    // Low-fit stretch — redirect to closer jobs instead of pushing blocks.
    if (fit.toneBand === 'redirect') {
      return {
        icon: Compass,
        eyebrow: 'Honest take',
        title: 'This one\u2019s a stretch right now',
        body: `Your card is only ${fit.score}% coverage for "${snap.title}". I can find closer fits that actually match what you\u2019ve built.`,
        primary: {
          label: 'Show closer jobs',
          onClick: () =>
            onAskStormi(`Suggest jobs that are a better match for my current blocks than "${snap.title}".`),
        },
        secondary: { label: 'I still want to try', onClick: () => onAskStormi(null) },
      }
    }

    // Ready to apply — one primary action, polish as optional.
    if (fit.score >= APPLY_COVERAGE_THRESHOLD && fit.score >= 80) {
      const polish = fit.missingRequirements[0]
      return {
        icon: CheckCircle2,
        eyebrow: 'You\u2019re ready',
        title: `${fit.score}% coverage \u2014 apply now`,
        body: polish
          ? `Strong match for ${snap.title}. You can apply today, or polish first by adding ${polish.label.toLowerCase()}.`
          : `Strong match for ${snap.title}. Go send it.`,
        primary: {
          label: snap.isStormChain ? 'Apply with career card' : 'Open employer site',
          onClick: onApply,
        },
        secondary: polish
          ? { label: `Polish \u2014 add ${polish.label.toLowerCase()}`, onClick: () => onAddBlock(polish.blockId) }
          : undefined,
      }
    }

    // Just above the apply line but still closing gaps — lead with the missing block.
    const nextBlock = fit.recommendedBlocks[0]
    if (nextBlock) {
      const crossesThreshold = fit.score < APPLY_COVERAGE_THRESHOLD
      return {
        icon: Plus,
        eyebrow: 'Do this next',
        title: `Add ${nextBlock.label}`,
        body: crossesThreshold
          ? `This pushes you past the ${APPLY_COVERAGE_THRESHOLD}% apply line for "${snap.title}".`
          : `Biggest single gap for "${snap.title}" \u2014 closes about ${Math.max(5, Math.round(100 / (fit.missingRequirements.length || 1)))} points.`,
        primary: { label: `Add ${nextBlock.label}`, onClick: () => onAddBlock(nextBlock.id) },
        secondary: { label: 'Ask Stormi why', onClick: () => onAskStormi(`Why does adding ${nextBlock.label} help me for ${snap.title}?`) },
      }
    }

    // Fallback — job selected, blocks installed, nothing specific missing from heuristic.
    // Steer toward applying or asking Stormi for a deeper review.
    return {
      icon: Sparkles,
      eyebrow: 'Next move',
      title: `${fit.score}% coverage \u2014 what now?`,
      body: `I don\u2019t see an obvious missing block for "${snap.title}". Want me to review your card and suggest the smartest polish?`,
      primary: {
        label: 'Review my card',
        onClick: () => onAskStormi(`Review my career card for "${snap.title}" and suggest the smartest polish.`),
      },
      secondary: snap.isStormChain || snap.redirectUrl
        ? {
            label: snap.isStormChain ? 'Apply with career card' : 'Open employer site',
            onClick: onApply,
          }
        : undefined,
    }
  }, [snap, fit, installedCount, onAddBlock, onApply, onAskStormi])

  const Icon = step.icon

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-start gap-3'>
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
            isDark
              ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30'
              : 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
          )}
        >
          <Icon className='h-4 w-4' />
        </div>
        <div className='min-w-0 flex-1'>
          <p
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider mb-0.5',
              isDark ? 'text-violet-300/80' : 'text-violet-600',
            )}
          >
            {step.eyebrow}
          </p>
          <p
            className={cn(
              'text-sm font-semibold leading-snug',
              isDark ? 'text-white' : 'text-slate-900',
            )}
          >
            {step.title}
          </p>
          <p
            className={cn(
              'mt-1 text-xs leading-relaxed',
              isDark ? 'text-gray-300' : 'text-slate-600',
            )}
          >
            {step.body}
          </p>
        </div>
      </div>
      <div className='flex flex-wrap gap-2 pl-12'>
        <Button
          variant={step.primary.variant ?? 'primary'}
          size='sm'
          onClick={step.primary.onClick}
          className='gap-1'
        >
          {step.primary.label}
          <ArrowRight className='w-3.5 h-3.5' />
        </Button>
        {step.secondary && (
          <Button variant='ghost' size='sm' onClick={step.secondary.onClick}>
            {step.secondary.label}
          </Button>
        )}
        {/* External-site apply icon hint for Adzuna at ≥80% */}
        {step.primary.label === 'Open employer site' && (
          <ExternalLink
            aria-hidden
            className={cn('w-3.5 h-3.5 self-center', isDark ? 'text-gray-500' : 'text-slate-400')}
          />
        )}
      </div>
    </div>
  )
}
