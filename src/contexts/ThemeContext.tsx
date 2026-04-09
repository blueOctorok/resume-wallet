'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  LIGHT_APPEARANCE_KEY,
  parseStoredTheme,
  persistThemeToStorage,
  type StoredTheme,
} from '@/lib/theme-storage'

export type Theme = StoredTheme

interface ThemeContextType {
  theme: Theme
  /** Dark ↔ last icy / sepia / paper appearance (persists which light variant you had). */
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function isLightVariant(t: Theme): boolean {
  return t === 'light' || t === 'sepia' || t === 'paper'
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
    } catch {
      /* ignore */
    }
  }, [theme])

  const toggleTheme = () => {
    setThemeState((prev) => {
      if (prev === 'dark') {
        try {
          const back = localStorage.getItem(LIGHT_APPEARANCE_KEY)
          if (back === 'light' || back === 'sepia' || back === 'paper') return back as Theme
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

/** True for icy light, sepia, and paper — anything that is not the dark void theme. */
export function isLightAppearance(theme: Theme): boolean {
  return isLightVariant(theme)
}
