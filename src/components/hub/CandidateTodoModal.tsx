'use client'

import { ArrowRight, CheckCircle2, Circle, CircleDot, Clock } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useCandidateTodo } from '@/stores/candidate-todo-store'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useAuthStore, useUIStore } from '@/stores'
import { cn } from '@/lib/utils'
import type { TodoItem, TodoStatus } from '@/lib/candidate-todo'

/**
 * The checklist, on demand — opened from the nav "Up next" chip.
 * The next step is the big button at the top; everything else is listed
 * below so the candidate can jump to any task instead of being forced
 * down one path. Not a nav destination (see docs/CHANGES.md 2026-08-07).
 */

const STATUS_META: Record<TodoStatus, { label: string; chip: string }> = {
  todo: {
    label: 'To do',
    chip: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-gray-300',
  },
  'in-progress': {
    label: 'In progress',
    chip: 'bg-teal-50 text-teal-800 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-400/25',
  },
  waiting: {
    label: 'Waiting',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  },
  done: {
    label: 'Done',
    chip: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
}

function StatusIcon({ status }: { status: TodoStatus }) {
  if (status === 'done') return <CheckCircle2 className='h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400' />
  if (status === 'waiting') return <Clock className='h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400' />
  if (status === 'in-progress') return <CircleDot className='h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300' />
  return <Circle className='h-4 w-4 shrink-0 text-slate-400 dark:text-gray-500' />
}

export default function CandidateTodoModal({ onClose }: { onClose: () => void }) {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const setShowProfileSetup = useAuthStore((s) => s.setShowProfileSetup)
  const todo = useCandidateTodo()

  // Two rows have no page route — they open modals on the hub instead.
  const isModalRow = (id: string) => id === 'add-block' || id === 'profile'

  const go = (item: TodoItem) => {
    onClose()
    if (isModalRow(item.id)) {
      setCurrentPage(null)
      if (item.id === 'profile') setShowProfileSetup(true)
      else openPicker()
      return
    }
    setCurrentPage(item.page)
  }

  // The primary is rendered as the button at top — don't repeat it in the list.
  const rest = todo.items.filter((i) => i.id !== todo.primary?.id)

  return (
    <Modal onClose={onClose} maxWidth='max-w-md' panelShape='block'>
      <ModalHeader
        variant='block'
        title='Up next'
        subtitle={todo.invitedBy ? `Invited by ${todo.invitedBy}` : 'Pick anything — this is your file to build.'}
        onClose={onClose}
      />

      <div className='space-y-4 p-4 sm:p-5'>
        {todo.primary ? (
          <Button
            type='button'
            variant='primary'
            size='lg'
            className='w-full'
            onClick={() => go(todo.primary!)}
          >
            {todo.primary.label}
            <ArrowRight className='h-4 w-4' />
          </Button>
        ) : (
          <div className='rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-400/20 dark:bg-emerald-500/10'>
            <p className='text-sm font-semibold text-emerald-900 dark:text-emerald-200'>
              You&apos;re all caught up.
            </p>
            <p className='mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-300/80'>
              Anything still open below is processing or waiting on an employer.
            </p>
          </div>
        )}

        {rest.length > 0 && (
          <ul className='space-y-1'>
            {rest.map((item) => {
              const meta = STATUS_META[item.status]
              const clickable = item.status !== 'done' && (item.page !== null || isModalRow(item.id))
              return (
                <li key={item.id}>
                  <button
                    type='button'
                    onClick={() => clickable && go(item)}
                    disabled={!clickable}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                      clickable
                        ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/[0.06]'
                        : 'cursor-default',
                    )}
                  >
                    <StatusIcon status={item.status} />
                    <span className='min-w-0 flex-1'>
                      <span
                        className={cn(
                          'block truncate text-sm',
                          item.status === 'done'
                            ? 'text-slate-400 dark:text-gray-500'
                            : 'font-medium text-slate-900 dark:text-gray-100',
                        )}
                      >
                        {item.label}
                      </span>
                      {item.waitingOn && (
                        <span className='block truncate text-xs text-slate-500 dark:text-gray-400'>
                          {item.waitingOn}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        meta.chip,
                      )}
                    >
                      {meta.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
