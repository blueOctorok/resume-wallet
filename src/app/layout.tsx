import type { Metadata } from 'next'
import { Quicksand } from 'next/font/google'
import './globals.css'
import AlchemyProvider from '@/components/AlchemyProvider'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { CreditsDisplay } from '@/components/CreditsDisplay'

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
    <html lang='en'>
      <body className={`${quicksand.variable} antialiased`}>
        <ThemeProvider>
          <AlchemyProvider>
            {children}
            <CreditsDisplay />
          </AlchemyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
