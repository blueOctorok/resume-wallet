'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useRef } from 'react'
// Namespace import: production (e.g. Vercel) can drop named `createPortal` from `react-dom`.
import * as ReactDOM from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface ModalProps {
  /** Called when backdrop is clicked or Escape is pressed */
  onClose: () => void
  children: React.ReactNode
  /**
   * Max width class for the panel. Defaults to 'max-w-lg'.
   * Use any Tailwind max-w-* value.
   */
  maxWidth?: string
  /**
   * Optional z-index override. Defaults to 1000.
   * Nest modals by passing a higher value (e.g. 1100) for the inner one.
   */
  zIndex?: number
  /** When true the backdrop click does NOT close the modal */
  disableBackdropClose?: boolean
  /** When true, Escape does not call onClose (backdrop still respects disableBackdropClose) */
  disableEscapeClose?: boolean
  /**
   * `default` — rounded-2xl panel (standard dialogs).
   * `block` — same shell as hub block-picker / category cards: rounded-xl border, muted fill, hidden scrollbar on overflow.
   */
  panelShape?: 'default' | 'block'
  /** Merged onto the panel div (extra utilities beyond shape defaults). */
  panelClassName?: string
}

/**
 * Modal — the one right way to render a modal in this app.
 *
 * Why a portal?  React portals append the modal directly to <body>, outside
 * every CSS stacking context.  That means z-index works predictably and no
 * parent `overflow:hidden` can clip the overlay.
 *
 * Why body scroll-lock?  Without it, the content behind the modal scrolls
 * while the modal is open, and fixed elements (like the nav) shift.  We
 * patch `document.body.style.overflow` and restore it on unmount.  The
 * `openCount` trick handles nested modals correctly — the lock only lifts
 * when the last modal closes.
 */

// Track how many modals are open so nested modals don't unlock the body early.
let openModalCount = 0

export default function Modal({
  onClose,
  children,
  maxWidth = 'max-w-lg',
  zIndex = 1000,
  disableBackdropClose = false,
  disableEscapeClose = false,
  panelShape = 'default',
  panelClassName,
}: ModalProps) {
  const { theme } = useTheme()
  const isDarkMode = isDarkTheme(theme)
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const disableEscapeCloseRef = useRef(disableEscapeClose)
  disableEscapeCloseRef.current = disableEscapeClose

  // Scroll lock + Escape handler. Empty deps so this runs only on mount/unmount.
  // If we depended on [onClose], parent re-renders (e.g. closing another modal) would
  // give us a new onClose reference, run cleanup (openModalCount--), then re-run
  // (openModalCount++), leaving the count wrong and body scroll never restored.
  useEffect(() => {
    openModalCount++
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEscapeCloseRef.current) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      openModalCount--
      if (openModalCount === 0) {
        document.body.style.overflow = prev
      }
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      {/* Backdrop — depth + cool tint (reads premium vs flat gray) */}
      <div
        className="absolute inset-0 animate-backdrop-in bg-gradient-to-b from-slate-950/75 via-slate-950/65 to-teal-950/40 backdrop-blur-md dark:from-black/80 dark:via-slate-950/70 dark:to-teal-950/30"
        onClick={disableBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-h-[90vh] overflow-y-auto overflow-x-hidden scrollbar-none animate-modal-in',
          panelShape === 'block'
            ? cn(
                'rounded-xl border shadow-xl ring-1 ring-teal-500/20 dark:ring-teal-500/25',
                isDarkMode
                  ? 'border-gray-700 bg-gray-800/95'
                  : 'border-gray-200 bg-white',
              )
            : cn(
                'rounded-2xl ring-1 ring-white/15 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.45)] dark:ring-white/10 dark:shadow-[0_28px_72px_-8px_rgba(0,0,0,0.75)]',
                isDarkMode
                  ? 'bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-600/80'
                  : 'bg-gradient-to-b from-white to-slate-50/95 border border-gray-200/90',
              ),
          maxWidth,
          panelClassName,
        )}
      >
        {panelShape !== 'block' ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent dark:via-teal-400/40"
          />
        ) : null}
        {children}
      </div>
    </div>
  )

  // Portal to body so no parent stacking context interferes
  return ReactDOM.createPortal(content, document.body)
}

// ─── ModalHeader ────────────────────────────────────────────────────────────

interface ModalHeaderProps {
  title: string
  subtitle?: string
  onClose: () => void
  /** Match `Modal` `panelShape="block"` — header edge aligns with category-card shell. */
  variant?: 'default' | 'block'
}

/**
 * Sticky header for use inside Modal.  Handles the close button and title.
 * Use this instead of rewriting the header pattern every time.
 */
export function ModalHeader({ title, subtitle, onClose, variant = 'default' }: ModalHeaderProps) {
  const { theme } = useTheme()
  const block = variant === 'block'
  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-5 border-b',
        isDarkTheme(theme)
          ? block
            ? 'border-gray-700 bg-gray-900/95 backdrop-blur-sm'
            : 'border-gray-700/80 bg-gray-900/95 backdrop-blur-sm'
          : block
            ? 'border-gray-200 bg-white backdrop-blur-sm'
            : 'border-gray-200/90 bg-white/95 backdrop-blur-sm',
      )}
    >
      {!block ? (
        <div
          aria-hidden
          className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-teal-500/20 to-transparent dark:via-teal-400/15"
        />
      ) : null}
      <div>
        <h3
          className={cn(
            'text-base sm:text-lg font-semibold tracking-tight',
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900',
          )}
        >
          {title}
        </h3>
        {subtitle && (
          <p className={cn('text-sm mt-1 leading-snug', isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600')}>
            {subtitle}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        className={cn(
          'shrink-0 p-1.5 transition-colors',
          'rounded-lg',
          isDarkTheme(theme)
            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
        )}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
