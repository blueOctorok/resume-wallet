import type { Metadata } from 'next'
import { Montserrat, Orbitron } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import MobileConsole from '@/components/MobileConsole'
import ScrollToTop from '@/components/ScrollToTop'
import SupabaseAuthSync from '@/components/SupabaseAuthSync'
import SiteAnalytics from '@/components/SiteAnalytics'
import { SITE_SEO, siteJsonLd } from '@/lib/site-seo'

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

/** STORM wordmark only — Orbitron semibold (600); softer than 900 black */
const stormWordmark = Orbitron({
  variable: '--font-storm-wordmark',
  subsets: ['latin'],
  weight: '600',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://provven.com'),
  title: {
    default: SITE_SEO.title,
    template: '%s | Provven',
  },
  description: SITE_SEO.description,
  keywords: [
    'Provven',
    'Career Card',
    'truck driver resume',
    'truck driver employment application',
    'DOT driver application',
    'truck driver employment verification',
  ],
  authors: [{ name: 'Provven' }],
  creator: 'Provven',
  publisher: 'Provven',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://provven.com',
    siteName: 'Provven',
    title: SITE_SEO.title,
    description: SITE_SEO.description,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Provven - Build Your Truck Driver Resume and Reuse It for Every Job',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_SEO.title,
    description: SITE_SEO.description,
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'gO0Pw1dUt-tULV1GWTwFkza_fjjbIs42KQPwYd5yZ14',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var SK = 'stormchain-theme';
                  var SCHEMA = 'stormchain-theme-schema';
                  var VER = '5';
                  var saved = localStorage.getItem(SK);
                  // v5: paper/ink retired -> light/dark; older sepia/business -> light
                  var t = saved === 'dark' || saved === 'ink' ? 'dark' : 'light';
                  localStorage.setItem(SCHEMA, VER);
                  localStorage.setItem(SK, t);
                  document.documentElement.setAttribute('data-theme', t);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              })();
              
              // Global error handler for crypto errors on mobile
              window.addEventListener('error', function(event) {
                if (event.message && (
                  event.message.includes('crv') ||
                  event.message.includes('invalid') && event.message.includes('crypto') ||
                  event.message.includes('g:invalid')
                )) {
                  console.error('🔐 Mobile crypto error detected:', event.message);
                  // Store error for component to display
                  sessionStorage.setItem('crypto-error', 'true');
                }
              });
            `,
          }}
        />
      </head>
      <body className={`${montserrat.variable} ${stormWordmark.variable} antialiased`}>
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
        <ThemeProvider>
          <SupabaseAuthSync />
          {children}
          {process.env.NODE_ENV === 'development' && <MobileConsole />}
          <ScrollToTop />
          <SiteAnalytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
