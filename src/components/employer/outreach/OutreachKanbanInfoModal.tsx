'use client'

import Modal, { ModalHeader } from '@/components/ui/Modal'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import { cn } from '@/lib/utils'
import {
  OUTREACH_KANBAN_COLUMNS,
  OUTREACH_KANBAN_LABEL,
} from '@/lib/outreach-invite-buckets'

interface OutreachKanbanInfoModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Explains status-based columns, archive aging, and card vs modal actions.
 * Copy stays in sync with `outreach-invite-buckets` (single source for day count + column ids).
 */
export default function OutreachKanbanInfoModal({ open, onClose }: OutreachKanbanInfoModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  if (!open) return null

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" panelShape="block" zIndex={1150}>
      <ModalHeader
        variant="block"
        title="How this board works"
        subtitle="Columns follow each invite’s status — not a separate manual pipeline."
        onClose={onClose}
      />
      <div
        className={cn(
          'max-h-[min(70vh,28rem)] space-y-4 overflow-y-auto p-4 text-sm leading-relaxed sm:p-5',
          isDark ? 'text-gray-300' : 'text-gray-700',
        )}
      >
        <section>
          <h4 className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Columns
          </h4>
          <p className="mb-2">
            Each column matches the invite&apos;s <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>candidate status</strong>
            — when a candidate opens the link, starts, or finishes, their card moves here automatically.
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs sm:text-sm">
            {OUTREACH_KANBAN_COLUMNS.map((id) => (
              <li key={id}>
                <span className="font-medium">{OUTREACH_KANBAN_LABEL[id]}</span>
                {id === 'pending' && ' — link created, not opened yet.'}
                {id === 'viewed' && ' — they opened the invite (or signed in) but haven’t signed consent yet.'}
                {id === 'in_progress' && ' — consent forms are fully filled out and signed. Their part is done; order MVR/PSP next.'}
                {id === 'completed' && ' — you ordered MVR or PSP and a result came back. Stays here so you can keep working the candidate.'}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Cards & actions
          </h4>
          <p>
            Tiles are compact on purpose. <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>Click a card</strong> to open the full
            detail view: copy link, QR, email, MVR/PSP files, internal notes, Assistant, cancel, or remove.
          </p>
        </section>

        <section>
          <h4 className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Red dot = needs attention
          </h4>
          <p>
            Cards with a <span className="inline-flex h-2 w-2 translate-y-[1px] rounded-full bg-red-500 align-baseline" /> {' '}
            red dot have a stalled or failed screening — usually a typo in the driver license field, a provider rejection,
            or an order pending more than 24h. Open the card to see the assistant&apos;s reason and a one-click{' '}
            <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>Resend consent</strong> button, which mints a
            fresh invite and emails the candidate to redo the form with corrected info.
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            Flagged cards always float to the top of their column.
          </p>
        </section>

        <section>
          <h4 className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Archive tab
          </h4>
          <p>
            <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>Cancelled</strong> and <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>expired</strong> invites
            live there so they don&apos;t clutter daily work. <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>Completed</strong> invites
            stay on the active board (they are not auto-archived) so you can keep acting on a candidate after their screenings return.
            Paid screening files stay available from the Files vault.
          </p>
        </section>

        <section>
          <h4 className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Restore
          </h4>
          <p className="text-xs sm:text-sm">
            Only <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>cancelled</strong> invites can be restored to Pending from Archive.
            Expired and auto-archived completed rows stay historical unless you start a new outreach.
          </p>
        </section>
      </div>
    </Modal>
  )
}
