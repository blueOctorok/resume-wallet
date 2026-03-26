'use client'

/**
 * Shared AvA chat — clean empty state with robot avatar + prominent "Ask AvA" title.
 * No auto-welcome call. Suggested prompts as chips. Thread appears after first send.
 */

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Coins, ExternalLink, Loader2, Maximize2, Minimize2, Send, Sparkles } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { cn } from '@/lib/utils'
import type { HubContext } from '@/lib/ava-context'
import {
  sendToAva,
  OutOfCreditsError,
  type ChatMessage,
  type AvaUsageInfo,
  type EmployerHubContext,
} from '@/lib/ava-chat'
import { loadAvaChatMessages, saveAvaChatMessages } from '@/lib/ava-chat-persistence'
import type { AvaJobSuggestion } from '@/lib/ava-job-suggestions'
import AvaCreditModal from '@/components/AvaCreditModal'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

const ApplyWithStormChainModal = dynamic(() => import('@/components/ApplyWithStormChainModal'), {
  ssr: false,
})

/** Shape expected by ApplyWithStormChainModal `job` prop */
function toApplyModalJob(j: AvaJobSuggestion) {
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

/** Ranked job cards under an AvA turn — Yes/No + apply-to-#1 shortcut; skips are per-message local state */
function AvaJobSuggestionCards(props: {
  messageIndex: number
  jobs: AvaJobSuggestion[]
  dismissed: Record<string, true>
  onDismiss: (messageIndex: number, jobId: string) => void
  onApply: (job: AvaJobSuggestion) => void
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
        You skipped these. Ask AvA for another search or tweak what you&apos;re looking for.
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

export type AvaChatPanelProps =
  | {
      mode: 'candidate'
      walletAddress: string | null
      hubContext: HubContext
      candidateEmptyHub: boolean
      avaAutoWelcomeCandidateDone: boolean
      onAvaAutoWelcomeSynced?: () => void
    }
  | {
      mode: 'employer'
      walletAddress: string | null
      employerContext: EmployerHubContext
      avaAutoWelcomeEmployerDone: boolean
      onAvaAutoWelcomeSynced?: () => void
    }

export default function AvaChatPanel(props: AvaChatPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const openAvAContextModal = useHubBlocksStore((s) => s.openAvAContextModal)
  const walletAddress = props.walletAddress
  const persistenceMode = props.mode

  const [messages, setMessages] = useState<ChatMessage[]>([])
  /** Avoid writing [] to storage before we have loaded prior thread */
  const [persistReady, setPersistReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [outOfCredits, setOutOfCredits] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [usage, setUsage] = useState<AvaUsageInfo | null>(null)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  /** External job chosen from AvA-ranked cards — opens shared apply modal */
  const [applyJob, setApplyJob] = useState<ReturnType<typeof toApplyModalJob> | null>(null)
  /** Per-message job dismissals (No, skip) — key `${msgIndex}-${jobId}` */
  const [dismissedJobKeys, setDismissedJobKeys] = useState<Record<string, true>>({})
  /** Larger thread + wider bubbles + 2-col job cards (candidate) */
  const [chatExpanded, setChatExpanded] = useState(false)

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
    setMessages(loadAvaChatMessages(persistenceMode, walletAddress))
    setPersistReady(true)
  }, [walletAddress, persistenceMode])

  useEffect(() => {
    if (!persistReady || !walletAddress) return
    saveAvaChatMessages(persistenceMode, walletAddress, messages)
  }, [messages, walletAddress, persistenceMode, persistReady])

  useEffect(() => {
    if (!walletAddress) return
    fetch('/api/ai/credits', { headers: { 'x-wallet-address': walletAddress } })
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
          ? await sendToAva({
              message: trimmed,
              hubContext: props.hubContext,
              walletAddress,
              conversationHistory,
            })
          : await sendToAva({
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

  const hasMessages = messages.length > 0 || isLoading

  const suggestedPrompts =
    props.mode === 'candidate'
      ? [
          'Find jobs that fit my profile',
          'What blocks should I add?',
          'What is my Career Card?',
          'What should I do next?',
        ]
      : ['How does the hiring pipeline work?', 'How should I use Find Talent?', 'What should I do next?']

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
        'ava-glow-border transition-[box-shadow] duration-200',
        chatExpanded && 'ring-2 ring-teal-500/35 dark:ring-teal-400/30 rounded-[16px]',
      )}
    >
      <div
        className={cn(
          'rounded-[14px] flex flex-col overflow-hidden relative',
          isDark ? 'bg-gray-900' : 'bg-slate-100/95',
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
            aria-label={chatExpanded ? 'Shrink AvA chat' : 'Expand AvA chat'}
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
                    <div className='flex-shrink-0 w-6 h-6 rounded-full bg-brand-mint/25 dark:bg-brand-mint/20 flex items-center justify-center mt-0.5'>
                      <Bot className='w-3.5 h-3.5 text-brand-sage-dark dark:text-teal-300' />
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
                          : 'bg-brand-mint text-gray-900 rounded-tr-sm',
                      )}
                    >
                      {msg.text}
                    </div>
                    {msg.role === 'ava' &&
                      msg.jobSuggestions &&
                      msg.jobSuggestions.length > 0 &&
                      props.mode === 'candidate' && (
                        <AvaJobSuggestionCards
                          messageIndex={i}
                          jobs={msg.jobSuggestions}
                          dismissed={dismissedJobKeys}
                          onDismiss={dismissJobSuggestion}
                          onApply={(job) => setApplyJob(toApplyModalJob(job))}
                          isDark={isDark}
                          expandedLayout={chatExpanded}
                        />
                      )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className='flex gap-2 justify-start'>
                  <div className='flex-shrink-0 w-6 h-6 rounded-full bg-brand-mint/25 dark:bg-brand-mint/20 flex items-center justify-center mt-0.5'>
                    <Bot className='w-3.5 h-3.5 text-brand-sage-dark dark:text-teal-300' />
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
        <div className={cn('px-5 pb-4', hasMessages ? 'pt-2' : 'pt-5')}>
          {/* Empty-state: suggested prompts above the input */}
          {!hasMessages && (
            <div className='mb-5'>
              <div className='flex items-center gap-4 mb-4'>
                <div
                  className={cn(
                    'flex-shrink-0 w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl flex items-center justify-center overflow-hidden shadow-lg',
                    isDark
                      ? 'bg-gradient-to-br from-brand-mint/30 to-brand-mint/10 ring-1 ring-brand-mint/20'
                      : 'bg-gradient-to-br from-brand-mint/20 to-brand-mint/5 ring-1 ring-brand-mint/30',
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
                      Ask AvA
                    </h2>
                    {usageBadge && (
                      <span
                        className={cn(
                          'flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full',
                          usage && usage.dailyRemaining === 0 && usage.credits === 0
                            ? 'bg-red-500/15 text-red-400'
                            : usage && usage.dailyRemaining > 0
                              ? isDark
                            ? 'bg-brand-mint/20 text-teal-200'
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
                      ? 'She knows your hub — find ranked jobs in chat, open listings in a new tab, apply with your Career Card here. After you start, use the corner expand icon for a taller thread and side-by-side job cards.'
                      : 'She knows your company and pipeline — type or tap a suggestion. After you start, use the corner icon to expand the thread.'}
                  </p>
                </div>
              </div>
              <div className='flex flex-wrap gap-2'>
                {suggestedPrompts.map((label) => (
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
              data-ava-chat-input
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={outOfCredits ? 'Buy credits to continue...' : 'Ask AvA anything...'}
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
                  ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-sm'
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
                onClick={() => openAvAContextModal()}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors',
                  isDark
                    ? 'text-teal-400/90 hover:text-teal-300 hover:bg-gray-800'
                    : 'text-teal-700 hover:text-teal-800 hover:bg-teal-50',
                )}
                aria-label='Edit what you told AvA about your work and goals'
              >
                <Sparkles className='w-3 h-3' />
                Edit intro
              </button>
            )}
          </div>
        </div>
      </div>

      {showCreditModal && (
        <AvaCreditModal
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
        <ApplyWithStormChainModal
          isOpen={applyJob != null}
          onClose={() => setApplyJob(null)}
          job={applyJob}
          userAddress={walletAddress}
        />
      )}
    </div>
  )
}
