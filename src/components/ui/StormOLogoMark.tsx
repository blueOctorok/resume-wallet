'use client'

import { CloudLightning } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StormOLogoMarkProps {
  /** Sized in `em` relative to parent wordmark `font-size` */
  className?: string
}

/**
 * Static logo “O” for **St[O]rm** — no animation.
 * Ring split **teal top / violet bottom**; **cloud + lightning** centered inside.
 */
export default function StormOLogoMark({ className }: StormOLogoMarkProps) {
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center align-middle',
        'h-[0.92em] w-[0.92em] min-h-[0.85rem] min-w-[0.85rem]',
        className,
      )}
      aria-hidden
    >
      <svg
        className='pointer-events-none absolute inset-0 h-full w-full'
        viewBox='0 0 64 64'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        {/* First arc (left → right): in this viewBox this reads as the lower half — violet */}
        <path
          d='M 9 32 A 23 23 0 0 0 55 32'
          stroke='#a78bfa'
          strokeWidth='3.25'
          strokeLinecap='round'
        />
        {/* Second arc (right → left): upper half — teal */}
        <path
          d='M 55 32 A 23 23 0 0 0 9 32'
          stroke='#2dd4bf'
          strokeWidth='3.25'
          strokeLinecap='round'
        />
      </svg>
      <CloudLightning
        className='relative z-[1] h-[38%] w-[38%] text-teal-600 dark:text-teal-300'
        strokeWidth={2.1}
        aria-hidden
      />
    </span>
  )
}
