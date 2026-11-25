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
        // Opposite of the page, so the way back stays visible. Midnight chip
        // on a light page, white chip when the page itself is midnight.
        'mb-4 flex w-fit items-center gap-2 rounded-full border py-1 pl-1 pr-3.5',
        'text-[13px] font-medium tracking-tight text-white',
        'border-[#173150] bg-[#173150] shadow-[0_4px_12px_-4px_rgba(23,49,80,0.35)]',
        'transition-colors hover:bg-[#1e3d5c]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f15a2b]/50',
        'dark:border-[#173150]/15 dark:bg-white dark:text-[#173150]',
        'dark:hover:border-[#f15a2b]/50 dark:hover:bg-[#f15a2b]/[0.06]',
        className,
      )}
    >
      <span
        aria-hidden
        className='flex h-7 w-7 items-center justify-center rounded-full bg-[#f15a2b]/15 text-[#f15a2b] ring-1 ring-[#f15a2b]/30'
      >
        <ArrowLeft className='h-3.5 w-3.5' strokeWidth={2.25} />
      </span>
      {label}
    </button>
  )
}
