'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  DARK_APPEARANCE_KEY,
  LIGHT_APPEARANCE_KEY,
  isDarkTheme,
  parseStoredTheme,
  persistThemeToStorage,
  type StoredTheme,
} from '@/lib/theme-storage'

export type Theme = StoredTheme

// Re-export for components that already import theme helpers from context
export { isDarkTheme } from '@/lib/theme-storage'

interface ThemeContextType {
  theme: Theme
  /** Light ↔ last dark appearance, or dark ↔ last light (persists both variants). */
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function isLightVariant(t: Theme): boolean {
  return t === 'light' || t === 'paper'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const skipThemePersist = useRef(true)

  useEffect(() => {
    const next = parseStoredTheme()
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    persistThemeToStorage(next)
    try {
      if (isLightVariant(next)) {
        localStorage.setItem(LIGHT_APPEARANCE_KEY, next)
      }
      if (isDarkTheme(next)) {
        localStorage.setItem(DARK_APPEARANCE_KEY, next)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (skipThemePersist.current) {
      skipThemePersist.current = false
      return
    }
    document.documentElement.setAttribute('data-theme', theme)
    persistThemeToStorage(theme)
    try {
      if (isLightVariant(theme)) {
        localStorage.setItem(LIGHT_APPEARANCE_KEY, theme)
      }
      if (isDarkTheme(theme)) {
        localStorage.setItem(DARK_APPEARANCE_KEY, theme)
      }
    } catch {
      /* ignore */
    }
  }, [theme])

  const toggleTheme = () => {
    setThemeState((prev) => {
      if (isDarkTheme(prev)) {
        try {
          const back = localStorage.getItem(LIGHT_APPEARANCE_KEY)
          if (back === 'light' || back === 'paper') return back as Theme
        } catch {
          /* fall through */
        }
        return 'light'
      }
      try {
        localStorage.setItem(LIGHT_APPEARANCE_KEY, prev)
      } catch {
        /* ignore */
      }
      try {
        const back = localStorage.getItem(DARK_APPEARANCE_KEY)
        if (back === 'dark' || back === 'ink') return back as Theme
      } catch {
        /* fall through */
      }
      return 'dark'
    })
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

/** True for icy light + paper (not galactic void / quiet dark). */
export function isLightAppearance(theme: Theme): boolean {
  return isLightVariant(theme)
}
