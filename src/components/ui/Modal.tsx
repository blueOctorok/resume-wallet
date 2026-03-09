'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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
}: ModalProps) {
  const { theme } = useTheme()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Scroll lock + Escape handler. Empty deps so this runs only on mount/unmount.
  // If we depended on [onClose], parent re-renders (e.g. closing another modal) would
  // give us a new onClose reference, run cleanup (openModalCount--), then re-run
  // (openModalCount++), leaving the count wrong and body scroll never restored.
  useEffect(() => {
    openModalCount++
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl',
          maxWidth,
          theme === 'dark'
            ? 'bg-gray-900 border border-gray-700'
            : 'bg-white'
        )}
      >
        {children}
      </div>
    </div>
  )

  // Portal to body so no parent stacking context interferes
  return createPortal(content, document.body)
}

// ─── ModalHeader ────────────────────────────────────────────────────────────

interface ModalHeaderProps {
  title: string
  subtitle?: string
  onClose: () => void
}

/**
 * Sticky header for use inside Modal.  Handles the close button and title.
 * Use this instead of rewriting the header pattern every time.
 */
export function ModalHeader({ title, subtitle, onClose }: ModalHeaderProps) {
  const { theme } = useTheme()
  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-start justify-between gap-4 p-4 border-b',
        theme === 'dark'
          ? 'border-gray-700 bg-gray-900'
          : 'border-gray-200 bg-white'
      )}
    >
      <div>
        <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          {title}
        </h3>
        {subtitle && (
          <p className={cn('text-sm mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            {subtitle}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        className={cn(
          'shrink-0 p-1.5 rounded-lg transition-colors',
          theme === 'dark'
            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
        )}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
