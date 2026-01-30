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
  title: 'StormChain | We Make Hard-to-Get Jobs Easy',
  description: 'Blockchain-verified applications for drivers and developers. Showcase your work, prove your credentials. Secure, permanent, and tamper-proof.',
  icons: {
    icon: '/favicon.svg',
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
            <MobileConsole />
            <ScrollToTop />
          </AlchemyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
