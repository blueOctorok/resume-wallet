'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Determine initial theme: saved preference > DOM > default light (professional default)
  const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light'
    
    const savedTheme = localStorage.getItem('stormchain-theme') as Theme
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      return savedTheme
    }
    
    const existingTheme = document.documentElement.getAttribute('data-theme') as Theme
    if (existingTheme && (existingTheme === 'light' || existingTheme === 'dark')) {
      return existingTheme
    }
    
    return 'light'
  }

  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // No longer need the separate useEffect for loading - handled in getInitialTheme
  // But we still apply theme to document on changes
  useEffect(() => {
    const savedTheme = localStorage.getItem('stormchain-theme') as Theme
    if (!savedTheme && theme !== 'light') {
      setThemeState('light')
    }
  }, [])

  // Apply theme to document and save to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('stormchain-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
