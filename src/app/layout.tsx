import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import AlchemyProvider from '@/components/AlchemyProvider'
import { ThemeProvider } from '@/contexts/ThemeContext'
import MobileConsole from '@/components/MobileConsole'
import ScrollToTop from '@/components/ScrollToTop'

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://stormchain.ai'),
  title: {
    default: 'StormChain | Blockchain-Verified Career Platform',
    template: '%s | StormChain',
  },
  description:
    'Build your Career Card, apply to jobs instantly, and get verified on-chain. The blockchain-verified career platform for drivers and software engineers.',
  keywords: [
    'StormChain',
    'Career Card',
    'blockchain verification',
    'driver applications',
    'DOT application',
    'developer portfolio',
    'resume verification',
    'verified credentials',
    'job applications',
    'CDL driver jobs',
    'software engineer portfolio',
  ],
  authors: [{ name: 'StormChain' }],
  creator: 'StormChain',
  publisher: 'StormChain',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://stormchain.ai',
    siteName: 'StormChain',
    title: 'StormChain | Blockchain-Verified Career Platform',
    description:
      'Build your Career Card, apply to jobs instantly, and get verified on-chain. For drivers and software engineers.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'StormChain - Your Career, One Verified Card',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StormChain | Blockchain-Verified Career Platform',
    description:
      'Build your Career Card, apply to jobs instantly, and get verified on-chain.',
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
    google: 'EPF8l8g1XNFcpDvbSd4j_8lG6-ppNW4vCMlGH',
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
                  // Check for saved preference first
                  const savedTheme = localStorage.getItem('stormchain-theme');
                  if (savedTheme === 'light' || savedTheme === 'dark') {
                    document.documentElement.setAttribute('data-theme', savedTheme);
                    return;
                  }
                  // No saved preference - default to dark mode for all devices
                  document.documentElement.setAttribute('data-theme', 'dark');
                } catch (e) {
                  // Fallback to dark if anything fails
                  document.documentElement.setAttribute('data-theme', 'dark');
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
      <body className={`${montserrat.variable} antialiased`}>
        <ThemeProvider>
          <AlchemyProvider>
            {children}
            {process.env.NODE_ENV === 'development' && <MobileConsole />}
            <ScrollToTop />
          </AlchemyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
