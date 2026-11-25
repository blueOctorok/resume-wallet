import type { ReactNode } from 'react'

/**
 * The cotton sheet the resume is printed on. Career path, documents, and the
 * packet share it so the three read as one set instead of three different boxes.
 * Always light, same as the resume: the texture is the point, dark mode is not.
 */
const PAPER = {
  backgroundColor: '#f6f6f6',
  backgroundImage: 'url(/brand/resume-paper.png?v=2)',
  backgroundRepeat: 'repeat',
  backgroundSize: '740px 493px',
} as const

export default function ResumePaperCard({ children }: { children: ReactNode }) {
  return (
    <article
      className='relative overflow-hidden text-stone-900 shadow-[0_4px_16px_rgba(23,49,80,0.16),0_14px_36px_-6px_rgba(23,49,80,0.32)] ring-1 ring-stone-300'
      style={PAPER}
    >
      <div className='h-1 bg-[#173150]' aria-hidden />
      <div className='px-5 py-6 sm:px-8'>{children}</div>
    </article>
  )
}

/** The mark between resume sections: a hairline, an ember diamond, a hairline. */
export function PaperRule({ className = 'mt-1.5' }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`} aria-hidden>
      <span
        className='h-px flex-1'
        style={{ backgroundImage: 'linear-gradient(to right, transparent, #a8a29e)' }}
      />
      <span className='mx-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#f15a2b]' />
      <span
        className='h-px flex-1'
        style={{ backgroundImage: 'linear-gradient(to left, transparent, #a8a29e)' }}
      />
    </div>
  )
}

/**
 * Buttons that sit on the cotton. The shared Button is flat on purpose everywhere
 * else. Here the ember one takes the sheet's navy shadow, and the second one
 * needs a white face plus a stone ring or it disappears into the paper.
 */
export const paperPrimaryButtonClass =
  '!shadow-[0_8px_18px_-6px_rgba(23,49,80,0.45)] hover:!shadow-[0_10px_22px_-6px_rgba(23,49,80,0.55)]'
export const paperSecondaryButtonClass =
  '!border-stone-300 !bg-white !text-[#173150] !shadow-[0_4px_12px_-4px_rgba(23,49,80,0.28)] ring-1 ring-stone-300 hover:!bg-stone-50'

/** Centered ember label plus the rule. Career path adds the mark above this itself. */
export function PaperKicker({ children }: { children: string }) {
  return (
    <header className='mb-4 text-center'>
      <p className='text-[11px] font-bold uppercase tracking-[0.22em] text-[#f15a2b]'>{children}</p>
      <PaperRule />
    </header>
  )
}
