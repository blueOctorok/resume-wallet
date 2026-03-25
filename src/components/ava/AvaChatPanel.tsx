'use client'

/**
 * Shared AvA chat — clean empty state with robot avatar + prominent "Ask AvA" title.
 * No auto-welcome call. Suggested prompts as chips. Thread appears after first send.
 */

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Coins, Compass, Loader2, Send, Sparkles } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useJourneyStore } from '@/stores'
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
import AvaCreditModal from '@/components/AvaCreditModal'

export type AvaChatPanelProps =
  | {
      mode: 'candidate'
      walletAddress: string | null
      hubContext: HubContext
      candidateEmptyHub: boolean
      avaAutoWelcomeCandidateDone: boolean
      onAvaAutoWelcomeSynced?: () => void
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
  const openAvAContextModal = useHubBlocksStore((s) => s.openAvAContextModal)
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

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [outOfCredits, setOutOfCredits] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [usage, setUsage] = useState<AvaUsageInfo | null>(null)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const handleSend = useCallback(async (text?: string) => {
    const trimmed = (text ?? input).trim()
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

  const suggestedPrompts =
    props.mode === 'candidate'
      ? ['What blocks should I add?', 'What is my Career Card?', 'What should I do next?']
      : ['How does the hiring pipeline work?', 'How should I use Find Talent?', 'What should I do next?']

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
        {/* ── Thread (only visible after first message) ── */}
        {hasMessages && (
          <div
            ref={scrollRef}
            className='px-5 pt-4 pb-2 overflow-y-auto max-h-[400px]'
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
                      'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
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
                      ? 'She knows your blocks and progress — type or tap a suggestion.'
                      : 'She knows your company and pipeline — type or tap a suggestion.'}
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

          {/* Footer row: credits + edit intro (candidates) + journey */}
          <div className='flex flex-wrap items-center justify-between gap-y-1 gap-x-2 mt-2'>
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
            <div className='flex items-center gap-1 sm:gap-2'>
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
              <button
                type='button'
                onClick={handleOpenJourney}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors',
                  isDark
                    ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
                )}
              >
                <Compass className='w-3 h-3' />
                Journey
              </button>
            </div>
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
