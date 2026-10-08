'use client'

import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BackToHubButtonProps {
  onClick: () => void
  label?: string
  className?: string
}

/**
 * Return control for hub pages.
 *
 * It is a block on its own row, with space under it, so the next panel
 * cannot share its edge. In a horizontal header, pass `className="mb-0"`.
 */
export default function BackToHubButton({
  onClick,
  label = 'Back to Hub',
  className,
}: BackToHubButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'mb-4 flex w-fit items-center gap-2 rounded-full border py-1 pl-1 pr-3.5',
        'text-[13px] font-medium tracking-tight text-[#173150]',
        'border-[#173150]/15 bg-white/90 shadow-[0_1px_0_rgba(23,49,80,0.05)]',
        'transition-colors hover:border-teal-500/45 hover:bg-teal-500/[0.06]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50',
        'dark:border-white/15 dark:bg-white/[0.06] dark:text-[#f4efe6] dark:shadow-none',
        'dark:hover:border-teal-500/55 dark:hover:bg-teal-500/10',
        className,
      )}
    >
      <span
        aria-hidden
        className='flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/15 text-teal-500 ring-1 ring-teal-500/30'
      >
        <ArrowLeft className='h-3.5 w-3.5' strokeWidth={2.25} />
      </span>
      {label}
    </button>
  )
}
