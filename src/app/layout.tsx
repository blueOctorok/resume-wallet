import type { Metadata } from 'next'
import { Quicksand } from 'next/font/google'
import './globals.css'
import AlchemyProvider from '@/components/AlchemyProvider'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { CreditsDisplay } from '@/components/CreditsDisplay'
import MobileConsole from '@/components/MobileConsole'

const quicksand = Quicksand({
  variable: '--font-quicksand',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Veree | Blockchain-Verified Driver Applications',
  description: 'Submit your DOT driver application with blockchain verification. Secure, permanent, and tamper-proof credentials.',
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
                  const savedTheme = localStorage.getItem('veree-theme');
                  if (savedTheme === 'light' || savedTheme === 'dark') {
                    document.documentElement.setAttribute('data-theme', savedTheme);
                    return;
                  }
                  // No saved preference - use device-based default
                  // Mobile (< 768px) = light mode, Desktop = dark mode
                  const isMobile = window.innerWidth < 768;
                  const defaultTheme = isMobile ? 'light' : 'dark';
                  document.documentElement.setAttribute('data-theme', defaultTheme);
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
      <body className={`${quicksand.variable} antialiased`}>
        <ThemeProvider>
          <AlchemyProvider>
            {children}
            <CreditsDisplay />
            <MobileConsole />
          </AlchemyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
