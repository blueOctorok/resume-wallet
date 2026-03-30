'use client'

import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import StormTokenMark from '@/components/ui/StormTokenMark'

interface LoadingScreenProps {
  message?: string
  /** Full viewport takeover (session, route, role gate) */
  fullScreen?: boolean
  /** Smaller orbit for use inside existing cards (e.g. wallet init) */
  compact?: boolean
}

/**
 * Unified StormChain loading UI — brand teal/violet, storm mark (no generic “S”),
 * optional full-page atmosphere aligned with app body gradients.
 */
export default function LoadingScreen({
  message = 'Loading…',
  fullScreen = true,
  compact = false,
}: LoadingScreenProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const orbit = (
    <StormTokenMark
      size={compact ? 'lg' : 'xl'}
      className='mx-auto'
    />
  )

  const copy = (
    <div className={cn('text-center', compact ? 'mt-5 space-y-1' : 'mt-8 space-y-3')}>
      <p
        className={cn(
          compact ? 'text-sm' : 'text-base sm:text-lg',
          'font-medium tracking-tight text-balance',
          isDark ? 'text-gray-100' : 'text-slate-800',
        )}
      >
        {message}
      </p>
      {!compact && (
        <div
          className={cn(
            'loading-bar-track h-1 max-w-[11rem] rounded-full mx-auto overflow-hidden',
            isDark ? 'bg-gray-700/90' : 'bg-slate-200/95',
          )}
          aria-hidden
        >
          <div className='loading-bar-sweep h-full w-[42%] rounded-full bg-gradient-to-r from-transparent via-teal-400/90 to-transparent dark:via-teal-300/90' />
        </div>
      )}
      {!compact && (
        <p
          className={cn(
            'pt-1 text-[0.65rem] font-[family-name:var(--font-storm-wordmark),ui-serif,Georgia,serif] font-normal tracking-[0.14em] text-teal-700/70 dark:text-teal-400/55',
          )}
        >
          STORMCHAIN
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div
        className='fixed inset-0 z-[100] flex items-center justify-center'
        role='status'
        aria-busy='true'
        aria-live='polite'
      >
        <div className='absolute inset-0 overflow-hidden' aria-hidden>
          <div
            className={cn(
              'absolute inset-0',
              isDark
                ? 'bg-[linear-gradient(165deg,#0f1419_0%,#080c11_45%,#040608_100%)]'
                : 'bg-[linear-gradient(165deg,#e4e9f0_0%,#dde3ec_45%,#d3dae6_100%)]',
            )}
          />
          <div
            className='absolute top-[18%] left-1/2 h-[min(85vw,36rem)] w-[min(85vw,36rem)] -translate-x-1/2 rounded-full bg-teal-500/[0.11] blur-3xl motion-reduce:animate-none animate-pulse dark:bg-teal-400/[0.08]'
            style={{ animationDuration: '3.2s' }}
          />
          <div
            className='absolute bottom-[-5%] right-[-8%] h-[min(70vw,26rem)] w-[min(70vw,26rem)] rounded-full bg-violet-500/[0.1] blur-3xl motion-reduce:animate-none animate-pulse dark:bg-violet-500/[0.09]'
            style={{ animationDuration: '4s', animationDelay: '0.4s' }}
          />
        </div>

        <div className='relative z-[1] mx-4 w-full max-w-md'>
          <div
            className={cn(
              'rounded-2xl border p-8 sm:p-10 shadow-2xl backdrop-blur-xl',
              isDark
                ? 'border-gray-600/55 bg-gray-900/72 ring-1 ring-teal-400/[0.14] shadow-[0_0_40px_-8px_rgba(45,212,191,0.12)]'
                : 'border-gray-200/90 bg-white/82 ring-1 ring-teal-500/[0.1] shadow-[0_0_36px_-10px_rgba(13,148,136,0.14)]',
            )}
          >
            {orbit}
            {copy}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center',
        compact ? 'py-2' : 'min-h-[12rem] py-12 px-4',
      )}
      role='status'
      aria-busy='true'
      aria-live='polite'
    >
      {!compact && (
        <div
          className={cn(
            'w-full max-w-sm rounded-2xl border px-8 py-10 backdrop-blur-md',
            isDark
              ? 'border-gray-600/50 bg-gray-900/40 ring-1 ring-teal-400/[0.1]'
              : 'border-gray-200/80 bg-white/70 ring-1 ring-teal-500/[0.08]',
          )}
        >
          {orbit}
          {copy}
        </div>
      )}
      {compact && (
        <>
          {orbit}
          {copy}
        </>
      )}
    </div>
  )
}
