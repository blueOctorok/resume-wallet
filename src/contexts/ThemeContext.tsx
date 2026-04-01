'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

export type Theme = 'light' | 'dark' | 'paper'

const STORAGE_KEY = 'stormchain-theme'
/** When switching to dark, we remember which light look (icy vs paper) to restore. */
const LIGHT_APPEARANCE_KEY = 'stormchain-light-appearance'

function isValidTheme(v: string | null): v is Theme {
  return v === 'light' || v === 'dark' || v === 'paper'
}

interface ThemeContextType {
  theme: Theme
  /** Dark ↔ last icy/paper appearance (persists which light variant you had). */
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const skipThemePersist = useRef(true)

  useEffect(() => {
    let next: Theme = 'light'
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isValidTheme(saved)) {
        next = saved
      } else {
        const fromDom = document.documentElement.getAttribute('data-theme')
        if (isValidTheme(fromDom)) next = fromDom
      }
      if (next === 'light' || next === 'paper') {
        localStorage.setItem(LIGHT_APPEARANCE_KEY, next)
      }
    } catch {
      next = 'light'
    }
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
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
    try {
      localStorage.setItem(STORAGE_KEY, theme)
      if (theme === 'light' || theme === 'paper') {
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
          if (back === 'light' || back === 'paper') return back
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

/** True for both icy light and paper — anything that is not the dark void theme. */
export function isLightAppearance(theme: Theme): boolean {
  return theme === 'light' || theme === 'paper'
}
