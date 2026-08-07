'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { parseStoredTheme, persistThemeToStorage, type StoredTheme } from '@/lib/theme-storage'

export type Theme = StoredTheme

// Re-export for components that already import theme helpers from context
export { isDarkTheme } from '@/lib/theme-storage'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  // First [theme] effect run happens with the SSR default before the mount
  // effect has parsed storage — skip persisting that placeholder value.
  const skipThemePersist = useRef(true)

  useEffect(() => {
    const next = parseStoredTheme()
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
  }, [])

  useEffect(() => {
    if (skipThemePersist.current) {
      skipThemePersist.current = false
      return
    }
    document.documentElement.setAttribute('data-theme', theme)
    persistThemeToStorage(theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
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
