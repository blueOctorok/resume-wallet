'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * StormiNextStepCard — Stormi's proactive "do this next" card.
 *
 * In Guided Mode, Stormi is a coach — not a chatbot. This card reads the
 * live `fit` result and picks ONE concrete action. Once the user takes it,
 * the parent re-renders and the card proposes the next step. There is no
 * free-form chat in Apply mode; deeper exploration happens in Construct mode.
 *
 * Copy branches on:
 *   - No job selected → nudge to pick one
 *   - Empty hub + job selected → start with DOT application
 *   - No lens clears apply threshold → offer lens draft
 *   - `toneBand === 'redirect'` → suggest picking a better-fit job
 *   - Missing block → install the biggest gap
 *   - Fit ≥ 80% → apply now
 *   - Fallback → nudge to Construct mode for deeper Stormi help
 */

import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, ArrowUpDown, CheckCircle2, Compass, ExternalLink, Eye, LayoutDashboard, Loader2, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Button from '@/components/ui/Button'
import type { JobFitResult, PickBestLensResult } from '@/lib/job-fit'
import type { ReorderSuggestion } from '@/lib/card-reorder-suggestions'
import type { SelectedJobSnapshot } from '@/stores/simple-mode-store'

const APPLY_COVERAGE_THRESHOLD = 50

/**
 * If the best existing lens beats the second-best by < this much, Stormi
 * offers a secondary "tailor a lens" link.
 */
const LENS_DRAFT_MARGIN_THRESHOLD = 10

export interface StormiNextStepCardProps {
  snap: SelectedJobSnapshot | null
  fit: JobFitResult | null
  /** True when core DOT application is still empty / not started. */
  resumeNeedsStart: boolean
  onAddBlock: (blockId?: string) => void
  onApply: () => void
  /** Switch to Construct mode for deeper Stormi help. */
  onGoToWorkspace: () => void
  lensPick?: PickBestLensResult | null
  onDraftLens?: () => void
  isDraftingLens?: boolean
  /** Deterministic card reorder nudge for the selected job */
  reorderSuggestion?: ReorderSuggestion | null
  onApplyReorder?: () => void
  onDismissReorder?: () => void
  /** Block labels that are installed but have no data yet. */
  incompleteBlocks?: { blockType: string; label: string }[]
  /** True while the career card is still loading — Stormi shows a thinking state. */
  isCardLoading?: boolean
}

interface NextStep {
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
  resumeNeedsStart,
  onAddBlock,
  onApply,
  onGoToWorkspace,
  lensPick,
  onDraftLens,
  isDraftingLens = false,
  reorderSuggestion,
  onApplyReorder,
  onDismissReorder,
  incompleteBlocks,
  isCardLoading = false,
}: StormiNextStepCardProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const step: NextStep | null = useMemo(() => {
    // Card data still loading — null signals the thinking state below.
    if (isCardLoading && snap) return null

    // No job picked — the rail is the action.
    if (!snap || !fit) {
      return {
        icon: Compass,
        eyebrow: 'Start here',
        title: 'Pick a job from the list',
        body: 'Choose something you actually want. I\u2019ll map the exact blocks and credentials that role asks for.',
        primary: { label: 'Browse jobs \u2190', onClick: () => {}, variant: 'secondary' },
      }
    }

    // Installed blocks that haven't been started — warn before anything else.
    if (incompleteBlocks && incompleteBlocks.length > 0) {
      const names = incompleteBlocks.map((b) => b.label)
      const first = incompleteBlocks[0]
      const listText = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      return {
        icon: AlertTriangle,
        eyebrow: 'Heads up',
        title: `${names.length === 1 ? `${names[0]} needs` : 'Some blocks need'} your attention`,
        body: `You added ${listText} but haven\u2019t set ${names.length === 1 ? 'it' : 'them'} up yet. Finish ${names.length === 1 ? 'it' : 'them'} before applying \u2014 empty blocks won\u2019t help your card.`,
        primary: { label: `Set up ${first.label}`, onClick: () => onAddBlock(first.blockType) },
        secondary: names.length > 1
          ? { label: 'Go to Construct', onClick: onGoToWorkspace }
          : undefined,
      }
    }

    // No lens clears a minimal coverage floor — draft one before pushing blocks.
    if (
      onDraftLens &&
      lensPick &&
      lensPick.best &&
      lensPick.best.score < APPLY_COVERAGE_THRESHOLD &&
      !resumeNeedsStart
    ) {
      return {
        icon: Eye,
        eyebrow: 'Reframe',
        title: 'Let me tailor a lens for this role',
        body: `None of your lenses clear ${APPLY_COVERAGE_THRESHOLD}% for \u201c${snap.title}\u201d. I can reshape what your card emphasizes \u2014 your blocks stay untouched.`,
        primary: {
          label: isDraftingLens ? 'Drafting\u2026' : 'Tailor a lens',
          onClick: () => { if (!isDraftingLens) onDraftLens() },
        },
      }
    }

    // Fresh card — drivers-wedge spine is the DOT application.
    if (resumeNeedsStart) {
      return {
        icon: Plus,
        eyebrow: 'Do this next',
        title: 'Start your DOT application',
        body: `Your driver qualification file is the hub spine \u2014 it\u2019s the first big step for \u201c${snap.title}\u201d.`,
        primary: { label: 'Open DOT Application', onClick: () => onAddBlock('driver-dot-application') },
      }
    }

    // Job-matched credentials buried on page 2+ or deep in the list — one-tap reorder.
    if (reorderSuggestion && onApplyReorder && onDismissReorder) {
      return {
        icon: ArrowUpDown,
        eyebrow: 'For this job',
        title: 'Bring key credentials up front',
        body: reorderSuggestion.reason,
        primary: { label: 'Reorder for this job', onClick: onApplyReorder },
        secondary: { label: 'Keep current order', onClick: onDismissReorder },
      }
    }

    // Low-fit stretch — suggest picking a better-fit job instead of grinding blocks.
    if (fit.toneBand === 'redirect') {
      return {
        icon: Compass,
        eyebrow: 'Honest take',
        title: 'This one\u2019s a stretch right now',
        body: `Your card is only ${fit.score}% coverage for \u201c${snap.title}\u201d. Try picking a role that\u2019s closer to what you\u2019ve built \u2014 or switch to Construct mode for deeper AI help.`,
        primary: { label: 'Pick a closer fit \u2190', onClick: () => {}, variant: 'secondary' },
        secondary: { label: 'Go to Construct', onClick: onGoToWorkspace },
      }
    }

    // Ready to apply.
    if (fit.score >= APPLY_COVERAGE_THRESHOLD && fit.score >= 80) {
      const polish = fit.missingRequirements[0]
      return {
        icon: CheckCircle2,
        eyebrow: 'You\u2019re ready',
        title: `${fit.score}% coverage \u2014 apply now`,
        body: polish
          ? `Strong match for ${snap.title}. You can apply today, or polish by adding ${polish.label.toLowerCase()}.`
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

    // Just above the apply line — lead with the missing block.
    const nextBlock = fit.recommendedBlocks[0]
    if (nextBlock) {
      const crossesThreshold = fit.score < APPLY_COVERAGE_THRESHOLD
      const shouldOfferDraft = Boolean(
        onDraftLens &&
          lensPick &&
          lensPick.best &&
          lensPick.margin !== null &&
          lensPick.margin < LENS_DRAFT_MARGIN_THRESHOLD,
      )
      return {
        icon: Plus,
        eyebrow: 'Do this next',
        title: `Add ${nextBlock.label}`,
        body: crossesThreshold
          ? `This pushes you past the ${APPLY_COVERAGE_THRESHOLD}% apply line for \u201c${snap.title}\u201d.`
          : `Biggest single gap for \u201c${snap.title}\u201d \u2014 closes about ${Math.max(5, Math.round(100 / (fit.missingRequirements.length || 1)))} points.`,
        primary: { label: `Add ${nextBlock.label}`, onClick: () => onAddBlock(nextBlock.id) },
        secondary: shouldOfferDraft
          ? {
              label: isDraftingLens ? 'Drafting lens\u2026' : 'Tailor a lens instead',
              onClick: () => { if (!isDraftingLens && onDraftLens) onDraftLens() },
            }
          : undefined,
      }
    }

    // Fallback — nothing obvious missing from heuristic. Nudge to Construct mode
    // where Stormi chat can do a deeper review.
    return {
      icon: Sparkles,
      eyebrow: 'Next move',
      title: `${fit.score}% coverage \u2014 looking good`,
      body: `I don\u2019t see an obvious gap for \u201c${snap.title}\u201d. Switch to Construct mode where I can do a deeper card review.`,
      primary: {
        label: snap.isStormChain || snap.redirectUrl
          ? (snap.isStormChain ? 'Apply with career card' : 'Open employer site')
          : 'Go to Construct',
        onClick: snap.isStormChain || snap.redirectUrl ? onApply : onGoToWorkspace,
      },
      secondary: snap.isStormChain || snap.redirectUrl
        ? { label: 'Go to Construct', onClick: onGoToWorkspace }
        : undefined,
    }
  }, [
    snap,
    fit,
    resumeNeedsStart,
    onAddBlock,
    onApply,
    onGoToWorkspace,
    lensPick,
    onDraftLens,
    isDraftingLens,
    reorderSuggestion,
    onApplyReorder,
    onDismissReorder,
    incompleteBlocks,
    isCardLoading,
  ])

  // Thinking state while card data loads
  if (!step) {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl border px-3 py-3',
          isDark
            ? 'border-violet-400/20 bg-violet-500/5'
            : 'border-violet-200/60 bg-violet-50/40 shadow-sm',
        )}
      >
        <div
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-lg',
            isDark
              ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30'
              : 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
          )}
        >
          <Loader2 className='size-3 animate-spin' />
        </div>
        <div className='min-w-0 flex-1'>
          <p
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider',
              isDark ? 'text-violet-300/80' : 'text-violet-600',
            )}
          >
            Assistant
          </p>
          <p
            className={cn(
              'text-[13px] font-semibold leading-snug',
              isDark ? 'text-white' : 'text-slate-900',
            )}
          >
            Analyzing your card&hellip;
          </p>
          <div className='mt-1 flex items-center gap-1'>
            <span className={cn('size-1.5 rounded-full animate-pulse', isDark ? 'bg-violet-400' : 'bg-violet-500')} style={{ animationDelay: '0ms' }} />
            <span className={cn('size-1.5 rounded-full animate-pulse', isDark ? 'bg-violet-400' : 'bg-violet-500')} style={{ animationDelay: '200ms' }} />
            <span className={cn('size-1.5 rounded-full animate-pulse', isDark ? 'bg-violet-400' : 'bg-violet-500')} style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      </div>
    )
  }

  const Icon = step.icon

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border px-3 py-2.5',
        isDark
          ? 'border-violet-400/20 bg-violet-500/5'
          : 'border-violet-200/60 bg-violet-50/40 shadow-sm',
      )}
    >
      <div className='flex items-start gap-2'>
        <div
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg',
            isDark
              ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30'
              : 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
          )}
        >
          <Icon className='size-3' />
        </div>
        <div className='min-w-0 flex-1'>
          <p
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider',
              isDark ? 'text-violet-300/80' : 'text-violet-600',
            )}
          >
            {step.eyebrow}
          </p>
          <p
            className={cn(
              'text-[13px] font-semibold leading-snug',
              isDark ? 'text-white' : 'text-slate-900',
            )}
          >
            {step.title}
          </p>
          <p
            className={cn(
              'mt-0.5 text-[11px] leading-relaxed',
              isDark ? 'text-gray-300' : 'text-slate-600',
            )}
          >
            {step.body}
          </p>
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-1.5 pl-8'>
        <Button
          variant={step.primary.variant ?? 'primary'}
          size='sm'
          onClick={step.primary.onClick}
          className='gap-1 !px-2.5 !py-1 !text-xs'
          disabled={isDraftingLens && step.primary.label.toLowerCase().startsWith('drafting')}
        >
          {isDraftingLens && step.primary.label.toLowerCase().startsWith('drafting') ? (
            <Loader2 className='size-3 animate-spin' />
          ) : null}
          {step.primary.label}
          {!(isDraftingLens && step.primary.label.toLowerCase().startsWith('drafting')) && (
            <ArrowRight className='size-3' />
          )}
        </Button>
        {step.secondary && (
          <Button
            variant='ghost'
            size='sm'
            onClick={step.secondary.onClick}
            className='!px-2 !py-1 !text-[11px]'
            disabled={isDraftingLens && step.secondary.label.toLowerCase().startsWith('drafting')}
          >
            {isDraftingLens && step.secondary.label.toLowerCase().startsWith('drafting') ? (
              <Loader2 className='size-3 animate-spin mr-0.5 inline' />
            ) : null}
            {step.secondary.label === 'Go to Construct' && <LayoutDashboard className='mr-0.5 size-3 inline' />}
            {step.secondary.label}
          </Button>
        )}
        {step.primary.label === 'Open employer site' && (
          <ExternalLink
            aria-hidden
            className={cn('size-3 self-center', isDark ? 'text-gray-500' : 'text-slate-400')}
          />
        )}
      </div>
    </div>
  )
}
