/**
 * Persisted appearance:
 * - `light` — icy colorful light
 * - `paper` — newsprint (monochrome light)
 * - `dark` — galactic void (colorful dark)
 * - `ink` — quiet dark (monochrome dark; inverse of paper)
 *
 * Schema v4: adds `ink`. Removed themes `sepia` / `business` still map to `light`.
 */
export type StoredTheme = 'light' | 'dark' | 'paper' | 'ink'

export const THEME_STORAGE_KEY = 'stormchain-theme'
export const THEME_SCHEMA_KEY = 'stormchain-theme-schema'
export const THEME_SCHEMA_VERSION = '4'
export const LIGHT_APPEARANCE_KEY = 'stormchain-light-appearance'
export const DARK_APPEARANCE_KEY = 'stormchain-dark-appearance'

export function isStoredTheme(v: string | null): v is StoredTheme {
  return v === 'light' || v === 'dark' || v === 'paper' || v === 'ink'
}

/** True when Tailwind `dark:` and storm “dark chrome” paths should apply. */
export function isDarkTheme(theme: string): boolean {
  return theme === 'dark' || theme === 'ink'
}

/** Run on load (and in root layout inline script) before paint to avoid flash. */
export function parseStoredTheme(): StoredTheme {
  try {
    const schema = localStorage.getItem(THEME_SCHEMA_KEY)
    const saved = localStorage.getItem(THEME_STORAGE_KEY)

    if (saved === 'sepia' || saved === 'business') {
      persistThemeToStorage('light')
      return 'light'
    }

    if (schema !== THEME_SCHEMA_VERSION) {
      if (saved === 'light' || saved === 'dark' || saved === 'paper' || saved === 'ink') {
        localStorage.setItem(THEME_SCHEMA_KEY, THEME_SCHEMA_VERSION)
        localStorage.setItem(THEME_STORAGE_KEY, saved)
        return saved
      }
      localStorage.setItem(THEME_SCHEMA_KEY, THEME_SCHEMA_VERSION)
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
      return 'light'
    }

    if (isStoredTheme(saved)) return saved
  } catch {
    /* ignore */
  }
  return 'light'
}

export function persistThemeToStorage(theme: StoredTheme): void {
  try {
    localStorage.setItem(THEME_SCHEMA_KEY, THEME_SCHEMA_VERSION)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}
