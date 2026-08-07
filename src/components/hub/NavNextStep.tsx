'use client'

import { useState } from 'react'
import { ChevronDown, ListChecks } from 'lucide-react'
import CandidateTodoModal from '@/components/hub/CandidateTodoModal'
import { useCandidateTodo } from '@/stores/candidate-todo-store'
import { cn } from '@/lib/utils'

/**
 * Nav-center preview of the candidate's next step. Clicking opens the full
 * checklist modal rather than jumping straight to the task — the next step is
 * still the big button at the top, but nothing is forced. Hidden when nothing
 * is actionable.
 */
export default function NavNextStep({ isDark }: { isDark: boolean }) {
  const todo = useCandidateTodo()
  const [open, setOpen] = useState(false)

  if (!todo.primary) return null

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-haspopup='dialog'
        title={todo.invitedBy ? `Invited by ${todo.invitedBy}` : 'Your checklist'}
        className={cn(
          'group flex min-w-0 max-w-xs cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
          isDark
            ? 'border-white/10 bg-white/[0.04] text-gray-300 hover:border-teal-400/30 hover:text-teal-200'
            : 'border-slate-200 bg-white/70 text-slate-600 hover:border-teal-300 hover:text-teal-800',
        )}
      >
        <ListChecks className='h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-300' aria-hidden />
        <span className='truncate'>
          <span className={cn('font-semibold', isDark ? 'text-gray-100' : 'text-slate-900')}>Up next:</span>{' '}
          {todo.primary.label}
        </span>
        <ChevronDown className='h-3 w-3 shrink-0 opacity-60' aria-hidden />
      </button>

      {open && <CandidateTodoModal onClose={() => setOpen(false)} />}
    </>
  )
}
