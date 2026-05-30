'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * Shared Stormi chat — clean empty state with robot avatar + prominent "Ask Stormi" title.
 * No auto-welcome call. Suggested prompts as chips. Thread appears after first send.
 */

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  Coins,
  ExternalLink,
  ListChecks,
  Loader2,
  Maximize2,
  Minimize2,
  Send,
  Sparkles,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { cn } from '@/lib/utils'
import type { HubContext, SimpleModeContext } from '@/lib/ava-context'
import { buildCandidateAutoWelcomeUserMessage } from '@/lib/ava-auto-welcome'
import {
  sendToStormi,
  OutOfCreditsError,
  type ChatMessage,
  type StormiUsageInfo,
  type EmployerHubContext,
} from '@/lib/ava-chat'
import type { StormiInterviewPrepPayload } from '@/lib/stormi-interactive-types'
import { loadStormiChatMessages, saveStormiChatMessages } from '@/lib/ava-chat-persistence'
import type { StormiJobSuggestion } from '@/lib/ava-job-suggestions'
import StormiCreditModal from '@/components/StormiCreditModal'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal, { ModalHeader } from '@/components/ui/Modal'

const StormApplyBridge = dynamic(() => import('@/components/apply/StormApplyBridge'), {
  ssr: false,
})

/** Shape expected by StormApplyBridge `job` prop */
function toApplyModalJob(j: StormiJobSuggestion) {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    redirect_url: j.redirectUrl ?? undefined,
    salary: j.salary ?? undefined,
    is_external: true as const,
  }
}

/** Ranked job cards under a Stormi turn — Yes/No + apply-to-#1 shortcut; skips are per-message local state */
function StormiJobSuggestionCards(props: {
  messageIndex: number
  jobs: StormiJobSuggestion[]
  dismissed: Record<string, true>
  onDismiss: (messageIndex: number, jobId: string) => void
  onApply: (job: StormiJobSuggestion) => void
  isDark: boolean
  /** Wider layout: 2-col grid for listings on md+ */
  expandedLayout: boolean
}) {
  const { messageIndex, jobs, dismissed, onDismiss, onApply, isDark, expandedLayout } = props
  const visible = jobs.filter((j) => !dismissed[`${messageIndex}-${j.id}`])

  if (visible.length === 0) {
    return (
      <p
        className={cn(
          'text-xs rounded-xl px-3 py-2 border border-dashed',
          isDark ? 'text-gray-500 border-gray-600 bg-gray-800/40' : 'text-slate-500 border-slate-200 bg-slate-50',
        )}
      >
        You skipped these. Ask Stormi for another search or tweak what you&apos;re looking for.
      </p>
    )
  }

  const topTitle =
    visible[0].title.length > 44 ? `${visible[0].title.slice(0, 44)}…` : visible[0].title

  const useGrid = expandedLayout && visible.length >= 2

  return (
    <div
      className={cn(
        useGrid ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-2',
      )}
    >
      {visible.length >= 2 && (
        <Button
          variant='primary'
          size='sm'
          className={cn('text-xs', useGrid ? 'md:col-span-2 w-full' : 'w-full')}
          onClick={() => onApply(visible[0])}
        >
          Apply to best match (#1 — {topTitle})
        </Button>
      )}
      {visible.map((job) => (
        <Card
          key={job.id}
          variant='elevated'
          className={cn(
            'p-3 border flex flex-col',
            isDark ? 'border-gray-700 bg-gray-800/80' : 'border-gray-200 bg-white',
            useGrid && 'min-h-0',
          )}
        >
          <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
            {job.title}
          </p>
          <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-slate-600')}>
            {job.company} · {job.location}
          </p>
          {job.salary && (
            <p className={cn('text-[11px] mt-1', isDark ? 'text-gray-500' : 'text-slate-500')}>
              {job.salary}
            </p>
          )}
          <p
            className={cn('text-[11px] mt-1.5 italic', isDark ? 'text-sky-300/90' : 'text-sky-800')}
          >
            Match {job.score}% — {job.reason}
          </p>
          <p
            className={cn('text-[10px] mt-2 font-medium', isDark ? 'text-gray-500' : 'text-slate-500')}
          >
            Want to apply with your Career Card?
          </p>
          <div
            className={cn(
              'flex flex-wrap gap-2 mt-auto pt-2',
              expandedLayout && 'flex-col sm:flex-row sm:flex-wrap',
            )}
          >
            <Button variant='primary' size='sm' className='text-xs w-full sm:w-auto' onClick={() => onApply(job)}>
              Yes — apply
            </Button>
            <Button
              variant='secondary'
              size='sm'
              className='text-xs w-full sm:w-auto'
              onClick={() => onDismiss(messageIndex, job.id)}
            >
              No, skip
            </Button>
            {job.redirectUrl ? (
              <Button
                variant='ghost'
                size='sm'
                className={cn(
                  'text-xs w-full sm:w-auto justify-center',
                  isDark ? 'text-sky-400 hover:text-sky-300' : 'text-sky-700 hover:text-sky-800',
                )}
                onClick={() => window.open(job.redirectUrl!, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className='w-3.5 h-3.5 mr-1' />
                View listing
              </Button>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  )
}

/** Interactive interview prep — tap MCQ option to reveal coaching (practice only, not live cheating). */
function StormiInterviewPrepBlock(props: {
  prep: StormiInterviewPrepPayload
  selectedId: string | undefined
  isDark: boolean
  onSelect: (choiceId: string) => void
}) {
  const { prep, selectedId, isDark, onSelect } = props
  const selectedChoice = selectedId ? prep.choices.find((c) => c.id === selectedId) : undefined

  return (
    <Card
      variant='elevated'
      className={cn(
        'p-3 border text-left',
        isDark ? 'border-violet-500/30 bg-gray-900/60' : 'border-violet-200 bg-violet-50/40',
      )}
    >
      <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1', isDark ? 'text-violet-300' : 'text-violet-800')}>
        Practice question
      </p>
      <p className={cn('text-sm font-semibold mb-3', isDark ? 'text-white' : 'text-slate-900')}>{prep.question}</p>
      <div className='flex flex-col gap-2'>
        {prep.choices.map((c) => {
          const isChosen = selectedId === c.id
          const showStar = isChosen && c.id === prep.recommendedChoiceId
          return (
            <Button
              key={c.id}
              type='button'
              variant={isChosen ? 'primary' : 'secondary'}
              size='sm'
              disabled={selectedId != null}
              className='text-xs justify-start text-left h-auto py-2 min-h-0 whitespace-normal'
              onClick={() => onSelect(c.id)}
            >
              <span className='font-mono text-[10px] opacity-70 mr-2'>{c.id.toUpperCase()}</span>
              {c.text}
              {showStar ? (
                <CheckCircle2 className='w-3.5 h-3.5 ml-auto shrink-0 text-white dark:text-gray-900' />
              ) : null}
            </Button>
          )
        })}
      </div>
      {selectedChoice && (
        <div
          className={cn(
            'mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed border',
            isDark ? 'bg-gray-800/80 border-gray-600 text-gray-300' : 'bg-white border-slate-200 text-slate-700',
          )}
        >
          <p className='font-semibold mb-1'>Coaching</p>
          <p>{selectedChoice.feedback}</p>
          {selectedId === prep.recommendedChoiceId ? (
            <p className={cn('mt-2 font-medium', isDark ? 'text-teal-300' : 'text-teal-700')}>
              Strongest answer for most interviews — adapt with your real stories.
            </p>
          ) : (
            <p className={cn('mt-2', isDark ? 'text-gray-500' : 'text-slate-500')}>
              Review the other options above, or ask for another practice question in the chat.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

export type StormiChatPanelProps =
  | {
      mode: 'candidate'
      walletAddress: string | null
      hubContext: HubContext
      candidateEmptyHub: boolean
      /** From GET /api/hub/blocks `avaAutoWelcomeCandidateDone` */
      stormiAutoWelcomeCandidateDone: boolean
      onStormiAutoWelcomeSynced?: () => void
      /**
       * Candidate hub only: parent wraps this in `HubSectionPanel` + `BlockCard variant="embed"`.
       * Drops the standalone glow shell and duplicate empty-state title/copy (header lives on BlockCard).
       */
      hubEmbedSurface?: boolean
      /** Guided (Simple) mode — job + fit; switches server system prompt + per-job chat persistence */
      simpleModeContext?: SimpleModeContext | null
    }
  | {
      mode: 'employer'
      walletAddress: string | null
      employerContext: EmployerHubContext
      /** From employer hub API `avaAutoWelcomeEmployerDone` */
      stormiAutoWelcomeEmployerDone: boolean
      onStormiAutoWelcomeSynced?: () => void
      /**
       * Employer hub: parent wraps in `HubSectionPanel` + `BlockCard variant="embed"` (same as candidate).
       * Skips standalone glow shell and duplicate empty-state hero — header lives on BlockCard.
       */
      hubEmbedSurface?: boolean
    }

export default function StormiChatPanel(props: StormiChatPanelProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const hubEmbedSurface =
    props.mode === 'candidate'
      ? Boolean(props.hubEmbedSurface)
      : props.mode === 'employer'
        ? Boolean(props.hubEmbedSurface)
        : false
  const openStormiContextModal = useHubBlocksStore((s) => s.openStormiContextModal)
  const walletAddress = props.walletAddress
  const persistenceMode = props.mode

  /** Narrow once so effects / deps don't touch discriminated-union props awkwardly. */
  const candidateSimpleModeContext =
    props.mode === 'candidate' ? (props.simpleModeContext ?? null) : null
  const candidateStormiAutoWelcomeDone =
    props.mode === 'candidate' ? props.stormiAutoWelcomeCandidateDone : true

  const guidedJobId = candidateSimpleModeContext ? candidateSimpleModeContext.job.id : null

  const [messages, setMessages] = useState<ChatMessage[]>([])
  /** Avoid writing [] to storage before we have loaded prior thread */
  const [persistReady, setPersistReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [outOfCredits, setOutOfCredits] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [usage, setUsage] = useState<StormiUsageInfo | null>(null)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  /** External job chosen from Stormi-ranked cards — opens shared apply modal */
  const [applyJob, setApplyJob] = useState<ReturnType<typeof toApplyModalJob> | null>(null)
  /** Per-message job dismissals (No, skip) — key `${msgIndex}-${jobId}` */
  const [dismissedJobKeys, setDismissedJobKeys] = useState<Record<string, true>>({})
  /** Larger thread + wider bubbles + 2-col job cards (candidate) */
  const [chatExpanded, setChatExpanded] = useState(false)

  const hubContextRef = useRef<HubContext>({})
  const candidateEmptyHubRef = useRef(false)
  const onAutoWelcomeSyncedRef = useRef<(() => void) | undefined>(undefined)
  if (props.mode === 'candidate') {
    hubContextRef.current = props.hubContext
    candidateEmptyHubRef.current = props.candidateEmptyHub
    onAutoWelcomeSyncedRef.current = props.onStormiAutoWelcomeSynced
  }

  const [talkingPointsModalOpen, setTalkingPointsModalOpen] = useState(false)
  const [tpJobTitle, setTpJobTitle] = useState('')
  const [tpCompany, setTpCompany] = useState('')
  const [tpDescription, setTpDescription] = useState('')
  const [tpLoading, setTpLoading] = useState(false)
  const [tpError, setTpError] = useState<string | null>(null)

  const dismissJobSuggestion = useCallback((messageIndex: number, jobId: string) => {
    const k = `${messageIndex}-${jobId}`
    setDismissedJobKeys((prev) => ({ ...prev, [k]: true }))
  }, [])

  // Restore thread after refresh (per wallet + candidate vs employer)
  useEffect(() => {
    if (!walletAddress) {
      setMessages([])
      setPersistReady(true)
      return
    }
    setMessages(loadStormiChatMessages(persistenceMode, walletAddress, guidedJobId))
    setPersistReady(true)
  }, [walletAddress, persistenceMode, guidedJobId])

  useEffect(() => {
    if (!persistReady || !walletAddress) return
    saveStormiChatMessages(persistenceMode, walletAddress, messages, guidedJobId)
  }, [messages, walletAddress, persistenceMode, persistReady, guidedJobId])

  // First open on candidate hub: one auto-welcome turn (DB idempotent via `autoWelcome: 'candidate'`).
  useEffect(() => {
    if (props.mode !== 'candidate') return
    if (candidateSimpleModeContext) return
    if (!walletAddress || !persistReady) return
    if (candidateStormiAutoWelcomeDone) return
    if (messages.length > 0) return

    const sessionKey = `stormi_autowelcome_fire_${walletAddress}`
    try {
      if (sessionStorage.getItem(sessionKey) === '1') return
      sessionStorage.setItem(sessionKey, '1')
    } catch {
      /* if storage blocked, still attempt once per mount */
    }

    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      setChatError(null)
      try {
        const welcomeMessage = buildCandidateAutoWelcomeUserMessage(
          hubContextRef.current,
          candidateEmptyHubRef.current,
        )
        const res = await sendToStormi({
          message: welcomeMessage,
          walletAddress,
          hubContext: hubContextRef.current,
          autoWelcome: 'candidate',
        })
        if (cancelled) return
        setMessages([{ role: 'ava', text: res.reply }])
        setUsage(res.usage)
        onAutoWelcomeSyncedRef.current?.()
      } catch (err) {
        if (cancelled) return
        try {
          sessionStorage.removeItem(sessionKey)
        } catch {
          /* ignore */
        }
        if (err instanceof OutOfCreditsError) {
          setOutOfCredits(true)
          setUsage(err.usage)
        } else {
          setChatError(err instanceof Error ? err.message : 'Auto-welcome failed')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hubContext updates often; refs hold latest for the one-shot welcome
  }, [
    props.mode,
    walletAddress,
    persistReady,
    candidateStormiAutoWelcomeDone,
    messages.length,
    candidateSimpleModeContext,
  ])

  // Guided mode: one-shot opening when a job is selected and the thread is empty.
  // Track which guided job id we've already attempted bootstrap for so a
  // failed bootstrap (network error, out-of-credits) doesn't re-fire.
  const guidedBootstrapAttemptedRef = useRef<string | null>(null)

  useEffect(() => {
    if (props.mode !== 'candidate') return
    const sm = candidateSimpleModeContext
    if (!sm || !walletAddress || !persistReady) return
    if (messages.length > 0) return
    // One attempt per job — reset when guidedJobId changes via the persistence effect
    if (guidedBootstrapAttemptedRef.current === sm.job.id) return
    guidedBootstrapAttemptedRef.current = sm.job.id

    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      setChatError(null)
      try {
        const res = await sendToStormi({
          message: '',
          walletAddress,
          hubContext: hubContextRef.current,
          simpleModeContext: sm,
          simpleModeBootstrap: true,
        })
        if (cancelled) return
        setMessages([{ role: 'ava', text: res.reply }])
        setUsage(res.usage)
      } catch (err) {
        if (cancelled) return
        if (err instanceof OutOfCreditsError) {
          setOutOfCredits(true)
          setUsage(err.usage)
        } else {
          setChatError(err instanceof Error ? err.message : 'Stormi could not start')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [props.mode, candidateSimpleModeContext, walletAddress, persistReady, messages.length])

  useEffect(() => {
    if (!walletAddress) return
    fetch('/api/ai/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setUsage({
            dailyRemaining: data.dailyRemaining,
            credits: data.credits,
            totalMessages: data.totalMessages,
            model: null,
          })
        }
      })
      .catch(() => {})
  }, [walletAddress])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading, chatExpanded])

  useEffect(() => {
    if (!chatExpanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChatExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatExpanded])

  const handleSend = useCallback(async (text?: string) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed || isLoading || outOfCredits) return
    setInput('')
    const conversationHistory = messages.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }))
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setIsLoading(true)
    setChatError(null)
    setOutOfCredits(false)
    try {
      const res =
        props.mode === 'candidate'
          ? await sendToStormi({
              message: trimmed,
              hubContext: props.hubContext,
              walletAddress,
              conversationHistory,
              ...(candidateSimpleModeContext ? { simpleModeContext: candidateSimpleModeContext } : {}),
            })
          : await sendToStormi({
              message: trimmed,
              audience: 'employer',
              employerContext: props.employerContext,
              walletAddress,
              conversationHistory,
            })
      setMessages((prev) => [
        ...prev,
        {
          role: 'ava',
          text: res.reply,
          ...(res.jobSuggestions?.length ? { jobSuggestions: res.jobSuggestions } : {}),
        },
      ])
      setUsage(res.usage)
    } catch (err) {
      if (err instanceof OutOfCreditsError) {
        setOutOfCredits(true)
        setUsage(err.usage)
      } else {
        setChatError(err instanceof Error ? err.message : 'Something went wrong')
      }
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, outOfCredits, messages, props, walletAddress])

  const selectInterviewPrepChoice = useCallback((messageIndex: number, choiceId: string) => {
    setMessages((prev) =>
      prev.map((m, idx) => (idx === messageIndex ? { ...m, interviewPrepSelectedId: choiceId } : m)),
    )
  }, [])

  const runInterviewPrepQuiz = useCallback(async () => {
    if (!walletAddress || isLoading || outOfCredits) return
    setIsLoading(true)
    setChatError(null)
    setOutOfCredits(false)
    try {
      const res = await fetch('/api/ai/interview-prep-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as {
        error?: string
        message?: string
        interviewPrep?: StormiInterviewPrepPayload
        usage?: { dailyRemaining: number; credits: number }
      }
      if (res.status === 402) {
        setOutOfCredits(true)
        setUsage((u) =>
          data.usage
            ? {
                dailyRemaining: data.usage.dailyRemaining,
                credits: data.usage.credits,
                totalMessages: u?.totalMessages ?? 0,
                model: null,
              }
            : u,
        )
        return
      }
      if (!res.ok || !data.interviewPrep) {
        throw new Error(data.message || data.error || 'Could not generate practice question')
      }
      const topic = data.interviewPrep.topic ? ` (${data.interviewPrep.topic})` : ''
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: 'Interview practice question' },
        {
          role: 'ava',
          text: `Here is a multiple-choice practice question${topic}. Tap an answer for coaching — for preparation only, not during a live interview.`,
          interviewPrep: data.interviewPrep,
        },
      ])
      if (data.usage) {
        setUsage((u) => ({
          dailyRemaining: data.usage!.dailyRemaining,
          credits: data.usage!.credits,
          totalMessages: u?.totalMessages ?? 0,
          model: null,
        }))
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Interview prep failed')
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress, isLoading, outOfCredits])

  const submitTalkingPoints = useCallback(async () => {
    const title = tpJobTitle.trim()
    const company = tpCompany.trim()
    if (!walletAddress || !title || !company || tpLoading) return
    setTpLoading(true)
    setTpError(null)
    try {
      const res = await fetch('/api/ai/job-talking-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({
          jobTitle: title,
          company,
          description: tpDescription.trim() || undefined,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        message?: string
        talkingPoints?: string
        usage?: { coverLettersDailyRemaining: number; credits: number }
      }
      if (res.status === 402) {
        setTpError(data.message || data.error || 'Credits required')
        return
      }
      if (!res.ok || !data.talkingPoints) {
        throw new Error(data.error || 'Could not generate talking points')
      }
      setTalkingPointsModalOpen(false)
      setTpJobTitle('')
      setTpCompany('')
      setTpDescription('')
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: `Talking points for ${title} at ${company}` },
        {
          role: 'ava',
          text: `Honest talking points tied to your Career Card (not invented credentials):\n\n${data.talkingPoints}`,
        },
      ])
      if (data.usage) {
        setUsage((u) => ({
          dailyRemaining: u?.dailyRemaining ?? 0,
          credits: data.usage!.credits,
          totalMessages: u?.totalMessages ?? 0,
          model: null,
        }))
      }
    } catch (e) {
      setTpError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setTpLoading(false)
    }
  }, [walletAddress, tpJobTitle, tpCompany, tpDescription, tpLoading])

  const hasMessages = messages.length > 0 || isLoading

  type CandidateQuickAction =
    | { type: 'chat'; label: string }
    | { type: 'interview' }
    | { type: 'talking' }

  const candidateQuickActions: CandidateQuickAction[] =
    props.mode === 'candidate'
      ? [
          { type: 'chat', label: 'Find jobs that fit my profile' },
          { type: 'interview' },
          { type: 'talking' },
          { type: 'chat', label: 'What blocks should I add?' },
          { type: 'chat', label: 'What is my Career Card?' },
          { type: 'chat', label: 'What should I do next?' },
        ]
      : []

  const suggestedPromptsEmployer =
    props.mode === 'employer'
      ? ['How does the hiring pipeline work?', 'How should I use Find Talent?', 'What should I do next?']
      : []

  const usageBadge = usage
    ? usage.dailyRemaining > 0
      ? `${usage.dailyRemaining}/10 free today`
      : usage.credits > 0
        ? `${usage.credits} credits`
        : 'No messages left'
    : null

  return (
    <div
      className={cn(
        'relative',
        !hubEmbedSurface && 'stormi-glow-border transition-[box-shadow] duration-200',
        !hubEmbedSurface &&
          chatExpanded &&
          'ring-2 ring-teal-500/35 dark:ring-teal-400/30 rounded-[16px]',
        hubEmbedSurface &&
          chatExpanded &&
          'rounded-xl ring-2 ring-teal-500/35 dark:ring-teal-400/30',
      )}
    >
      <div
        className={cn(
          'flex flex-col overflow-hidden relative',
          hubEmbedSurface ? 'rounded-xl bg-transparent' : 'rounded-[14px]',
          !hubEmbedSurface && (isDark ? 'bg-gray-900' : 'bg-slate-100/95'),
        )}
      >
        {hasMessages && (
          <button
            type='button'
            onClick={() => setChatExpanded((e) => !e)}
            title={
              chatExpanded
                ? 'Shrink chat (Esc)'
                : 'Expand chat — taller thread & side-by-side job cards'
            }
            aria-expanded={chatExpanded}
            aria-label={chatExpanded ? 'Shrink Stormi chat' : 'Expand Stormi chat'}
            className={cn(
              'absolute top-2 right-2 z-20 p-2 rounded-xl border transition-colors',
              isDark
                ? 'border-gray-600 bg-gray-800/95 text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm',
            )}
          >
            {chatExpanded ? (
              <Minimize2 className='w-4 h-4' aria-hidden />
            ) : (
              <Maximize2 className='w-4 h-4' aria-hidden />
            )}
          </button>
        )}

        {/* ── Thread (only visible after first message) ── */}
        {hasMessages && (
          <div
            ref={scrollRef}
            className={cn(
              'px-5 pb-2 overflow-y-auto scroll-smooth',
              'pt-11',
              chatExpanded ? 'max-h-[min(78vh,920px)]' : 'max-h-[400px]',
            )}
          >
            <div className='space-y-3'>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'ava' && (
                    <div className='flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-600/20 dark:bg-teal-400/15'>
                      <Bot className='h-3.5 w-3.5 text-teal-800 dark:text-teal-300' />
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex flex-col gap-2',
                      msg.role === 'user'
                        ? 'max-w-[85%]'
                        : chatExpanded
                          ? 'max-w-[min(100%,48rem)] w-full'
                          : 'max-w-[min(100%,24rem)]',
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                        msg.role === 'ava'
                          ? cn(
                              'rounded-tl-sm',
                              isDark ? 'bg-gray-800 text-gray-200' : 'bg-slate-200/80 text-slate-800',
                            )
                          : 'rounded-tr-sm bg-teal-600 text-white dark:bg-teal-500',
                      )}
                    >
                      {msg.text}
                    </div>
                    {msg.role === 'ava' &&
                      msg.jobSuggestions &&
                      msg.jobSuggestions.length > 0 &&
                      props.mode === 'candidate' && (
                        <StormiJobSuggestionCards
                          messageIndex={i}
                          jobs={msg.jobSuggestions}
                          dismissed={dismissedJobKeys}
                          onDismiss={dismissJobSuggestion}
                          onApply={(job) => setApplyJob(toApplyModalJob(job))}
                          isDark={isDark}
                          expandedLayout={chatExpanded}
                        />
                      )}
                    {msg.role === 'ava' && msg.interviewPrep && props.mode === 'candidate' && (
                      <StormiInterviewPrepBlock
                        prep={msg.interviewPrep}
                        selectedId={msg.interviewPrepSelectedId}
                        isDark={isDark}
                        onSelect={(choiceId) => selectInterviewPrepChoice(i, choiceId)}
                      />
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className='flex gap-2 justify-start'>
                  <div className='flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-600/20 dark:bg-teal-400/15'>
                    <Bot className='h-3.5 w-3.5 text-teal-800 dark:text-teal-300' />
                  </div>
                  <div
                    className={cn(
                      'rounded-2xl rounded-tl-sm px-4 py-2.5',
                      isDark ? 'bg-gray-800' : 'bg-slate-200/70',
                    )}
                  >
                    <div className='flex gap-1.5'>
                      <span className='w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]' />
                      <span className='w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]' />
                      <span className='w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]' />
                    </div>
                  </div>
                </div>
              )}

              {outOfCredits && (
                <div
                  className={cn(
                    'rounded-2xl p-4 text-sm text-center space-y-2',
                    isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200',
                  )}
                >
                  <p className={isDark ? 'text-amber-300' : 'text-amber-700'}>
                    You&apos;ve used your 10 free messages today. Buy credits to keep chatting, or come back
                    tomorrow.
                  </p>
                  <button
                    type='button'
                    onClick={() => setShowCreditModal(true)}
                    className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors'
                  >
                    <Coins className='w-3.5 h-3.5' />
                    Buy Credits
                  </button>
                </div>
              )}

              {chatError && !outOfCredits && (
                <p className='text-xs text-red-500 text-center'>{chatError}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Input area ── */}
        <div
          className={cn(
            'px-5 pb-4',
            hasMessages ? 'pt-2' : hubEmbedSurface ? 'pt-2' : 'pt-5',
          )}
        >
          {/* Empty-state: suggested prompts above the input */}
          {!hasMessages && (
            <div className='mb-5'>
              {hubEmbedSurface ? (
                usageBadge ? (
                  <div className='mb-4 flex flex-wrap items-center gap-2'>
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-2 py-1 rounded-full',
                        usage && usage.dailyRemaining === 0 && usage.credits === 0
                          ? 'bg-red-500/15 text-red-400'
                          : usage && usage.dailyRemaining > 0
                            ? isDark
                              ? 'bg-teal-500/20 text-teal-200'
                              : 'bg-teal-50 text-teal-800'
                            : isDark
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-amber-50 text-amber-600',
                      )}
                    >
                      {usageBadge}
                    </span>
                  </div>
                ) : null
              ) : (
                <div className='flex items-center gap-4 mb-4'>
                  <div
                    className={cn(
                      'flex-shrink-0 w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl flex items-center justify-center overflow-hidden shadow-lg',
                      isDark
                        ? 'bg-gradient-to-br from-teal-600/25 to-teal-500/10 ring-1 ring-teal-500/25'
                        : 'bg-gradient-to-br from-teal-600/15 to-teal-500/5 ring-1 ring-teal-400/25',
                    )}
                  >
                    <Image
                      src='/ava-robot.png'
                      alt=''
                      width={52}
                      height={52}
                      className={cn('object-contain', !isDark && 'invert')}
                    />
                  </div>
                  <div className='min-w-0 flex-1 flex flex-col gap-1'>
                    <div className='flex items-start justify-between gap-3'>
                      <h2
                        className={cn(
                          'text-xl sm:text-2xl font-bold tracking-tight leading-tight',
                          isDark ? 'text-white' : 'text-slate-800',
                        )}
                      >
                        Ask Stormi
                      </h2>
                      {usageBadge && (
                        <span
                          className={cn(
                            'flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full',
                            usage && usage.dailyRemaining === 0 && usage.credits === 0
                              ? 'bg-red-500/15 text-red-400'
                              : usage && usage.dailyRemaining > 0
                                ? isDark
                                  ? 'bg-teal-500/20 text-teal-200'
                                  : 'bg-teal-50 text-teal-800'
                                : isDark
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-amber-50 text-amber-600',
                          )}
                        >
                          {usageBadge}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-sm leading-snug',
                        isDark ? 'text-gray-400' : 'text-slate-600',
                      )}
                    >
                      {props.mode === 'candidate'
                        ? 'Build your card and prep here anytime; we emphasize hire tools — ranked jobs, tap-to-answer interview practice, talking points from your real Career Card. You choose every apply; nothing auto-fires.'
                        : 'She knows your company and pipeline — type or tap a suggestion. After you start, use the corner icon to expand the thread.'}
                    </p>
                  </div>
                </div>
              )}
              <div className='flex flex-wrap gap-2'>
                {props.mode === 'candidate' &&
                  candidateQuickActions.map((action, idx) => {
                    if (action.type === 'chat') {
                      return (
                        <button
                          key={`chat-${action.label}`}
                          type='button'
                          onClick={() => handleSend(action.label)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                            isDark
                              ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200',
                          )}
                        >
                          {action.label}
                        </button>
                      )
                    }
                    if (action.type === 'interview') {
                      return (
                        <button
                          key='interview-prep'
                          type='button'
                          onClick={() => void runInterviewPrepQuiz()}
                          disabled={!walletAddress || isLoading || outOfCredits}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                            isDark
                              ? 'bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 border border-violet-500/40'
                              : 'bg-violet-50 text-violet-900 hover:bg-violet-100 border border-violet-200',
                          )}
                        >
                          <ListChecks className='w-3.5 h-3.5 shrink-0' />
                          Interview practice (MCQ)
                        </button>
                      )
                    }
                    return (
                      <button
                        key='talking-points'
                        type='button'
                        onClick={() => {
                          setTpError(null)
                          setTalkingPointsModalOpen(true)
                        }}
                        disabled={!walletAddress || outOfCredits}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                          isDark
                            ? 'bg-teal-500/15 text-teal-200 hover:bg-teal-500/25 border border-teal-500/35'
                            : 'bg-teal-50 text-teal-900 hover:bg-teal-100 border border-teal-200',
                        )}
                      >
                        <Sparkles className='w-3.5 h-3.5 shrink-0' />
                        Job talking points
                      </button>
                    )
                  })}
                {props.mode === 'employer' &&
                  suggestedPromptsEmployer.map((label) => (
                    <button
                      key={label}
                      type='button'
                      onClick={() => handleSend(label)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                        isDark
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200',
                      )}
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className='flex items-center gap-2'
          >
            <input
              data-stormi-chat-input
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={outOfCredits ? 'Buy credits to continue...' : 'Ask Stormi anything...'}
              disabled={isLoading || outOfCredits}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-full text-sm border transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-teal-600/35 dark:focus:ring-teal-400/40',
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
                (isLoading || outOfCredits) && 'opacity-50',
              )}
            />
            <button
              type='submit'
              disabled={!input.trim() || isLoading || outOfCredits}
              className={cn(
                'p-2.5 rounded-full transition-all',
                input.trim() && !isLoading && !outOfCredits
                  ? 'bg-teal-600 text-white shadow-sm hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400'
                  : cn('cursor-not-allowed', isDark ? 'bg-gray-700 text-gray-500' : 'bg-slate-200 text-slate-400'),
              )}
              aria-label='Send message'
            >
              {isLoading ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />}
            </button>
          </form>

          {/* Footer row: credits + edit intro (candidates only) */}
          <div
            className={cn(
              'flex flex-wrap items-center gap-y-1 gap-x-2 mt-2',
              props.mode === 'candidate' ? 'justify-between' : '',
            )}
          >
            <div className='flex items-center gap-2 flex-wrap'>
              <span className={cn('text-[10px]', isDark ? 'text-gray-600' : 'text-slate-400')}>
                Powered by Anthropic
              </span>
              {usage && usage.dailyRemaining === 0 && (
                <button
                  type='button'
                  onClick={() => setShowCreditModal(true)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
                    isDark
                      ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                      : 'bg-amber-50 text-amber-600 hover:bg-amber-100',
                  )}
                >
                  <Coins className='w-3 h-3' />
                  Buy Credits
                </button>
              )}
            </div>
            {props.mode === 'candidate' && (
              <button
                type='button'
                onClick={() => openStormiContextModal()}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors',
                  isDark
                    ? 'text-teal-400/90 hover:text-teal-300 hover:bg-gray-800'
                    : 'text-teal-700 hover:text-teal-800 hover:bg-teal-50',
                )}
                aria-label='Edit what you told Stormi about your work and goals'
              >
                <Sparkles className='w-3 h-3' />
                Edit intro
              </button>
            )}
          </div>
        </div>
      </div>

      {props.mode === 'candidate' && talkingPointsModalOpen && (
        <Modal onClose={() => setTalkingPointsModalOpen(false)} maxWidth='max-w-md' zIndex={1100}>
          <ModalHeader
            title='Job talking points'
            subtitle='Honest bullets from your Career Card for this role — edit before you send anything to an employer.'
            onClose={() => setTalkingPointsModalOpen(false)}
          />
          <div className='p-4 sm:p-5 space-y-3'>
            <div>
              <label
                className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-slate-600')}
                htmlFor='tp-title'
              >
                Job title
              </label>
              <input
                id='tp-title'
                value={tpJobTitle}
                onChange={(e) => setTpJobTitle(e.target.value)}
                placeholder='e.g. CDL-A OTR Driver'
                className={cn(
                  'w-full px-3 py-2 rounded-lg border text-sm',
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                    : 'bg-white border-slate-200 text-slate-900',
                )}
              />
            </div>
            <div>
              <label
                className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-slate-600')}
                htmlFor='tp-co'
              >
                Company
              </label>
              <input
                id='tp-co'
                value={tpCompany}
                onChange={(e) => setTpCompany(e.target.value)}
                placeholder='Employer name'
                className={cn(
                  'w-full px-3 py-2 rounded-lg border text-sm',
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                    : 'bg-white border-slate-200 text-slate-900',
                )}
              />
            </div>
            <div>
              <label
                className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-slate-600')}
                htmlFor='tp-desc'
              >
                Job description (optional)
              </label>
              <textarea
                id='tp-desc'
                value={tpDescription}
                onChange={(e) => setTpDescription(e.target.value)}
                rows={3}
                placeholder='Paste an excerpt for tighter points'
                className={cn(
                  'w-full px-3 py-2 rounded-lg border text-sm resize-y min-h-[72px]',
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                    : 'bg-white border-slate-200 text-slate-900',
                )}
              />
            </div>
            {tpError && <p className='text-xs text-red-500'>{tpError}</p>}
            <div className='flex flex-wrap gap-2 justify-end pt-1'>
              <Button type='button' variant='secondary' size='sm' onClick={() => setTalkingPointsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type='button'
                variant='primary'
                size='sm'
                isLoading={tpLoading}
                disabled={!tpJobTitle.trim() || !tpCompany.trim()}
                onClick={() => void submitTalkingPoints()}
              >
                Generate in chat
              </Button>
            </div>
            <p className={cn('text-[10px]', isDark ? 'text-gray-500' : 'text-slate-500')}>
              Uses the same daily pool as cover-letter assists (then credits). You review every word.
            </p>
          </div>
        </Modal>
      )}

      {showCreditModal && (
        <StormiCreditModal
          walletAddress={walletAddress}
          onClose={() => setShowCreditModal(false)}
          onSuccess={(newUsage) => {
            setUsage(newUsage)
            setOutOfCredits(false)
            setShowCreditModal(false)
          }}
        />
      )}

      {props.mode === 'candidate' && (
        <StormApplyBridge
          isOpen={applyJob != null}
          onClose={() => setApplyJob(null)}
          job={applyJob}
          userAddress={walletAddress}
        />
      )}
    </div>
  )
}
