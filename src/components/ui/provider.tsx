'use client'

import { ChakraProvider } from '@chakra-ui/react'
import { ThemeProvider } from 'next-themes'
import system from '@/lib/theme'

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ChakraProvider value={system}>{children}</ChakraProvider>
    </ThemeProvider>
  )
}
