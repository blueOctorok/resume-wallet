import Link from 'next/link'
import { SITE_LEGAL } from '@/lib/site-legal'

/** Public-site footer — Privacy + Terms links carriers expect in the page chrome. */
export default function SiteFooter() {
  return (
    <footer className='border-t border-gray-200 px-4 py-8 dark:border-gray-700'>
      <div className='mx-auto flex max-w-2xl flex-col items-center gap-2 text-center text-[11px] text-gray-600 dark:text-gray-400'>
        <nav className='flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs'>
          <Link
            href='/privacy'
            className='text-[#173150] underline-offset-2 hover:underline dark:text-gray-100'
          >
            Privacy Policy
          </Link>
          <Link
            href='/terms'
            className='text-[#173150] underline-offset-2 hover:underline dark:text-gray-100'
          >
            Terms of Service
          </Link>
        </nav>
        <p>
          © {new Date().getFullYear()} {SITE_LEGAL.brand} ·{' '}
          <a
            href={SITE_LEGAL.url}
            className='underline-offset-2 hover:underline'
          >
            provven.com
          </a>
        </p>
        <p>
          <a
            href={`mailto:${SITE_LEGAL.contactEmail}`}
            className='underline-offset-2 hover:underline'
          >
            {SITE_LEGAL.contactEmail}
          </a>
        </p>
        {SITE_LEGAL.mailingAddress ? <p>{SITE_LEGAL.mailingAddress}</p> : null}
      </div>
    </footer>
  )
}
