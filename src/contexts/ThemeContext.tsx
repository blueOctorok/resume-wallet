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
  // Determine initial theme based on device type
  const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'dark'
    
    // Check if user has a saved preference (takes priority)
    const savedTheme = localStorage.getItem('veree-theme') as Theme
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      return savedTheme
    }
    
    // Check if script already set data-theme attribute (from blocking script in layout)
    const existingTheme = document.documentElement.getAttribute('data-theme') as Theme
    if (existingTheme && (existingTheme === 'light' || existingTheme === 'dark')) {
      return existingTheme
    }
    
    // No saved preference - use device-based default
    // Default to dark mode for all devices
    return 'dark'
  }

  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // No longer need the separate useEffect for loading - handled in getInitialTheme
  // But we still apply theme to document on changes
  useEffect(() => {
    // Recheck on mount in case window wasn't available during SSR
    const savedTheme = localStorage.getItem('veree-theme') as Theme
    if (!savedTheme) {
      // Only update if no saved preference exists
      // Default to dark mode for all devices
      const deviceDefault = 'dark'
      if (theme !== deviceDefault) {
        setThemeState(deviceDefault)
      }
    }
  }, [])

  // Apply theme to document and save to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('veree-theme', theme)
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
