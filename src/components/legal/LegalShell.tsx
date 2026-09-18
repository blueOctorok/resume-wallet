import Link from 'next/link'
import type { ReactNode } from 'react'
import SiteFooter from '@/components/legal/SiteFooter'

export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className='min-h-screen bg-[#f3f4f5] text-[#173150] dark:bg-gray-900 dark:text-gray-100'>
      <header className='border-b border-gray-200 px-4 py-5 dark:border-gray-700'>
        <div className='mx-auto flex max-w-2xl items-center justify-between'>
          <Link
            href='/'
            aria-label='Provven home'
            className='inline-flex items-center gap-[0.28em] text-lg font-bold tracking-[0.08em] text-[#173150] dark:text-gray-100'
          >
            <img
              src='/brand/provven-mark.svg'
              alt=''
              className='inline-block h-[1.15em] w-auto'
            />
            PROVVEN
          </Link>
          <Link
            href='/'
            className='text-xs text-gray-600 underline-offset-2 hover:underline dark:text-gray-400'
          >
            Back to home
          </Link>
        </div>
      </header>
      <main className='mx-auto max-w-2xl px-4 py-12'>
        <p className='mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#f15a2b]'>
          Legal
        </p>
        <h1 className='font-display text-3xl font-medium tracking-tight'>{title}</h1>
        <p className='mt-2 text-xs text-gray-600 dark:text-gray-400'>Last updated {updated}</p>
        <div className='mt-8 space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300'>
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
