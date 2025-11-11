import type { Metadata } from 'next'
import { Quicksand } from 'next/font/google'
import './globals.css'
import AlchemyProvider from '@/components/AlchemyProvider'
import { ThemeProvider } from '@/contexts/ThemeContext'

const quicksand = Quicksand({
  variable: '--font-quicksand',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'ResumeWallet',
  description: 'Next generation resume wallet',
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
          </AlchemyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
