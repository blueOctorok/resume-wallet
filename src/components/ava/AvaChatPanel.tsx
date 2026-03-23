'use client'

/**
 * Shared AvA chat shell — same UX on candidate hub and employer hub.
 * Audience-specific copy + `sendToAva` payload; server picks system prompt via `audience`.
 */

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Coins, Compass, Loader2, Send } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useJourneyStore } from '@/stores'
import { cn } from '@/lib/utils'
import type { HubContext } from '@/lib/ava-context'
import {
  sendToAva,
  OutOfCreditsError,
  type ChatMessage,
  type AvaUsageInfo,
  type EmployerHubContext,
} from '@/lib/ava-chat'
import AvaCreditModal from '@/components/AvaCreditModal'

export type AvaChatPanelProps =
  | {
      mode: 'candidate'
      walletAddress: string | null
      hubContext: HubContext
      candidateEmptyHub: boolean
      /** From GET /api/hub/blocks — `users.ava_auto_welcome_candidate_at` */
      avaAutoWelcomeCandidateDone: boolean
      /** Keep Zustand in sync after server records auto-welcome (incl. 402 path) */
      onAvaAutoWelcomeSynced?: () => void
      /** lg+: “Open Journey” scrolls this element into view instead of opening the drawer */
      desktopJourneyScrollTargetId?: string
    }
  | {
      mode: 'employer'
      walletAddress: string | null
      employerContext: EmployerHubContext
      avaAutoWelcomeEmployerDone: boolean
      onAvaAutoWelcomeSynced?: () => void
      desktopJourneyScrollTargetId?: string
    }

export default function AvaChatPanel(props: AvaChatPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const openGuide = useJourneyStore((s) => s.openGuide)
  const walletAddress = props.walletAddress

  const handleOpenJourney = useCallback(() => {
    const scrollId =
      'desktopJourneyScrollTargetId' in props ? props.desktopJourneyScrollTargetId : undefined
    if (
      scrollId &&
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches
    ) {
      const el = document.getElementById(scrollId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        return
      }
    }
    openGuide()
  }, [openGuide, props])

  const employerFreshHiring =
    props.mode === 'employer' &&
    props.employerContext.activeJobs === 0 &&
    props.employerContext.totalApplicants === 0

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [outOfCredits, setOutOfCredits] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [usage, setUsage] = useState<AvaUsageInfo | null>(null)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  /** In-memory guard for the same mount (e.g. dev Strict Mode remount patterns) */
  const autoWelcomeSent = useRef(false)

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
  }, [messages, isLoading])

  // One-shot auto welcome: empty candidate hub, or employer with no jobs/applicants yet.
  // Idempotency is enforced on the server (`users.ava_auto_welcome_*_at`); hub APIs expose flags so we skip redundant POSTs.
  useEffect(() => {
    const shouldAutoWelcome =
      props.mode === 'candidate'
        ? props.candidateEmptyHub
        : employerFreshHiring

    const dbSaysDone =
      props.mode === 'candidate'
        ? props.avaAutoWelcomeCandidateDone
        : props.avaAutoWelcomeEmployerDone

    if (
      !walletAddress ||
      !shouldAutoWelcome ||
      dbSaysDone ||
      messages.length > 0 ||
      autoWelcomeSent.current ||
      isLoading
    ) {
      return
    }

    const welcomeMessage =
      props.mode === 'candidate'
        ? 'I just signed up and my hub is empty. What is StormChain, what are blocks, and what should I do first?'
        : 'I have my company on StormChain but no active jobs and no applicants in the pipeline yet. What should I do first to start hiring?'

    const autoWelcome = props.mode === 'candidate' ? ('candidate' as const) : ('employer' as const)

    autoWelcomeSent.current = true
    setIsLoading(true)

    const req =
      props.mode === 'candidate'
        ? {
            message: welcomeMessage,
            hubContext: props.hubContext,
            walletAddress,
            autoWelcome,
          }
        : {
            message: welcomeMessage,
            audience: 'employer' as const,
            employerContext: props.employerContext,
            walletAddress,
            autoWelcome,
          }

    sendToAva(req)
      .then((res) => {
        props.onAvaAutoWelcomeSynced?.()
        setMessages([{ role: 'ava', text: res.reply }])
        setUsage(res.usage)
      })
      .catch((err) => {
        if (err instanceof OutOfCreditsError) {
          props.onAvaAutoWelcomeSynced?.()
          setOutOfCredits(true)
          setUsage(err.usage)
        } else {
          setChatError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => setIsLoading(false))
  }, [props, employerFreshHiring, messages.length, isLoading, walletAddress])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading || outOfCredits) return
    setInput('')
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
            })
          : await sendToAva({
              message: trimmed,
              audience: 'employer',
              employerContext: props.employerContext,
              walletAddress,
            })
      setMessages((prev) => [...prev, { role: 'ava', text: res.reply }])
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
  }, [input, isLoading, outOfCredits, props, walletAddress])

  const hasMessages = messages.length > 0 || isLoading
  const showWelcome = !hasMessages

  const tagline =
    props.mode === 'candidate'
      ? 'Unlike generic AI, AvA already knows your career — your blocks, your progress, your goals. Just ask.'
      : 'Unlike generic AI, AvA already knows your company, jobs, and pipeline on StormChain — just ask.'

  const suggestedPrompts =
    props.mode === 'candidate'
      ? ['What blocks should I add first?', 'What is my Career Card?', 'What should I do next?']
      : [
          'How should I use Find Talent vs posting a job?',
          'How does the hiring pipeline work?',
          'What should I look for on a candidate Career Card?',
        ]

  const usageBadge = usage
    ? usage.dailyRemaining > 0
      ? `${usage.dailyRemaining}/10 free today`
      : usage.credits > 0
        ? `${usage.credits} credits`
        : 'No messages left'
    : null

  return (
    <div className='ava-glow-border'>
      <div
        className={cn(
          'rounded-[14px] flex flex-col overflow-hidden',
          isDark ? 'bg-gray-900' : 'bg-slate-100/95',
        )}
      >
        <div
          className={cn(
            'relative px-6 pt-6 pb-5',
            isDark
              ? 'bg-gradient-to-b from-gray-800/90 via-gray-800/50 to-transparent'
              : 'bg-gradient-to-b from-gray-50 via-white to-transparent',
          )}
        >
          <div className='flex items-start gap-4'>
            <div
              className={cn(
                'flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg',
                isDark
                  ? 'bg-gradient-to-br from-brand-mint/30 to-brand-mint/10 ring-1 ring-brand-mint/20'
                  : 'bg-gradient-to-br from-brand-mint/20 to-brand-mint/5 ring-1 ring-brand-mint/30',
              )}
            >
              <Image
                src='/ava-robot.png'
                alt=''
                width={44}
                height={44}
                className={cn('object-contain', !isDark && 'invert')}
              />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-2 flex-wrap'>
                <h2
                  className={cn(
                    'text-xl font-bold tracking-tight',
                    isDark ? 'text-white' : 'text-slate-800',
                  )}
                >
                  Talk to AvA
                </h2>
                {usageBadge && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      usage && usage.dailyRemaining === 0 && usage.credits === 0
                        ? 'bg-red-500/15 text-red-400'
                        : usage && usage.dailyRemaining > 0
                          ? isDark
                            ? 'bg-brand-mint/15 text-brand-mint'
                            : 'bg-teal-50 text-teal-600'
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
                  'mt-0.5 text-sm leading-snug',
                  isDark ? 'text-gray-400' : 'text-slate-600',
                )}
              >
                {tagline}
              </p>
              <div className='mt-3 flex items-center gap-3 flex-wrap'>
                <div className='inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-500'>
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      isDark ? 'bg-brand-mint/60' : 'bg-brand-mint',
                    )}
                  />
                  Powered by Anthropic
                </div>
                {usage && usage.dailyRemaining === 0 && (
                  <button
                    type='button'
                    onClick={() => setShowCreditModal(true)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors',
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
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className={cn(
            'px-5 overflow-y-auto transition-all duration-300',
            showWelcome ? 'min-h-[200px] max-h-[320px] pb-4' : hasMessages ? 'min-h-[120px] max-h-[400px] pb-3' : 'h-0',
          )}
        >
          {showWelcome && (
            <div
              className={cn(
                'rounded-2xl p-4 text-sm leading-relaxed space-y-3',
                isDark
                  ? 'bg-gray-800/60 text-gray-300 border border-gray-700/50'
                  : 'bg-slate-200/70 text-slate-800 border border-slate-300',
              )}
            >
              {props.mode === 'candidate' ? (
                <>
                  <p className='font-medium'>
                    Unlike ChatGPT or Claude, I already know your career. No copy-pasting your resume — I
                    can see your blocks, your progress, and your goals right here.
                  </p>
                  <p>
                    Add blocks below to build your profile. Each block — <strong>Resume</strong>,{' '}
                    <strong>DOT Application</strong>, <strong>MVR</strong>, <strong>Portfolio</strong>,{' '}
                    <strong>GitHub</strong> — becomes a section on your Career Card for employers. Add the
                    ones that fit your path.
                  </p>
                  <p>
                    Ask me what to add first, what to do next, or tap <strong>Open Journey</strong> below to
                    see your progress.
                  </p>
                </>
              ) : (
                <>
                  <p className='font-medium'>
                    I&apos;m tuned for <strong>employers</strong> on StormChain — not candidate career
                    blocks. I know your company snapshot, job counts, and pipeline so advice stays relevant
                    to hiring here.
                  </p>
                  <p>
                    Use <strong>Post Job</strong> and <strong>Find Talent</strong> to bring people in, then
                    move them through <strong>New</strong> → <strong>Contacted</strong> →{' '}
                    <strong>Archived</strong>. Open a candidate&apos;s <strong>Career Card</strong> to see
                    what they chose to verify.
                  </p>
                  <p>
                    Ask about workflow, what to do next, or tap <strong>Open Journey</strong> for your
                    employer checklist.
                  </p>
                </>
              )}
              <p className={cn('text-xs pt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                Try a question below or type your own.
              </p>
              <div className='flex flex-wrap gap-2 pt-2'>
                {suggestedPrompts.map((label) => (
                  <button
                    key={label}
                    type='button'
                    onClick={() => {
                      setInput(label)
                      const el = document.querySelector('[data-ava-chat-input]') as HTMLInputElement | null
                      el?.focus()
                    }}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      isDark
                        ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600 border border-gray-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={cn('space-y-3', !showWelcome && 'pt-1')}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'ava' && (
                  <div className='flex-shrink-0 w-6 h-6 rounded-full bg-brand-mint/20 flex items-center justify-center mt-0.5'>
                    <Bot className='w-3.5 h-3.5 text-brand-mint' />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'ava'
                      ? cn(
                          'rounded-tl-sm',
                          isDark ? 'bg-gray-800 text-gray-200' : 'bg-slate-200/80 text-slate-800',
                        )
                      : 'bg-brand-mint text-white rounded-tr-sm',
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className='flex gap-2 justify-start'>
                <div className='flex-shrink-0 w-6 h-6 rounded-full bg-brand-mint/20 flex items-center justify-center mt-0.5'>
                  <Bot className='w-3.5 h-3.5 text-brand-mint' />
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

        <div className='px-5 pb-4 pt-2'>
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
                'focus:outline-none focus:ring-2 focus:ring-brand-mint/40',
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500'
                  : 'bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-500',
                (isLoading || outOfCredits) && 'opacity-50',
              )}
            />
            <button
              type='submit'
              disabled={!input.trim() || isLoading || outOfCredits}
              className={cn(
                'p-2.5 rounded-full transition-all',
                input.trim() && !isLoading && !outOfCredits
                  ? 'bg-brand-mint text-white hover:bg-brand-mint/90 shadow-sm'
                  : cn('cursor-not-allowed', isDark ? 'bg-gray-700 text-gray-500' : 'bg-slate-200 text-slate-500'),
              )}
              aria-label='Send message'
            >
              {isLoading ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />}
            </button>
          </form>

          <div className='flex justify-end mt-2'>
            <button
              type='button'
              onClick={handleOpenJourney}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isDark
                  ? 'text-gray-400 hover:text-violet-300 hover:bg-gray-800'
                  : 'text-slate-600 hover:text-violet-600 hover:bg-slate-100',
              )}
            >
              <Compass className='w-3.5 h-3.5' />
              Open Journey
            </button>
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
    </div>
  )
}
