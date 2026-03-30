'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Must match SSR/first client paint — never read localStorage in useState initializer
  // (server is always 'light'; client with saved 'dark' would mismatch and break hydration).
  const [theme, setThemeState] = useState<Theme>('light')
  const skipThemePersist = useRef(true)

  useEffect(() => {
    const saved = localStorage.getItem('stormchain-theme') as Theme
    let next: Theme = 'light'
    if (saved === 'light' || saved === 'dark') {
      next = saved
    } else {
      const fromDom = document.documentElement.getAttribute('data-theme') as Theme
      if (fromDom === 'light' || fromDom === 'dark') next = fromDom
    }
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('stormchain-theme', next)
  }, [])

  useEffect(() => {
    // First run is the SSR-aligned 'light' paint — persist would clobber disk before hydrate runs.
    if (skipThemePersist.current) {
      skipThemePersist.current = false
      return
    }
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
