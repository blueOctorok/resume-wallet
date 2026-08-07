'use client'

import { isDarkTheme } from '@/lib/theme-storage'
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
 * Unified Storm loading UI — brand teal/violet, storm mark (no generic “S”),
 * optional full-page atmosphere aligned with app body gradients.
 */
export default function LoadingScreen({
  message = 'Loading…',
  fullScreen = true,
  compact = false,
}: LoadingScreenProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

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
          isDark ? 'text-zinc-100' : 'text-slate-800',
        )}
      >
        {message}
      </p>
      {!compact && (
        <div
          className={cn(
            'loading-bar-track h-1 max-w-[11rem] rounded-full mx-auto overflow-hidden',
            isDark ? 'bg-white/[0.08]' : 'bg-slate-200/95',
          )}
          aria-hidden
        >
          <div
            className={cn(
              'loading-bar-sweep h-full w-[42%] rounded-full bg-gradient-to-r from-transparent to-transparent',
              'via-teal-600/88 dark:via-teal-300/85',
            )}
          />
        </div>
      )}
      {!compact && (
        <>
          <div
            className={cn(
              'max-w-[11rem] mx-auto mt-5 border-t',
              isDark ? 'border-white/[0.08]' : 'border-slate-200/90',
            )}
            aria-hidden
          />
          <p
            className={cn(
              'storm-wordmark-font pt-3 text-[0.65rem] font-semibold tracking-[0.14em]',
              'text-teal-700/70 dark:text-teal-400/45',
            )}
          >
            PROVVEN
          </p>
        </>
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
            className={cn('absolute inset-0', isDark ? 'bg-[var(--storm-body-gradient)]' : '')}
            style={
              isDark
                ? undefined
                : {
                    /* Match [data-theme='light'] body base (blooms sit in StormBackground; loader stays coherent) */
                    background:
                      'linear-gradient(165deg, #e8edf5 0%, #dfe7f1 42%, #d4dde8 100%)',
                  }
            }
          />
          <div
            className={cn(
              'absolute top-[18%] left-1/2 h-[min(85vw,36rem)] w-[min(85vw,36rem)] -translate-x-1/2 rounded-full blur-3xl motion-reduce:animate-none animate-pulse',
              isDark ? 'bg-teal-400/[0.09]' : 'bg-[rgb(13_148_136/0.1)]',
            )}
            style={{ animationDuration: '3.2s' }}
          />
          <div
            className={cn(
              'absolute bottom-[-5%] right-[-8%] h-[min(70vw,26rem)] w-[min(70vw,26rem)] rounded-full blur-3xl motion-reduce:animate-none animate-pulse',
              isDark ? 'bg-violet-500/[0.085]' : 'bg-[rgb(124_58_237/0.08)]',
            )}
            style={{ animationDuration: '4s', animationDelay: '0.4s' }}
          />
        </div>

        <div className='relative z-[1] mx-4 w-full max-w-md'>
          <div
            className={cn(
              'rounded-2xl p-8 sm:p-10 backdrop-blur-xl',
              isDark
                ? 'storm-glass-panel ring-1 ring-teal-400/[0.16]'
                : 'storm-light-panel',
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
            'w-full max-w-sm rounded-2xl px-8 py-10 backdrop-blur-xl',
            isDark
              ? 'storm-glass-panel ring-1 ring-teal-400/[0.14]'
              : 'storm-light-panel',
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
