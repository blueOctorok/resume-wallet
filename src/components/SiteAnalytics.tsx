'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { analyticsPath, googleAnalyticsId } from '@/lib/analytics-path'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

const GA_ID = googleAnalyticsId()

function reportPage(pathname: string) {
  if (!GA_ID || typeof window.gtag !== 'function') return
  const host = window.location.hostname
  if (host !== 'provven.com' && host !== 'www.provven.com') return
  const path = analyticsPath(pathname)
  // page_location is the scrubbed path, not the address bar. A career-card
  // title can be a person's name, so the report gets the path instead.
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: `https://provven.com${path}`,
    page_title: path,
  })
}

/**
 * GA4 page views for provven.com. Absent until NEXT_PUBLIC_GA_MEASUREMENT_ID
 * is set, and silent on localhost and preview hosts.
 */
export default function SiteAnalytics() {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (ready) reportPage(pathname)
  }, [ready, pathname])

  if (!GA_ID) return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy='afterInteractive' />
      <Script id='provven-ga4' strategy='afterInteractive' onLoad={() => setReady(true)}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  )
}
